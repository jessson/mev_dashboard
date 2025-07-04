import { FastifyInstance } from 'fastify';
import { authRoutes } from '../routes/auth.routes';
import { tradeRoutes } from '../routes/trade.routes';
import { profitRoutes } from '../routes/profit.routes';
import { warningRoutes } from '../routes/warning.routes';
import { tagRoutes } from '../routes/tag.routes';
import { chainRoutes } from '../routes/chain.routes';
import { tokenRoutes } from '../routes/token.routes';
import nodeRoutes from '../routes/node.routes';
import { logger } from '../utils/logger';

export async function registerRoutes(fastify: FastifyInstance) {
  // 健康检查
  fastify.get('/api/health', async () => {
    logger.info(`健康检查请求`);
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: '服务器运行正常'
    };
  });

  // 根路径
  fastify.get('/', async () => {
    return { 
      message: 'MEV监控系统API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        login: '/api/login',
        docs: '/docs'
      }
    };
  });

  // 注册API路由
  logger.info(`注册认证路由...`);
  await fastify.register(authRoutes, { prefix: '/api' });
  
  logger.info(`注册交易路由...`);
  await fastify.register(tradeRoutes, { prefix: '/api' });
  
  logger.info(`注册收益路由...`);
  await fastify.register(profitRoutes, { prefix: '/api' });
  
  logger.info(`注册预警路由...`);
  await fastify.register(warningRoutes, { prefix: '/api' });
  
  logger.info(`注册标签路由...`);
  await fastify.register(tagRoutes, { prefix: '/api' });
  
  logger.info(`注册链路由...`);
  await fastify.register(chainRoutes, { prefix: '/api' });
  
  logger.info(`注册Token路由...`);
  await fastify.register(tokenRoutes, { prefix: '/api' });
  
  logger.info(`注册节点路由...`);
  await fastify.register(nodeRoutes, { prefix: '/api' });

  logger.info(`所有路由注册完成`);
}