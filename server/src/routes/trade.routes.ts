import { FastifyInstance, FastifyRequest } from 'fastify';
import { TradeService } from '../services/trade.service';
import { tradeSearchSchema, TradeSearchRequest } from '../types/trade.types';
import { cacheService } from '../services/cache.service';
import { tokenProfitService } from '../services/token-profit.service';
import { logger } from '../utils/logger';

export async function tradeRoutes(fastify: FastifyInstance) {
  const tradeService = new TradeService();

  // 搜索交易
  fastify.get('/trade/search', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      querystring: tradeSearchSchema
    },
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TradeSearchRequest }>) => {
    try {
      const filters = request.query;
      return await tradeService.searchTrades(filters);
    } catch (error) {
      fastify.log.error(error);
      throw new Error('搜索交易失败');
    }
  });

  // 获取历史数据 - 优先从缓存返回
  fastify.get('/history', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      // 优先从缓存获取
      const cachedTrades = cacheService.getTrades(500);
      const cachedWarnings = cacheService.getWarnings();
      
      // 将warnings的createdAt字段映射为create_at以匹配前端接口
      const mappedWarnings = cachedWarnings.map(warning => ({
        ...warning,
        create_at: warning.createdAt.toISOString()
      }));
      
      // 如果缓存有足够数据，直接返回
      if (cachedTrades.length > 0) {
        return { 
          trades: cachedTrades,
          warnings: mappedWarnings,
        };
      }
      
      // 缓存数据不足，从数据库获取
      const trades = await tradeService.getRecentTrades(500);
      return { 
        trades,
        warnings: mappedWarnings,
      };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取历史数据失败');
    }
  });

  // 获取欢迎页统计
  fastify.get('/welcome', {
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute'
      }
    }
  }, async () => {
    try {
      return await tradeService.getWelcomeStats();
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取统计数据失败');
    }
  });

  // 创建交易（推送端点）- 需要认证但限流更宽松
  fastify.post('/trade', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['chain', 'builder', 'hash'],
        properties: {
          chain: { type: 'string' },
          builder: { type: 'string' },
          hash: { type: 'string' },
          vicHashes: {
            type: 'array',
            items: { type: 'string' }
          },
          gross: { type: 'number' },
          bribe: { type: 'number' },
          income: { type: 'number' },
          txCount: { type: 'number' },
          ratio: { type: 'number' },
          extraInfo: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          incTokens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                addr: { type: 'string' },
                address: { type: 'string' },
                symbol: { type: 'string' }
              },
              required: ['symbol'],
              anyOf: [
                { required: ['addr'] },
                { required: ['address'] }
              ]
            }
          }
        }
      }
    },
    config: {
      rateLimit: {
        max: 2000, // 每分钟2000次推送
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply) => {
    try {
      // 预处理：将address字段转换为addr字段以兼容两种格式
      const tradeData = request.body as any;
      if (tradeData.incTokens && Array.isArray(tradeData.incTokens)) {
        tradeData.incTokens = tradeData.incTokens.map((token: any) => {
          if (token && typeof token === 'object') {
            return {
              addr: token.addr || token.address,  // 优先使用addr，如果没有则使用address
              symbol: token.symbol
            };
          }
          return token;
        });
      }
      
      const trade = await tradeService.createTrade(tradeData);
      
      // 广播到WebSocket客户端
      try {
        const wsService = (fastify as any).wsService;
        if (wsService) {
          // 1. 广播交易
          wsService.broadcastTrade(trade);
          
          // 2. 广播更新后的标签收益统计
          const tagProfits = cacheService.getTagProfitStats(trade.chain);
          wsService.broadcastTagProfits(trade.chain, tagProfits);
          
          // 3. 广播更新后的代币收益统计
          const tokenProfits = tokenProfitService.getChainTokenStats(trade.chain);
          wsService.broadcastTokenProfits(trade.chain, tokenProfits);
          
          // 4. 广播更新后的欢迎页统计数据
          const welcomeStats = await tradeService.getWelcomeStats();
          wsService.broadcastWelcomeStats(welcomeStats);
          
          // 5. 广播更新后的收益数据
          const profitService = (fastify as any).profitService;
          if (profitService) {
            // 直接从内存获取更新后的收益数据，无需重新计算
            const chainProfits = await profitService.getChainProfits();
            const chainProfit = chainProfits.find((p: any) => p.chain === trade.chain);
            if (chainProfit) {
              wsService.broadcastProfit(chainProfit);
            }
          }
        }
      } catch (wsError) {
        logger.warn(`WebSocket广播失败: ${wsError}`);
      }
      
      return { success: true, trade };
    } catch (error: any) {
      logger.error(`创建交易失败: ${error.message} - hash: ${(request.body as any)?.hash}`);
      
      // 如果是重复交易，返回成功避免推送脚本报错
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        logger.warn(`重复交易哈希: ${(request.body as any).hash}`);
        return { success: true, message: '交易已存在' };
      }
      
      throw new Error('创建交易失败');
    }
  });

  // 获取单个交易详情（需要管理员权限）
  fastify.get('/trade/:id', {
    preHandler: [(fastify as any).authenticate],
    config: {
      rateLimit: {
        max: 500,
        timeWindow: '1 minute'
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const user = (request as any).user;
      if (user.type !== 'admin') {
        return reply.code(403).send({ error: '权限不足' });
      }

      const trade = await tradeService.getTradeById(parseInt(request.params.id));
      if (!trade) {
        return reply.code(404).send({ error: '交易不存在' });
      }

      return trade;
    } catch (error) {
      fastify.log.error(error);
      throw new Error('获取交易详情失败');
    }
  });
}