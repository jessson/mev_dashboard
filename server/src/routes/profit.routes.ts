import { FastifyInstance } from 'fastify';
import { ProfitService } from '../services/profit.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

export async function profitRoutes(fastify: FastifyInstance) {
  const profitService = new ProfitService();

  // 获取收益统计 - 优化缓存使用
  fastify.get('/profit', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      const result = await profitService.getChainProfits();
      return result;
    } catch (error) {
      logger.error(`获取收益统计失败: ${error}`);
      throw new Error('获取收益统计失败');
    }
  });

  // 手动触发收益计算（管理员功能）
  fastify.post('/profit/calculate', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request: any, reply) => {
    try {
      const user = request.user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      await profitService.updateTodayProfits();
      
      return { success: true, message: '收益计算完成' };
    } catch (error) {
      logger.error(`手动收益计算失败: ${error}`);
      throw new Error('收益计算失败');
    }
  });



  // 获取收益趋势数据
  fastify.get('/profit/trend/:chain', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any) => {
    try {
      let { chain } = request.params;
      chain = chain?.toUpperCase();
      const { days = 30 } = request.query;
      
      const trend = await profitService.getProfitTrend(chain, parseInt(days));
      return trend;
    } catch (error) {
      logger.error(`获取收益趋势失败: ${error}`);
      throw new Error('获取收益趋势失败');
    }
  });
}