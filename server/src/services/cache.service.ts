import { logger } from '../utils/logger';
import dayjs from 'dayjs';
import { TypeormConnection } from '../config/database';
import { TradeInfo as TradeEntity } from '../entities/TradeInfo';
import { Between } from 'typeorm';

import * as cron from 'node-cron';

// 交易信息接口
interface TradeInfo {
  id: number;
  chain: string;
  builder: string;
  hash: string;
  vicHashes: string[];
  gross: number;
  bribe: number;
  income: number;
  txCount: number;
  ratio: number;
  extraInfo: string;
  tags: string[];
  incTokens?: { addr: string; symbol: string }[];
  createdAt: Date;
}

// 预警信息接口
interface WarningInfo {
  id: number;
  type: string;
  msg: string;
  chain: string;
  createdAt: Date;
}

// Top信息接口
interface PoolInfo {
  symbol: string;
  address: string;
  counter: number;
}

interface BuilderInfo {
  name: string;
  address: string;
  counter: number;
}

interface TopInfo {
  chain: string;
  pools: PoolInfo[];
  builders: BuilderInfo[];
  updatedAt: Date;
}

// 标签收益信息接口
interface TagProfitInfo {
  chain: string;
  tag: string;
  totalProfit: number;
  txCount: number;
  date: string;
}

// 收益缓存信息接口
interface ProfitCacheInfo {
  chain: string;
  date: string;
  income: number;
  gross: number;
  txCount: number;
  calculatedAt: Date;
}

// 链收益汇总接口 - 完整的收益统计信息
interface ChainProfitSummary {
  chain: string;
  today: { income: number; gross: number; txCount: number };
  yesterday: { income: number; gross: number; txCount: number };
  thisWeek: { income: number; gross: number; txCount: number };
  lastWeek: { income: number; gross: number; txCount: number };
  thisMonth: { income: number; gross: number; txCount: number };
  lastMonth: { income: number; gross: number; txCount: number };
  updatedAt: Date;
}

interface TokenProfitInfo {
  addr: string;
  symbol: string;
  count: number;
  totalProfit: number;
}

export class CacheService {
  private static instance: CacheService;
  
  // 交易信息缓存 - 最近500条
  private trades: TradeInfo[] = [];
  private readonly MAX_TRADES = 500;
  
  // 预警信息缓存 - 最近100条
  private warnings: WarningInfo[] = [];
  private readonly MAX_WARNINGS = 100;
  
  // 标签收益缓存 - 每天0点清零
  private tagProfits: Map<string, TagProfitInfo[]> = new Map();
  private lastTagProfitResetDate: string = '';
  
  // 收益缓存 - 小于1周的数据通过trade信息生成并缓存
  private profitCache: Map<string, ProfitCacheInfo[]> = new Map();
  
  // 链收益汇总缓存 - 实时更新的完整收益统计
  private chainProfits: Map<string, ChainProfitSummary> = new Map();
  
  // 链交易序号计数器 - 每天0点清零
  private chainTxCounters: Map<string, number> = new Map();
  
  // Token收益统计缓存 - 每天0点清零
  private tokenProfitCache: Map<string, TokenProfitInfo> = new Map();
  
  // 自增ID计数器
  private warningIdCounter = 1;

  private constructor() {
    // 初始化重置日期，但不设置定时任务（由SchedulerService统一管理）
    this.lastTagProfitResetDate = dayjs().format('YYYY-MM-DD');
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // 每日缓存重置（由SchedulerService调用）
  resetDailyCache(): void {
    const currentDate = dayjs().format('YYYY-MM-DD');
    const previousTradeCount = this.trades.length;
    const previousTagProfitsCount = Array.from(this.tagProfits.values()).reduce((sum, tags) => sum + tags.length, 0);
    const previousTokenProfitCount = this.tokenProfitCache.size;
    
    // 清零交易缓存
    this.trades = [];
    
    // 清零标签收益缓存
    this.tagProfits.clear();
    this.lastTagProfitResetDate = currentDate;
    
    // 清零Token收益统计缓存
    this.tokenProfitCache.clear();
    
    // 清零链交易计数器
    this.chainTxCounters.clear();
    
    // 重新计算链收益汇总（从数据库统计）
    this.rebuildChainProfitsFromDatabase();
    
    logger.info(`每日缓存重置完成 - 清理了${previousTradeCount}条交易, ${previousTagProfitsCount}个标签收益统计, ${previousTokenProfitCount}个Token收益统计`);
    logger.info(`新的一天开始，缓存已重置，正在重建收益汇总...`);
  }



  /**
   * 服务启动时初始化缓存数据
   * 从数据库加载当日的trade数据进行缓存
   */
  async initializeFromDatabase(): Promise<void> {
    try {
      if (!TypeormConnection.isInitialized) {
        logger.warn(`数据库连接未初始化，跳过缓存初始化`);
        return;
      }

      logger.info(`开始从数据库初始化缓存数据...`);
      
      const tradeRepository = TypeormConnection.getRepository(TradeEntity);
      const today = dayjs().startOf('day').toDate();
      const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();

      // 加载当日的所有交易数据
      const todayTrades = await tradeRepository.find({
        where: {
          createdAt: Between(today, tomorrow)
        },
        order: {
          createdAt: 'DESC'
        }
      });

      logger.info(`从数据库加载了 ${todayTrades.length} 条当日交易记录`);

      // 将数据库中的交易转换为缓存格式并添加到缓存
      for (const trade of todayTrades) {
        trade.chain = trade.chain.toUpperCase();
        this.trades.push(trade);

        // 更新标签收益缓存
        if (trade.tags && trade.tags.length > 0 && trade.income > 0) {
          trade.tags.forEach(tag => {
            this.updateTagProfit(trade.chain, tag, trade.income, 1);
          });
        }

        // 更新代币收益统计
        if (trade.incTokens && trade.incTokens.length > 0) {
          try {
            this.addTradeTokens(trade.chain, trade.incTokens, trade.income);
            logger.debug(`添加代币收益统计: ${trade.chain} - ${trade.incTokens.length}个代币, 收益: ${trade.income}`);
          } catch (error) {
            logger.error(`更新代币收益统计失败: ${error}`);
          }
        }

        // 更新链收益汇总
        this.updateChainProfitSummary(trade);
      }

      // 确保trades按时间倒序排列
      this.trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 保持最多MAX_TRADES条记录
      if (this.trades.length > this.MAX_TRADES) {
        this.trades = this.trades.slice(0, this.MAX_TRADES);
      }

      // 从数据库重建链收益汇总缓存
      await this.rebuildChainProfitsFromDatabase();

      // 初始化链交易计数器
      await this.initializeChainTxCounters();

      logger.info(`缓存初始化完成: ${this.trades.length} 条交易, ${this.tagProfits.size} 个标签收益统计, ${this.chainProfits.size} 个链收益汇总, 链交易计数器: ${Object.fromEntries(this.chainTxCounters)}`);

    } catch (error) {
      logger.error(`缓存初始化失败: ${error}`);
      // 初始化失败不应该影响服务启动，所以只记录错误
    }
  }

  // ==================== 交易管理 ====================
  
  getChainTxCount(chain: string): number {
    const currentCounter = this.chainTxCounters.get(chain) || 0;
    const newCounter = currentCounter + 1;
    this.chainTxCounters.set(chain, newCounter);
    return newCounter;
  }

  /**
   * 清零所有链的交易计数器
   */
  clearAllChainTxCounters(): void {
    this.chainTxCounters.clear();
    logger.info(`已清零所有链的交易计数器`);
  }

  /**
   * 添加交易信息
   */
  addTrade(trade: Omit<TradeInfo, 'id'>): TradeInfo {
    // 检查是否已存在相同哈希的交易
    const existingTrade = this.trades.find(t => t.hash === trade.hash);
    if (existingTrade) {
      logger.debug(`交易已存在于缓存: ${trade.hash.slice(0, 10)}...`);
      return existingTrade;
    }

    const tradeWithId: TradeInfo = {
      ...trade,
      id: trade.txCount,
    };

    this.trades.unshift(tradeWithId); // 添加到开头

    // 保持最多500条记录
    if (this.trades.length > this.MAX_TRADES) {
      this.trades = this.trades.slice(0, this.MAX_TRADES);
    }

    // 更新标签收益缓存
    if (trade.tags && trade.tags.length > 0 && trade.income > 0) {
      trade.tags.forEach(tag => {
        this.updateTagProfit(trade.chain, tag, trade.income, 1);
      });
    }

    // 更新代币收益统计
    if (trade.incTokens && trade.incTokens.length > 0 && trade.income > 0) {
      try {
        this.addTradeTokens(trade.chain, trade.incTokens, trade.income);
        logger.debug(`更新代币收益统计: ${trade.chain} - ${trade.incTokens.length}个代币, 收益: ${trade.income}`);
      } catch (error) {
        logger.error(`添加代币收益统计失败: ${error}`);
      }
    }

    // 实时更新链收益汇总
    this.updateChainProfitSummary(tradeWithId);

    logger.info(`添加交易缓存: ${trade.chain} - ${trade.hash.slice(0, 10)}... - $${trade.income.toFixed(4)}`);
    return tradeWithId;
  }

  /**
   * 获取所有交易信息
   */
  getTrades(limit?: number): TradeInfo[] {
    if (limit) {
      return this.trades.slice(0, limit);
    }
    return [...this.trades];
  }

  /**
   * 根据链获取交易信息
   */
  getTradesByChain(chain: string, limit?: number): TradeInfo[] {
    const filtered = this.trades.filter(t => t.chain === chain);
    if (limit) {
      return filtered.slice(0, limit);
    }
    return filtered;
  }

  /**
   * 根据哈希查找交易
   */
  getTradeByHash(hash: string): TradeInfo | null {
    return this.trades.find(t => t.hash === hash) || null;
  }

  /**
   * 搜索交易
   */
  searchTrades(filters: {
    chain?: string;
    keyword?: string;
    tag?: string;
    limit?: number;
  }): TradeInfo[] {
    let filtered = [...this.trades];

    if (filters.chain) {
      filtered = filtered.filter(t => t.chain === filters.chain);
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      filtered = filtered.filter(t => 
        t.hash.toLowerCase().includes(keyword) ||
        t.builder.toLowerCase().includes(keyword)
      );
    }

    if (filters.tag) {
      const tag = filters.tag.toLowerCase();
      filtered = filtered.filter(t => 
        t.tags?.some(tg => tg.toLowerCase().includes(tag))
      );
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  // ==================== 预警管理 ====================
  
  /**
   * 添加预警信息
   */
  addWarning(type: string, msg: string, chain: string): WarningInfo {
    const warning: WarningInfo = {
      id: this.warningIdCounter++,
      type,
      msg,
      chain,
      createdAt: new Date()
    };

    this.warnings.unshift(warning); // 添加到开头

    // 保持最多100条记录
    if (this.warnings.length > this.MAX_WARNINGS) {
      this.warnings = this.warnings.slice(0, this.MAX_WARNINGS);
    }

    logger.info(`添加预警: ${chain} - ${type}`);
    return warning;
  }

  /**
   * 获取所有预警信息
   */
  getWarnings(): WarningInfo[] {
    return [...this.warnings];
  }

  /**
   * 根据链获取预警信息
   */
  getWarningsByChain(chain: string): WarningInfo[] {
    return this.warnings.filter(w => w.chain === chain);
  }

  /**
   * 删除预警信息
   */
  deleteWarning(id: number): boolean {
    const index = this.warnings.findIndex(w => w.id === id);
    if (index !== -1) {
      this.warnings.splice(index, 1);
      logger.info(`删除预警: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * 批量删除预警信息
   */
  deleteWarnings(ids: number[]): number {
    let deletedCount = 0;
    ids.forEach(id => {
      if (this.deleteWarning(id)) {
        deletedCount++;
      }
    });
    return deletedCount;
  }

  /**
   * 清空所有预警
   */
  clearWarnings(): void {
    this.warnings = [];
    logger.info(`清空所有预警信息`);
  }


  // ==================== 标签收益管理 ====================
  
  /**
   * 更新标签收益
   */
  updateTagProfit(chain: string, tag: string, profit: number, txCount: number = 1): void {
    const today = dayjs().format('YYYY-MM-DD');
    const key = `${chain}-${today}`;
    
    if (!this.tagProfits.has(key)) {
      this.tagProfits.set(key, []);
    }
    
    const chainTagProfits = this.tagProfits.get(key)!;
    const existingIndex = chainTagProfits.findIndex(tp => tp.tag === tag);
    
    if (existingIndex !== -1) {
      // 更新现有标签收益
      chainTagProfits[existingIndex].totalProfit += profit;
      chainTagProfits[existingIndex].txCount += txCount;
    } else {
      // 添加新标签收益
      chainTagProfits.push({
        chain,
        tag,
        totalProfit: profit,
        txCount,
        date: today
      });
    }
    
    logger.debug(`更新标签收益: ${chain} - ${tag} - $${profit.toFixed(4)}`);
  }

  /**
   * 获取标签收益
   */
  getTagProfits(chain?: string, date?: string): TagProfitInfo[] {
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    if (chain) {
      const key = `${chain}-${targetDate}`;
      return this.tagProfits.get(key) || [];
    }
    
    // 返回所有链的标签收益
    const allTagProfits: TagProfitInfo[] = [];
    for (const [key, tagProfits] of this.tagProfits.entries()) {
      if (key.endsWith(`-${targetDate}`)) {
        allTagProfits.push(...tagProfits);
      }
    }
    
    return allTagProfits;
  }

  /**
   * 获取标签收益统计
   */
  getTagProfitStats(chain: string): { tag: string; totalProfit: number; txCount: number }[] {
    const tagProfits = this.getTagProfits(chain);
    
    // 按标签聚合
    const stats = new Map<string, { totalProfit: number; txCount: number }>();
    
    tagProfits.forEach(tp => {
      if (stats.has(tp.tag)) {
        const existing = stats.get(tp.tag)!;
        existing.totalProfit += tp.totalProfit;
        existing.txCount += tp.txCount;
      } else {
        stats.set(tp.tag, {
          totalProfit: tp.totalProfit,
          txCount: tp.txCount
        });
      }
    });
    
    return Array.from(stats.entries()).map(([tag, data]) => ({
      tag,
      ...data
    })).sort((a, b) => b.totalProfit - a.totalProfit);
  }

  // ==================== 链交易计数器管理 ====================

  /**
   * 初始化链交易计数器
   * 从今天的交易中统计各链当前最大txCount作为初始值
   */
  private async initializeChainTxCounters(): Promise<void> {
    try {
      // 检查数据库连接是否已初始化
      if (!TypeormConnection.isInitialized) {
        logger.warn(`数据库连接未初始化，跳过链交易计数器初始化`);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const tradeRepository = TypeormConnection.getRepository(TradeEntity);
      const { MoreThanOrEqual } = require('typeorm');

      // 查询今天的所有交易
      const todayTrades = await tradeRepository.find({
        where: {
          createdAt: MoreThanOrEqual(new Date(today))
        },
        select: ['chain', 'txCount']
      });

      // 按链统计最大txCount
      const chainMaxTxCount = new Map<string, number>();
      todayTrades.forEach((trade: any) => {
        const currentMax = chainMaxTxCount.get(trade.chain) || 0;
        if (trade.txCount > currentMax) {
          chainMaxTxCount.set(trade.chain, trade.txCount);
        }
      });

      // 初始化计数器
      this.chainTxCounters.clear();
      chainMaxTxCount.forEach((maxCount, chain) => {
        this.chainTxCounters.set(chain, maxCount);
      });

      logger.info(`链交易计数器初始化完成: ${JSON.stringify(Object.fromEntries(this.chainTxCounters))}`);
    } catch (error) {
      logger.error(`初始化链交易计数器失败: ${error}`);
    }
  }

  // ==================== 链收益汇总管理 ====================
  
  /**
   * 从数据库重新构建链收益汇总缓存
   */
  async rebuildChainProfitsFromDatabase(): Promise<void> {
    try {
      if (!TypeormConnection.isInitialized) {
        logger.warn(`数据库连接未初始化，跳过链收益汇总重建`);
        return;
      }

      logger.info(`开始重新构建链收益汇总缓存...`);
      
      const tradeRepository = TypeormConnection.getRepository(TradeEntity);
      const now = dayjs();

      // 清空现有缓存
      this.chainProfits.clear();

      // 获取启用的链配置
      const { chainService } = await import('../config/chains');
      const enabledChains = chainService.getEnabledChains();

      for (const chainConfig of enabledChains) {
        const chain = chainConfig.id;

        // 计算各个时间段 - 使用clone避免修改原对象
        const todayStart = now.clone().startOf('day').toDate();
        const todayEnd = now.clone().endOf('day').toDate();
        
        const yesterdayStart = now.clone().subtract(1, 'day').startOf('day').toDate();
        const yesterdayEnd = now.clone().subtract(1, 'day').endOf('day').toDate();
        
        const thisWeekStart = now.clone().startOf('week').toDate();
        const thisWeekEnd = now.clone().endOf('week').toDate();
        
        const lastWeekStart = now.clone().subtract(1, 'week').startOf('week').toDate();
        const lastWeekEnd = now.clone().subtract(1, 'week').endOf('week').toDate();
        
        const thisMonthStart = now.clone().startOf('month').toDate();
        const thisMonthEnd = now.clone().endOf('month').toDate();
        
        const lastMonthStart = now.clone().subtract(1, 'month').startOf('month').toDate();
        const lastMonthEnd = now.clone().subtract(1, 'month').endOf('month').toDate();

        // 并行查询所有时间段的数据
        const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
          this.calculatePeriodProfitFromDB(tradeRepository, chain, todayStart, todayEnd),
          this.calculatePeriodProfitFromDB(tradeRepository, chain, yesterdayStart, yesterdayEnd),
          this.calculatePeriodProfitFromDB(tradeRepository, chain, thisWeekStart, thisWeekEnd),
          this.calculatePeriodProfitFromDB(tradeRepository, chain, lastWeekStart, lastWeekEnd),
          this.calculatePeriodProfitFromDB(tradeRepository, chain, thisMonthStart, thisMonthEnd),
          this.calculatePeriodProfitFromDB(tradeRepository, chain, lastMonthStart, lastMonthEnd)
        ]);

        // 存储到缓存
        this.chainProfits.set(chain, {
          chain,
          today,
          yesterday,
          thisWeek,
          lastWeek,
          thisMonth,
          lastMonth,
          updatedAt: new Date()
        });

        logger.info(`✅ 重建${chain}收益汇总: 今日$${today.income.toFixed(4)}(${today.txCount}笔)`);
      }

      logger.info(`🎉 链收益汇总缓存重建完成，共${this.chainProfits.size}个链`);

    } catch (error) {
      logger.error(`重建链收益汇总缓存失败: ${error}`);
    }
  }

  /**
   * 从数据库计算指定时间段的收益
   */
  private async calculatePeriodProfitFromDB(
    tradeRepository: any, 
    chain: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{ income: number; gross: number; txCount: number }> {
    const result = await tradeRepository
      .createQueryBuilder('trade')
      .select('SUM(trade.income)', 'income')
      .addSelect('SUM(trade.gross)', 'gross')
      .addSelect('COUNT(*)', 'txCount')
      .where('trade.chain = :chain', { chain })
      .andWhere('trade.createdAt >= :startDate', { startDate })
      .andWhere('trade.createdAt <= :endDate', { endDate })
      .getRawOne();

    return {
      income: parseFloat(result.income) || 0,
      gross: parseFloat(result.gross) || 0,
      txCount: parseInt(result.txCount) || 0
    };
  }

  /**
   * 实时更新链收益汇总（当有新交易时调用）
   */
  private updateChainProfitSummary(trade: TradeInfo): void {
    const now = dayjs();
    const tradeDate = dayjs(trade.createdAt);
    
    // 获取或创建链收益汇总
    let chainProfit = this.chainProfits.get(trade.chain);
    if (!chainProfit) {
      // 如果不存在，创建空的汇总
      chainProfit = {
        chain: trade.chain,
        today: { income: 0, gross: 0, txCount: 0 },
        yesterday: { income: 0, gross: 0, txCount: 0 },
        thisWeek: { income: 0, gross: 0, txCount: 0 },
        lastWeek: { income: 0, gross: 0, txCount: 0 },
        thisMonth: { income: 0, gross: 0, txCount: 0 },
        lastMonth: { income: 0, gross: 0, txCount: 0 },
        updatedAt: new Date()
      };
      this.chainProfits.set(trade.chain, chainProfit);
    }

    const income = Number(trade.income) || 0;
    const gross = Number(trade.gross) || 0;

    // 更新今日数据（如果是今日的交易）
    if (tradeDate.isSame(now, 'day')) {
      chainProfit.today.income += income;
      chainProfit.today.gross += gross;
      chainProfit.today.txCount += 1;
      logger.debug(`📊 更新今日收益: ${trade.chain} +$${income.toFixed(4)} (总计: $${chainProfit.today.income.toFixed(4)})`);
    }

    // 更新本周数据
    if (tradeDate.isSame(now, 'week')) {
      chainProfit.thisWeek.income += income;
      chainProfit.thisWeek.gross += gross;
      chainProfit.thisWeek.txCount += 1;
    }

    // 更新本月数据
    if (tradeDate.isSame(now, 'month')) {
      chainProfit.thisMonth.income += income;
      chainProfit.thisMonth.gross += gross;
      chainProfit.thisMonth.txCount += 1;
    }

    chainProfit.updatedAt = new Date();
  }

  /**
   * 获取所有链的收益汇总
   */
  getChainProfitSummaries(): ChainProfitSummary[] {
    return Array.from(this.chainProfits.values());
  }

  /**
   * 获取指定链的收益汇总
   */
  getChainProfitSummary(chain: string): ChainProfitSummary | null {
    return this.chainProfits.get(chain) || null;
  }

    // ==================== 收益缓存管理 ====================

  /**
   * 缓存收益数据
   */
  cacheProfitData(chain: string, date: string, income: number, gross: number, txCount: number): void {
    const key = chain;
    
    if (!this.profitCache.has(key)) {
      this.profitCache.set(key, []);
    }
    
    const chainProfits = this.profitCache.get(key)!;
    const existingIndex = chainProfits.findIndex(p => p.date === date);
    
    const profitData: ProfitCacheInfo = {
      chain,
      date,
      income,
      gross,
      txCount,
      calculatedAt: new Date()
    };
    
    if (existingIndex !== -1) {
      // 更新现有数据
      chainProfits[existingIndex] = profitData;
    } else {
      // 添加新数据
      chainProfits.push(profitData);
      
      // 保持最近7天的数据
      chainProfits.sort((a, b) => b.date.localeCompare(a.date));
      if (chainProfits.length > 7) {
        chainProfits.splice(7);
      }
    }
    
    logger.debug(`缓存收益数据: ${chain} - ${date} - $${income.toFixed(4)}`);
  }

  /**
   * 获取缓存的收益数据
   */
  getCachedProfitData(chain: string, date?: string): ProfitCacheInfo[] {
    const chainProfits = this.profitCache.get(chain) || [];
    
    if (date) {
      return chainProfits.filter(p => p.date === date);
    }
    
    return [...chainProfits];
  }

  /**
   * 检查收益数据是否在缓存中
   */
  hasCachedProfitData(chain: string, date: string): boolean {
    const chainProfits = this.profitCache.get(chain) || [];
    return chainProfits.some(p => p.date === date);
  }

  // ==================== Token收益统计管理 ====================
  
  /**
   * 添加交易的Token数据，更新Token统计
   */
  addTradeTokens(chain: string, tokens: { addr: string; symbol: string }[], income: number): void {
    if (!tokens || tokens.length === 0) {
      logger.debug(`跳过token统计: ${chain} - 无token数据`);
      return;
    }

    let updatedCount = 0;
    let newCount = 0;

    tokens.forEach(token => {
      const key = this.getTokenKey(chain, token.addr);
      const existing = this.tokenProfitCache.get(key);

      if (existing) {
        existing.count += 1;
        existing.totalProfit += income;
        updatedCount++;
        logger.debug(`更新token: ${chain}:${token.symbol} 次数: ${existing.count}, 总收益: ${existing.totalProfit.toFixed(4)}`);
      } else {
        this.tokenProfitCache.set(key, {
          addr: token.addr,
          symbol: token.symbol,
          count: 1,
          totalProfit: income
        });
        newCount++;
        logger.debug(`新增token: ${chain}:${token.symbol} 收益: ${income.toFixed(4)}`);
      }
    });

    logger.info(`Token统计更新: ${chain} - 新增${newCount}个, 更新${updatedCount}个, 收益: $${income.toFixed(4)}, 缓存总数: ${this.tokenProfitCache.size}`);
  }

  /**
   * 获取指定链的Token统计
   */
  getChainTokenStats(chain: string): TokenProfitInfo[] {
    const stats: TokenProfitInfo[] = [];
    const chainPrefix = `${chain}:`;

    this.tokenProfitCache.forEach((value, key) => {
      if (key.startsWith(chainPrefix)) {
        stats.push({ ...value });
      }
    });

    // 按总收益排序
    return stats.sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 100);
  }

  /**
   * 获取所有Token统计
   */
  getAllTokenStats(): { [chain: string]: TokenProfitInfo[] } {
    const result: { [chain: string]: TokenProfitInfo[] } = {};

    this.tokenProfitCache.forEach((value, key) => {
      const [chain] = key.split(':');
      if (!result[chain]) {
        result[chain] = [];
      }
      result[chain].push({ ...value });
    });

    // 对每个链的数据按收益排序
    Object.keys(result).forEach(chain => {
      result[chain].sort((a, b) => b.totalProfit - a.totalProfit);
    });

    return result;
  }

  /**
   * 获取热门Token (跨链)
   */
  getTopTokens(limit: number = 20): TokenProfitInfo[] {
    const allTokens: TokenProfitInfo[] = [];
    
    this.tokenProfitCache.forEach(value => {
      allTokens.push({ ...value });
    });

    return allTokens
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit);
  }

  /**
   * 获取Token缓存统计信息
   */
  getTokenCacheStats(): {
    totalTokens: number;
    totalChains: number;
    cacheSize: number;
  } {
    const chains = new Set<string>();
    
    this.tokenProfitCache.forEach((_, key) => {
      const [chain] = key.split(':');
      chains.add(chain);
    });

    return {
      totalTokens: this.tokenProfitCache.size,
      totalChains: chains.size,
      cacheSize: this.tokenProfitCache.size
    };
  }

  /**
   * 获取指定Token的统计信息
   */
  getTokenStats(chain: string, addr: string): TokenProfitInfo | null {
    const key = this.getTokenKey(chain, addr);
    const stats = this.tokenProfitCache.get(key);
    return stats ? { ...stats } : null;
  }

  /**
   * 生成Token缓存key
   */
  private getTokenKey(chain: string, addr: string): string {
    return `${chain}:${addr.toLowerCase()}`;
  }

  /**
   * 清空Token收益统计缓存
   */
  clearTokenProfitCache(): void {
    const previousSize = this.tokenProfitCache.size;
    this.tokenProfitCache.clear();
    logger.info(`Token统计缓存已清零: 清理了 ${previousSize} 条记录`);
  }

  // ==================== 统计信息 ====================
  
  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    trades: number;
    warnings: number;
    tagProfits: number;
    profitCache: number;
    chainProfits: number;
    tokenProfits: number;
    lastTagProfitReset: string;
  } {
    let totalTagProfits = 0;
    for (const tagProfits of this.tagProfits.values()) {
      totalTagProfits += tagProfits.length;
    }
    
    let totalProfitCache = 0;
    for (const profits of this.profitCache.values()) {
      totalProfitCache += profits.length;
    }
    
    return {
      trades: this.trades.length,
      warnings: this.warnings.length,
      tagProfits: totalTagProfits,
      profitCache: totalProfitCache,
      chainProfits: this.chainProfits.size,
      tokenProfits: this.tokenProfitCache.size,
      lastTagProfitReset: this.lastTagProfitResetDate
    };
  }

  /**
   * 清空所有缓存
   */
  clearAllCache(): void {
    this.trades = [];
    this.warnings = [];
    this.tagProfits.clear();
    this.profitCache.clear();
    this.chainProfits.clear();
    this.tokenProfitCache.clear();
    this.warningIdCounter = 1;
    this.lastTagProfitResetDate = dayjs().format('YYYY-MM-DD');
    
    logger.info(`清空所有缓存数据`);
  }
}

export const cacheService = CacheService.getInstance();