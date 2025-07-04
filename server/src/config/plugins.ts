import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';

export async function registerPlugins(fastify: FastifyInstance) {
  // 安全相关 - 先注册helmet但配置更宽松
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  // CORS - 支持生产环境的配置
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // 基础允许的域名
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        'http://localhost:4173', // Vite preview
        'http://127.0.0.1:4173'
      ];

      // 从环境变量获取生产域名
      const productionDomains = process.env.ALLOWED_ORIGINS?.split(',') || [];
      allowedOrigins.push(...productionDomains);

      // 开发环境允许所有来源
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
        return;
      }
      
      // 没有origin的请求（如Postman、服务器间调用）也允许
      if (!origin) {
        callback(null, true);
        return;
      }

      // 生产环境：如果没有配置ALLOWED_ORIGINS，则允许所有HTTPS请求
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
        if (origin.startsWith('https://') || origin.startsWith('http://')) {
          callback(null, true);
          return;
        }
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`❌ CORS拒绝来源: ${origin}`);
        console.log(`✅ 允许的来源: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200 // 对于旧版浏览器
  });

  // 压缩
  await fastify.register(compress);

  // 限流 - 针对不同路由设置不同的限制
  await fastify.register(rateLimit, {
    global: false // 禁用全局限流，使用路由级别限流
  });

  // 为不同的路由组设置不同的限流策略
  fastify.addHook('onRoute', (routeOptions) => {
    const path = routeOptions.url;
    
    // 推送相关的API使用更宽松的限流
    if (path.includes('/trade') || path.includes('/warning') || path.includes('/profit')) {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 1000, // 每分钟1000次请求
          timeWindow: '1 minute'
        }
      };
    }
    // 登录API使用中等限流
    else if (path.includes('/login')) {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 100, // 每分钟100次登录尝试
          timeWindow: '1 minute'
        }
      };
    }
    // 其他API使用默认限流
    else {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 500, // 每分钟500次请求
          timeWindow: '1 minute'
        }
      };
    }
  });

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    sign: {
      expiresIn: '7d'
    }
  });

  // WebSocket
  await fastify.register(websocket);

  // Swagger文档
  if (process.env.NODE_ENV === 'development') {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'MEV监控系统API',
          description: 'MEV交易监控系统后端API文档',
          version: '1.0.0'
        },
        host: 'localhost:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        }
      }
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    });
  }

  // 认证装饰器
  fastify.decorate('authenticate', async function(request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: '未授权访问' });
    }
  });

  // 添加预检请求处理
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      reply
        .header('Access-Control-Allow-Origin', request.headers.origin || '*')
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        .header('Access-Control-Allow-Credentials', 'true')
        .code(200)
        .send();
    }
  });
}