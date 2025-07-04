import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import { loginSchema, LoginRequest } from '../types/auth.types';
import { logger } from '../utils/logger';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();

  // 确保数据库连接后再初始化用户
  fastify.addHook('onReady', async () => {
    try {
      await authService.initializeDefaultUsers();
    } catch (error) {
      logger.error(`初始化默认用户失败: ${error}`);
    }
  });

  // 登录
  fastify.post('/login', {
    schema: {
      body: loginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                username: { type: 'string' },
                type: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    try {
      const { username, password } = request.body;

      const user = await authService.validateUser(username, password);
      if (!user) {
        return reply.code(401).send({ error: '用户名或密码错误' });
      }

      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
        type: user.type
      });

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          type: user.type
        }
      };
    } catch (error) {
      logger.error(`登录处理失败: ${error}`);
      return reply.code(500).send({ error: '登录失败' });
    }
  });

  // 验证token
  fastify.get('/verify', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any) => {
    return { user: request.user };
  });

  // 刷新token
  fastify.post('/refresh', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any) => {
    const token = fastify.jwt.sign({
      id: request.user.id,
      username: request.user.username,
      type: request.user.type
    });

    return { token };
  });

  // 获取用户列表（仅管理员）
  fastify.get('/users', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const users = await authService.listUsers();
      return users;
    } catch (error) {
      logger.error(`获取用户列表失败: ${error}`);
      return reply.code(500).send({ error: '获取用户列表失败' });
    }
  });
}