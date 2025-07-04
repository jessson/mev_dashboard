import { FastifyInstance, FastifyRequest } from 'fastify';
import { TagService } from '../services/tag.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

export async function tagRoutes(fastify: FastifyInstance) {
  const tagService = new TagService();

  // 获取标签每日收益 - 优先从缓存返回
  fastify.get('/tag/daily-profit', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{ 
    Querystring: { chain?: string; date?: string } 
  }>) => {
    try {
      const { chain, date } = request.query;
      
      // 直接从缓存获取标签收益数据
      const tagProfits = cacheService.getTagProfits(chain, date);
      
      // 转换格式以匹配前端期望，包含交易数量
      const result = tagProfits.map(tp => ({
        chain: tp.chain,
        tag: tp.tag,
        totalProfit: tp.totalProfit, // 注意字段名转换
        txCount: tp.txCount
      }));
      

      return result;
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取标签收益失败');
    }
  });

  // 获取标签收益统计
  fastify.get('/tag/stats', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{ 
    Querystring: { chain?: string } 
  }>) => {
    try {
      const { chain } = request.query;
      
      if (chain) {
        return await tagService.getTagProfitStats(chain);
      } else {
        return await tagService.getAllTagProfitStats();
      }
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取标签统计失败');
    }
  });

  // 获取热门标签排行榜
  fastify.get('/tag/top', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{ 
    Querystring: { limit?: number } 
  }>) => {
    try {
      const { limit = 10 } = request.query;
      return await tagService.getTopTags(Number(limit));
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取热门标签失败');
    }
  });

  // 获取标签收益趋势
  fastify.get('/tag/trend/:tag', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: FastifyRequest<{ 
    Params: { tag: string };
    Querystring: { chain?: string } 
  }>) => {
    try {
      const { tag } = request.params;
      const { chain } = request.query;
      
      return await tagService.getTagProfitTrend(tag, chain);
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取标签趋势失败');
    }
  });

  // 更新标签收益（需要管理员权限）
  fastify.post('/tag/profit', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['chain', 'tag', 'profit'],
        properties: {
          chain: { type: 'string' },
          tag: { type: 'string' },
          profit: { type: 'number' },
          txCount: { type: 'number' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { chain: string; tag: string; profit: number; txCount?: number } 
  }>, reply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const { chain, tag, profit, txCount = 1 } = request.body;
      await tagService.updateTagProfit(chain, tag, profit, txCount);
      
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('更新标签收益失败');
    }
  });

  // 批量更新标签收益（需要管理员权限）
  fastify.post('/tag/profit/batch', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'array',
        items: {
          type: 'object',
          required: ['chain', 'tag', 'profit'],
          properties: {
            chain: { type: 'string' },
            tag: { type: 'string' },
            profit: { type: 'number' },
            txCount: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: Array<{ chain: string; tag: string; profit: number; txCount?: number }>
  }>, reply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      await tagService.batchUpdateTagProfits(request.body);
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('批量更新标签收益失败');
    }
  });
}