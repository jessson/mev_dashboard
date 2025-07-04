import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WarningService } from '../services/warning.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

export async function warningRoutes(fastify: FastifyInstance) {
  const warningService = new WarningService();

  // 获取预警列表（需要认证）- 从缓存返回
  fastify.get('/warnings', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      // 直接从缓存返回预警数据
      const warnings = cacheService.getWarnings();
      
      // 将createdAt字段映射为create_at以匹配前端接口
      const mappedWarnings = warnings.map(warning => ({
        ...warning,
        create_at: warning.createdAt.toISOString()
      }));
  
      return mappedWarnings;
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取预警列表失败');
    }
  });

  // 创建预警（推送端点）- 需要认证但限流更宽松
  fastify.post('/warning', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['type', 'msg', 'chain'],
        properties: {
          type: { type: 'string' },
          msg: { type: 'string' },
          chain: { type: 'string' }
        }
      }
    },
    config: {
      rateLimit: {
        max: 2000, // 每分钟2000次预警推送
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { type: string; msg: string; chain: string } 
  }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;


      let { type, msg, chain } = request.body;
      chain = chain.toUpperCase();
      const warning = await warningService.createWarning(type, msg, chain);
      
      // 广播到WebSocket客户端
      try {
        const wsService = (fastify as any).wsService;
        if (wsService) {
          wsService.broadcastWarning(warning);
  
        }
      } catch (wsError) {
        logger.warn(`WebSocket广播预警失败: ${wsError}`);
      }
      
      // 将createdAt字段映射为create_at以匹配前端接口
      const mappedWarning = {
        ...warning,
        create_at: warning.createdAt.toISOString()
      };
      
      return { success: true, warning: mappedWarning };
    } catch (error) {
      logger.error(`创建预警失败: ${error}`);
      throw new Error('创建预警失败');
    }
  });

  // 删除单个预警
  fastify.delete('/warning/:id', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const success = await warningService.deleteWarning(parseInt(request.params.id));
      if (!success) {
        return reply.code(404).send({ error: '预警不存在' });
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('删除预警失败');
    }
  });

  // 批量删除预警
  fastify.delete('/warnings', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        required: ['ids']
      }
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Body: { ids: number[] } }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const deletedCount = await warningService.deleteWarnings(request.body.ids);
      return { deletedCount };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('批量删除预警失败');
    }
  });

  // 获取预警统计
  fastify.get('/warnings/stats', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      return await warningService.getWarningStats();
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取预警统计失败');
    }
  });

  // 清空所有预警
  fastify.delete('/warnings/all', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 10, // 清空操作限制更严格
        timeWindow: '1 minute'
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      await warningService.clearAllWarnings();
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('清空预警失败');
    }
  });
}