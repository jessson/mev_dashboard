import { TypeormConnection } from '../config/database';
import { TradeInfo } from '../entities/TradeInfo';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TradeSearchFilters } from '../types/trade.types';
import { chainService } from '../config/chains';
import { cacheService } from '../services/cache.service';

import { TagService } from '../services/tag.service';
import { ProfitService } from '../services/profit.service';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

export class TradeService {
  private tradeRepository: Repository<TradeInfo>;
  private tagService: TagService;
  private profitService: ProfitService;

  constructor() {
    this.tradeRepository = TypeormConnection.getRepository(TradeInfo);
    this.tagService = new TagService();
    this.profitService = new ProfitService();
  }

  async createTrade(tradeData: Partial<TradeInfo>): Promise<TradeInfo> {
    // 验证链是否启用
    tradeData.chain = tradeData.chain?.toUpperCase() || '';
    if (tradeData.chain && !chainService.isChainEnabled(tradeData.chain)) {
      throw new Error(`Chain ${tradeData.chain} is not enabled`);
    }
    
    const trade = this.tradeRepository.create(tradeData);
    trade.txCount = cacheService.getChainTxCount(trade.chain);
    const savedTrade = await this.tradeRepository.save(trade);

    // 添加到缓存
    cacheService.addTrade({
      chain: savedTrade.chain,
      builder: savedTrade.builder,
      hash: savedTrade.hash,
      vicHashes: savedTrade.vicHashes || [],
      gross: savedTrade.gross,
      bribe: savedTrade.bribe,
      income: savedTrade.income,
      txCount: savedTrade.txCount,
      ratio: savedTrade.ratio,
      extraInfo: savedTrade.extraInfo || '',
      tags: savedTrade.tags || [],
      incTokens: savedTrade.incTokens || [],
      createdAt: savedTrade.createdAt
    });

    // token统计已经在cacheService.addTrade中处理了

    // 更新标签统计
    if (savedTrade.tags && savedTrade.tags.length > 0) {
      for (const tag of savedTrade.tags) {
        await this.tagService.updateTagProfit(savedTrade.chain, tag, savedTrade.income, 1);
      }
      logger.debug(`更新标签统计: ${savedTrade.chain} - ${savedTrade.tags.length}个标签`);
    }

    logger.info(`创建交易: ${savedTrade.chain} - ${savedTrade.hash} - $${savedTrade.income.toFixed(4)}`);
    return savedTrade;
  }

  async getTradeById(id: number): Promise<TradeInfo | null> {
    return await this.tradeRepository.findOne({ where: { id } });
  }

  async getTradeByHash(hash: string): Promise<TradeInfo | null> {
    // 先从缓存查找
    const cachedTrade = cacheService.getTradeByHash(hash);
    if (cachedTrade) {
      return cachedTrade as TradeInfo;
    }
    
    // 缓存中没有，从数据库查找
    return await this.tradeRepository.findOne({ where: { hash } });
  }

  async searchTrades(filters: TradeSearchFilters): Promise<TradeInfo[]> {
    // 直接从数据库查询，确保排序正确
    let query: SelectQueryBuilder<TradeInfo> = this.tradeRepository
      .createQueryBuilder('trade')
      .limit(filters.limit || 500);

    // 链过滤 - 验证链是否启用
    if (filters.chain) {
      if (!chainService.isChainEnabled(filters.chain)) {
        throw new Error(`Chain ${filters.chain} is not enabled`);
      }
      query = query.andWhere('trade.chain = :chain', { chain: filters.chain });
    } else {
      // 如果没有指定链，只返回启用链的数据
      const enabledChainIds = chainService.getChainIds();
      if (enabledChainIds.length > 0) {
        query = query.andWhere('trade.chain IN (:...chains)', { chains: enabledChainIds });
      }
    }

    // 关键字搜索
    if (filters.keyword) {
      query = query.andWhere(
        '(trade.hash LIKE :keyword OR trade.builder LIKE :keyword)',
        { keyword: `%${filters.keyword}%` }
      );
    }

    // 标签过滤
    if (filters.tag) {
      query = query.andWhere('trade.tags LIKE :tag', { tag: `%${filters.tag}%` });
    }

    // 时间范围过滤
    if (filters.start) {
      query = query.andWhere('DATE(trade.createdAt) >= :start', { start: filters.start });
    }
    if (filters.end) {
      query = query.andWhere('DATE(trade.createdAt) <= :end', { end: filters.end });
    }

    // 修复排序 - 确保大小写正确
    if (filters.sort) {
      // 将小写的order转换为大写
      const orderDirection = (filters.order || 'desc').toUpperCase() as 'ASC' | 'DESC';
      
      logger.info(`应用排序: ${filters.sort} ${orderDirection}`);
      
      // 验证排序字段
      const validSortFields = ['createdAt', 'income', 'gross', 'bribe', 'ratio', 'txCount'];
      if (validSortFields.includes(filters.sort)) {
        query = query.orderBy(`trade.${filters.sort}`, orderDirection);
      } else {
        // 默认按创建时间排序
        query = query.orderBy('trade.createdAt', 'DESC');
      }
    } else {
      // 默认排序
      query = query.orderBy('trade.createdAt', 'DESC');
    }

    const results = await query.getMany();
    logger.info(`从数据库返回搜索结果: ${results.length} 条，排序: ${filters.sort || 'createdAt'} ${filters.order || 'desc'}`);
    return results;
  }

  async getRecentTrades(limit: number = 500): Promise<TradeInfo[]> {
    // 优先从缓存获取
    const cachedTrades = cacheService.getTrades(limit);
    if (cachedTrades.length >= Math.min(limit, 100)) { // 如果缓存有足够数据
      logger.info(`从缓存返回最近交易: ${cachedTrades.length} 条`);
      return cachedTrades as TradeInfo[];
    }

    // 缓存数据不足，从数据库获取
    const enabledChainIds = chainService.getChainIds();
    
    if (enabledChainIds.length === 0) {
      return [];
    }

    const trades = await this.tradeRepository.find({
      where: enabledChainIds.map(chain => ({ chain })),
      order: { createdAt: 'DESC' },
      take: limit
    });

    // 将数据库结果添加到缓存
    trades.forEach(trade => {
      if (!cacheService.getTradeByHash(trade.hash)) {
        cacheService.addTrade({
          chain: trade.chain,
          builder: trade.builder,
          hash: trade.hash,
          vicHashes: trade.vicHashes || [],
          gross: trade.gross,
          bribe: trade.bribe,
          income: trade.income,
          txCount: trade.txCount,
          ratio: trade.ratio,
          extraInfo: trade.extraInfo || '',
          tags: trade.tags || [],
          incTokens: trade.incTokens || [],
          createdAt: trade.createdAt
        });
      }
    });

    logger.info(`从数据库返回最近交易: ${trades.length} 条`);
    return trades;
  }

  async getTradesByChain(chain: string, limit: number = 100): Promise<TradeInfo[]> {
    // 验证链是否启用
    if (!chainService.isChainEnabled(chain)) {
      throw new Error(`Chain ${chain} is not enabled`);
    }

    // 优先从缓存获取
    const cachedTrades = cacheService.getTradesByChain(chain, limit);
    if (cachedTrades.length >= Math.min(limit, 50)) {
      logger.info(`从缓存返回链交易: ${chain} - ${cachedTrades.length} 条`);
      return cachedTrades as TradeInfo[];
    }

    // 从数据库获取
    const trades = await this.tradeRepository.find({
      where: { chain },
      order: { createdAt: 'DESC' },
      take: limit
    });

    logger.info(`从数据库返回链交易: ${chain} - ${trades.length} 条`);
    return trades;
  }

  async updateTrade(id: number, updateData: Partial<TradeInfo>): Promise<TradeInfo | null> {
    // 如果更新链信息，验证链是否启用
    if (updateData.chain && !chainService.isChainEnabled(updateData.chain)) {
      throw new Error(`Chain ${updateData.chain} is not enabled`);
    }

    await this.tradeRepository.update(id, updateData);
    return await this.getTradeById(id);
  }

  async deleteTrade(id: number): Promise<boolean> {
    const result = await this.tradeRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async getWelcomeStats(): Promise<Array<{ chain: string; income: number; txCount: number }>> {
    // 直接复用profit的today数据，简单高效
    try {
      const chainProfitSummaries = cacheService.getChainProfitSummaries();
      
      if (chainProfitSummaries.length > 0) {
        const stats = chainProfitSummaries.map(summary => ({
          chain: summary.chain,
          income: summary.today.income,
          txCount: summary.today.txCount
        }));
        
        logger.info(`从profit缓存返回欢迎统计: ${stats.length} 个链`);
        return stats;
      }

      // 如果profit缓存为空，从当前缓存计算今日统计
      const enabledChainIds = chainService.getChainIds();
      const stats: Array<{ chain: string; income: number; txCount: number }> = [];
      
      for (const chainId of enabledChainIds) {
        const chainTrades = cacheService.getTradesByChain(chainId);
        if (chainTrades.length > 0) {
          const income = chainTrades.reduce((sum, trade) => sum + (trade.income || 0), 0);
          const txCount = chainTrades.length;
          stats.push({ chain: chainId, income, txCount });
        }
      }

      logger.info(`从交易缓存计算欢迎统计: ${stats.length} 个链`);
      return stats;
      
    } catch (error) {
      logger.error(`获取欢迎统计失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取交易统计信息（用于数据清理监控）
   */
  async getTradeStats(): Promise<{
    total: number;
    last24Hours: number;
    lastWeek: number;
    oldestTrade: string | null;
    newestTrade: string | null;
  }> {
    const total = await this.tradeRepository.count();
    
    const now = dayjs();
    const last24Hours = await this.tradeRepository.count({
      where: {
        createdAt: dayjs().subtract(24, 'hours').toDate() as any
      }
    });

    const lastWeek = await this.tradeRepository.count({
      where: {
        createdAt: dayjs().subtract(7, 'days').toDate() as any
      }
    });

    let oldestTrade = null;
    let newestTrade = null;

    if (total > 0) {
      const oldest = await this.tradeRepository.findOne({
        order: { createdAt: 'ASC' }
      });
      const newest = await this.tradeRepository.findOne({
        order: { createdAt: 'DESC' }
      });

      oldestTrade = oldest ? dayjs(oldest.createdAt).format('YYYY-MM-DD HH:mm:ss') : null;
      newestTrade = newest ? dayjs(newest.createdAt).format('YYYY-MM-DD HH:mm:ss') : null;
    }

    return {
      total,
      last24Hours,
      lastWeek,
      oldestTrade,
      newestTrade
    };
  }
}