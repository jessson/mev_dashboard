import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import {
  getAllowedOrigins,
  getJwtSecret,
  isOriginAllowedForRequest,
  isWriteRoleAllowed,
} from '../utils/security';

export async function registerPlugins(fastify: FastifyInstance<any>) {
  // 安全相关 - 先注册helmet但配置更宽松
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  // CORS - 支持生产环境的配置
  await fastify.register(cors, {
    delegator: (req, callback) => {
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      const forwardedHost = req.headers['x-forwarded-host'];
      const forwardedProto = req.headers['x-forwarded-proto'];
      const allowed = isOriginAllowedForRequest(origin, forwardedHost, forwardedProto);

      if (!allowed) {
        console.log(`❌ CORS拒绝来源: ${origin}`);
        console.log(`✅ 允许的来源: ${getAllowedOrigins().join(', ')}`);
        console.log(`🔁 转发主机: ${forwardedHost ?? ''}`);
        console.log(`🔁 转发协议: ${forwardedProto ?? ''}`);
        callback(new Error('Not allowed by CORS'));
        return;
      }

      callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        optionsSuccessStatus: 200,
      });
    },
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
    secret: getJwtSecret(),
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
      return reply.code(401).send({ error: '未授权访问' });
    }
  });

  fastify.decorate('requireWriteAccess', async function(request: any, reply: any) {
    try {
      await request.jwtVerify();
      const role = request.user?.type;

      if (!isWriteRoleAllowed(role)) {
        return reply.code(403).send({ error: '权限不足' });
      }
    } catch (err) {
      return reply.code(401).send({ error: '未授权访问' });
    }
  });
}
