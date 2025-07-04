import { TypeormConnection } from '../config/database';
import { TradeInfo } from '../entities/TradeInfo';
import { Repository } from 'typeorm';
import { chainService } from '../config/chains';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

interface ProfitPeriod {
  income: number;
  gross: number;
  txCount: number;
}

interface ChainProfit {
  chain: string;
  today: ProfitPeriod;
  yesterday: ProfitPeriod;
  thisWeek: ProfitPeriod;
  lastWeek: ProfitPeriod;
  thisMonth: ProfitPeriod;
  lastMonth: ProfitPeriod;
}

export class ProfitService {
  private tradeRepository: Repository<TradeInfo>;

  constructor() {
    this.tradeRepository = TypeormConnection.getRepository(TradeInfo);
  }

  /**
   * 从数据库计算指定日期的收益
   */
  async calculateProfitFromTrades(chain: string, date: string): Promise<ProfitPeriod> {
    const startDate = dayjs(date).startOf('day').toDate();
    const endDate = dayjs(date).endOf('day').toDate();

    const result = await this.tradeRepository
      .createQueryBuilder('trade')
      .select('SUM(trade.income)', 'income')
      .addSelect('SUM(trade.gross)', 'gross')
      .addSelect('COUNT(*)', 'txCount')
      .where('trade.chain = :chain', { chain })
      .andWhere('trade.createdAt >= :startDate', { startDate })
      .andWhere('trade.createdAt <= :endDate', { endDate })
      .getRawOne();

    const profit = {
      income: parseFloat(result.income) || 0,
      gross: parseFloat(result.gross) || 0,
      txCount: parseInt(result.txCount) || 0
    };

    logger.debug(`从数据库计算收益: ${chain} - ${date} - ${profit.txCount} 笔交易`);
    return profit;
  }

  /**
   * 直接从trade数据获取指定时间段的收益数据
   */
  private async getProfitForPeriodFromTrades(chain: string, startDate: Date, endDate: Date): Promise<ProfitPeriod> {
    const start = dayjs(startDate);
    const end = dayjs(endDate);

    logger.debug(`从Trade数据计算时间段收益: ${chain} - ${start.format('YYYY-MM-DD')} 到 ${end.format('YYYY-MM-DD')}`);

    const result = await this.tradeRepository
      .createQueryBuilder('trade')
      .select('SUM(trade.income)', 'income')
      .addSelect('SUM(trade.gross)', 'gross')
      .addSelect('COUNT(*)', 'txCount')
      .where('trade.chain = :chain', { chain })
      .andWhere('trade.createdAt >= :startDate', { startDate })
      .andWhere('trade.createdAt <= :endDate', { endDate })
      .getRawOne();

    const profit = {
      income: parseFloat(result.income) || 0,
      gross: parseFloat(result.gross) || 0,
      txCount: parseInt(result.txCount) || 0
    };

    logger.debug(`Trade数据时间段收益: ${chain} - ${start.format('MM-DD')} 到 ${end.format('MM-DD')} - $${profit.income.toFixed(4)} (${profit.txCount}笔)`);
    return profit;
  }

  /**
   * 获取指定时间段的收益数据 - 直接从数据库计算
   */
  private async getProfitForPeriod(chain: string, startDate: Date, endDate: Date): Promise<ProfitPeriod> {
    return await this.getProfitForPeriodFromTrades(chain, startDate, endDate);
  }

  /**
   * 获取所有链的收益数据
   */
  async getChainProfits(): Promise<ChainProfit[]> {
    // 从CacheService获取数据
    const chainProfitSummaries = cacheService.getChainProfitSummaries();
    
    if (chainProfitSummaries.length > 0) {
      // 转换为ChainProfit格式
      return chainProfitSummaries.map(summary => ({
        chain: summary.chain,
        today: summary.today,
        yesterday: summary.yesterday,
        thisWeek: summary.thisWeek,
        lastWeek: summary.lastWeek,
        thisMonth: summary.thisMonth,
        lastMonth: summary.lastMonth
      }));
    }

    // 如果缓存为空，重新计算并存储到CacheService
    const chains = chainService.getAllChains();
    const results: ChainProfit[] = [];

    for (const chainConfig of chains) {
      // 使用链ID查询数据库，因为数据库中存储的是大写的链ID
      const chainProfit = await this.calculateChainProfit(chainConfig.id);
      chainProfit.chain = chainConfig.id;
      results.push(chainProfit);
    }

    return results;
  }

  /**
   * 计算单个链的收益数据
   */
  private async calculateChainProfit(chain: string): Promise<ChainProfit> {
    const now = dayjs();
    
    // 今天
    const todayStart = now.clone().startOf('day');
    const todayEnd = now.clone().endOf('day');
    
    // 昨天
    const yesterdayStart = now.clone().subtract(1, 'day').startOf('day');
    const yesterdayEnd = now.clone().subtract(1, 'day').endOf('day');
    
    // 本周
    const thisWeekStart = now.clone().startOf('week');
    const thisWeekEnd = now.clone().endOf('week');
    
    // 上周
    const lastWeekStart = now.clone().subtract(1, 'week').startOf('week');
    const lastWeekEnd = now.clone().subtract(1, 'week').endOf('week');
    
    // 本月
    const thisMonthStart = now.clone().startOf('month');
    const thisMonthEnd = now.clone().endOf('month');
    
    // 上月
    const lastMonthStart = now.clone().subtract(1, 'month').startOf('month');
    const lastMonthEnd = now.clone().subtract(1, 'month').endOf('month');

    const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
      this.getProfitForPeriod(chain, todayStart.toDate(), todayEnd.toDate()),
      this.getProfitForPeriod(chain, yesterdayStart.toDate(), yesterdayEnd.toDate()),
      this.getProfitForPeriod(chain, thisWeekStart.toDate(), thisWeekEnd.toDate()),
      this.getProfitForPeriod(chain, lastWeekStart.toDate(), lastWeekEnd.toDate()),
      this.getProfitForPeriod(chain, thisMonthStart.toDate(), thisMonthEnd.toDate()),
      this.getProfitForPeriod(chain, lastMonthStart.toDate(), lastMonthEnd.toDate())
    ]);

    return {
      chain,
      today,
      yesterday,
      thisWeek,
      lastWeek,
      thisMonth,
      lastMonth
    };
  }

  /**
   * 重新构建CacheService中的收益数据
   */
  async updateTodayProfits(): Promise<void> {
    logger.info(`重新构建CacheService中的收益数据...`);
    // 直接调用CacheService的重建方法
    await cacheService.rebuildChainProfitsFromDatabase();
    logger.info(`CacheService收益数据重新构建完成`);
  }



  /**
   * 获取收益趋势数据
   */
  async getProfitTrend(chain: string, days: number = 30): Promise<Array<{
    date: string;
    income: number;
    gross: number;
    txCount: number;
  }>> {
    const results = [];
    
    // 确保chain是大写的，因为数据库中存储的是大写的链ID
    const chainId = chain.toUpperCase();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = dayjs().subtract(i, 'days').format('YYYY-MM-DD');
      const profit = await this.calculateProfitFromTrades(chainId, date);
      
      results.push({
        date,
        income: profit.income,
        gross: profit.gross,
        txCount: profit.txCount
      });
    }
    
    return results;
  }

  /**
   * 初始化收益数据 - 启动时调用
   */
  async initializeMemoryProfits(): Promise<void> {
    logger.info(`初始化收益数据...`);
    await this.updateTodayProfits();
    logger.info(`收益数据初始化完成`);
  }
}