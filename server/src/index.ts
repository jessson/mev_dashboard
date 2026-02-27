import 'dotenv/config';
import 'reflect-metadata';
import Fastify from 'fastify';
import type { FastifyServerOptions } from 'fastify';
import { TypeormConnection } from './config/database';
import { registerPlugins } from './config/plugins';
import { registerRoutes } from './config/routes';
import { WebSocketService } from './services/websocket.service';
import { SchedulerService } from './services/scheduler.service';
import { ProfitService } from './services/profit.service';
import { tokenProfitService } from './services/token-profit.service';
import { cacheService } from './services/cache.service';
import { chainService } from './config/chains';
import { ChainConfig as ChainConfigEntity } from './entities/ChainConfig';
import { logger } from './utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const sslCertPath = process.env.SSL_CERT_PATH;
const sslKeyPath = process.env.SSL_KEY_PATH;
const httpsEnabled = process.env.ENABLE_HTTPS === '1' || Boolean(sslCertPath && sslKeyPath);

const fastifyOptions: FastifyServerOptions = {
  http2: false,
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : undefined
  } as any
};

if (httpsEnabled) {
  if (!sslCertPath || !sslKeyPath) {
    throw new Error('启用 HTTPS 时必须同时设置 SSL_CERT_PATH 和 SSL_KEY_PATH');
  }
  if (!fs.existsSync(sslCertPath)) {
    throw new Error(`SSL_CERT_PATH 文件不存在: ${sslCertPath}`);
  }
  if (!fs.existsSync(sslKeyPath)) {
    throw new Error(`SSL_KEY_PATH 文件不存在: ${sslKeyPath}`);
  }

  fastifyOptions.https = {
    cert: fs.readFileSync(sslCertPath),
    key: fs.readFileSync(sslKeyPath)
  };
}

const fastify = Fastify(fastifyOptions);

// 添加全局请求日志（仅在debug模式下）
if (process.env.LOG_LEVEL === 'debug') {
  fastify.addHook('onRequest', async (request, reply) => {
    logger.debug(`📥 收到请求: ${request.method} ${request.url}`);
    if (request.body) {
      logger.debug(`📋 请求体: ${JSON.stringify(request.body)}`);
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.debug(`📤 响应: ${request.method} ${request.url} - ${reply.statusCode}`);
  });
}

// 添加限流错误处理
fastify.setErrorHandler(async (error, request, reply) => {
  if (error.statusCode === 429) {
    logger.warn(`限流触发: ${request.ip} - ${request.method} ${request.url}`);
    reply.code(429).send({
      error: '请求过于频繁，请稍后再试',
      retryAfter: 60
    });
    return;
  }

  const obj = {
    error: error.message,
    statusCode: error.statusCode,
    method: request.method,
    url: request.url,
    ip: request.ip,
    validation: error.validation,
    stack: error.stack
  }
  const msg = JSON.stringify(obj);
  logger.error(`请求处理错误:${msg}`);
  
  reply.code(error.statusCode || 500).send({
    error: error.message || '内部服务器错误'
  });
});

async function start() {
  try {
    // 确保数据目录存在
    const dataDir = path.dirname(process.env.DATABASE_PATH || './data/mev.db');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 初始化数据库连接
    if (!TypeormConnection.isInitialized) {
      await TypeormConnection.initialize();
      logger.info(`数据库连接成功`);
      
      // 强制同步数据库表结构
      await TypeormConnection.synchronize();

      // 初始化链配置服务
      const chainConfigRepository = TypeormConnection.getRepository(ChainConfigEntity);
      chainService.setRepository(chainConfigRepository);
      await chainService.loadFromDatabase();

      // 先初始化Token统计服务
      tokenProfitService.initialize();

      // 初始化缓存服务 - 从数据库加载当日trade数据
      await cacheService.initializeFromDatabase();

      // 初始化Profit服务 - 加载内存收益数据
      const profitService = new ProfitService();
      await profitService.initializeMemoryProfits();
      
      // 将Profit服务实例保存到全局，供后续使用
      (global as any).profitServiceInstance = profitService;
    }

    // 注册插件
    await registerPlugins(fastify);
    
    // 注册路由
    await registerRoutes(fastify);

    // 在开发环境下打印路由信息
    if (process.env.NODE_ENV === 'development') {
      fastify.printRoutes();
    }

    // 初始化WebSocket服务
    const wsService = new WebSocketService(fastify);
    await wsService.initialize();
    
    // 将WebSocket服务实例附加到fastify实例，供路由使用
    (fastify as any).wsService = wsService;
    
    // 将Profit服务实例附加到fastify实例，供路由使用
    (fastify as any).profitService = (global as any).profitServiceInstance;

    // 初始化定时任务
    const schedulerService = new SchedulerService();
    schedulerService.start();

    // 启动服务器
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    const protocol = httpsEnabled ? 'https' : 'http';
    
    await fastify.listen({ port, host });
    logger.info(`🚀 服务器启动成功: ${protocol}://${host}:${port}`);

    // 定期清理WebSocket连接
    setInterval(() => {
      wsService.cleanup();
    }, 5 * 60 * 1000); // 每5分钟清理一次



  } catch (error) {
          logger.error(`服务器启动失败: ${error}`);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
      logger.info(`收到SIGTERM信号，开始优雅关闭...`);
  await fastify.close();
  if (TypeormConnection.isInitialized) {
    await TypeormConnection.destroy();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
      logger.info(`收到SIGINT信号，开始优雅关闭...`);
  await fastify.close();
  if (TypeormConnection.isInitialized) {
    await TypeormConnection.destroy();
  }
  process.exit(0);
});

start();
