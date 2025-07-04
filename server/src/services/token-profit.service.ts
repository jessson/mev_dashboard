import { logger } from '../utils/logger';
import { TokenInfo, TokenProfitInfo } from '../types/trade.types';
import { cacheService } from './cache.service';

export class TokenProfitService {
  private static instance: TokenProfitService;

  private constructor() {}

  public static getInstance(): TokenProfitService {
    if (!TokenProfitService.instance) {
      TokenProfitService.instance = new TokenProfitService();
    }
    return TokenProfitService.instance;
  }

  /**
   * 初始化服务（不再需要独立的定时任务，使用CacheService统一管理）
   */
  public initialize(): void {
    logger.info(`TokenProfitService 初始化完成，使用CacheService统一管理Token缓存`);
  }

  /**
   * 添加交易数据，更新token统计（代理到CacheService）
   */
  public addTradeTokens(chain: string, tokens: TokenInfo[], income: number): void {
    cacheService.addTradeTokens(chain, tokens, income);
  }

  /**
   * 获取指定链的token统计（代理到CacheService）
   */
  public getChainTokenStats(chain: string): TokenProfitInfo[] {
    return cacheService.getChainTokenStats(chain);
  }

  /**
   * 获取所有token统计（代理到CacheService）
   */
  public getAllTokenStats(): { [chain: string]: TokenProfitInfo[] } {
    return cacheService.getAllTokenStats();
  }

  /**
   * 获取热门token (跨链)（代理到CacheService）
   */
  public getTopTokens(limit: number = 20): TokenProfitInfo[] {
    return cacheService.getTopTokens(limit);
  }

  /**
   * 清零每日缓存（代理到CacheService）
   */
  public clearDailyCache(): void {
    cacheService.clearTokenProfitCache();
  }

  /**
   * 获取缓存统计信息（代理到CacheService）
   */
  public getCacheStats(): {
    totalTokens: number;
    totalChains: number;
    cacheSize: number;
  } {
    return cacheService.getTokenCacheStats();
  }

  /**
   * 手动清理缓存 (用于测试)（代理到CacheService）
   */
  public clearCache(): void {
    cacheService.clearTokenProfitCache();
  }

  /**
   * 获取指定token的统计信息（代理到CacheService）
   */
  public getTokenStats(chain: string, addr: string): TokenProfitInfo | null {
    return cacheService.getTokenStats(chain, addr);
  }
}

// 导出单例实例
export const tokenProfitService = TokenProfitService.getInstance(); 