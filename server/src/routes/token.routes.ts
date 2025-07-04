import { FastifyInstance, FastifyRequest } from 'fastify';
import { tokenProfitService } from '../services/token-profit.service';
import { logger } from '../utils/logger';

export async function tokenRoutes(fastify: FastifyInstance) {

  // 获取指定链的token统计
  fastify.get('/token/stats/:chain', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Params: { chain: string } }>) => {
    try {
      const { chain } = request.params;
      const stats = tokenProfitService.getChainTokenStats(chain);
      
      
      return { chain, tokens: stats };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取token统计失败');
    }
  });

  // 获取所有链的token统计
  fastify.get('/token/stats', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      const allStats = tokenProfitService.getAllTokenStats();
      const cacheStats = tokenProfitService.getCacheStats();
      
      
      return { 
        tokens: allStats, 
        stats: cacheStats 
      };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取token统计失败');
    }
  });

  // 获取热门token (跨链)
  fastify.get('/token/top', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    },
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>) => {
    try {
      const limit = request.query.limit || 20;
      const topTokens = tokenProfitService.getTopTokens(limit);
      
      
      return { tokens: topTokens, limit };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取热门token失败');
    }
  });

  // 获取token缓存统计信息
  fastify.get('/token/cache-stats', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      const stats = tokenProfitService.getCacheStats();
      
      
      return stats;
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取缓存统计失败');
    }
  });

  // 清理token缓存 (管理员权限)
  fastify.delete('/token/cache', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      tokenProfitService.clearCache();
      
      
      return { success: true, message: 'Token缓存已清理' };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('清理缓存失败');
    }
  });

  // 获取指定token的统计信息
  fastify.get('/token/:chain/:addr', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Params: { chain: string; addr: string } }>) => {
    try {
      const { chain, addr } = request.params;
      const stats = tokenProfitService.getTokenStats(chain, addr);
      
      if (!stats) {
        return { chain, addr, found: false };
      }

      
      return { chain, addr, found: true, stats };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取token详情失败');
    }
  });
} 