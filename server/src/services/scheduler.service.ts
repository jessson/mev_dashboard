import cron from 'node-cron';
import { ProfitService } from '../services/profit.service';
import { cacheService } from '../services/cache.service';
import { TypeormConnection } from '../config/database';
import { TradeInfo } from '../entities/TradeInfo';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

export class SchedulerService {
  private profitService: ProfitService;
  private tradeRepository: any = null;

  constructor() {
    this.profitService = new ProfitService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    try {
      if (TypeormConnection.isInitialized) {
        this.tradeRepository = TypeormConnection.getRepository(TradeInfo);
      }
    } catch (error) {
      logger.error(`初始化定时任务服务失败: ${error}`);
    }
  }

  start(): void {
    // 每天凌晨0点执行：重置所有缓存 + 更新内存收益数据
    cron.schedule('0 0 * * *', async () => {
      try {
        logger.info(`开始每日凌晨任务...`);
        
        // 1. 重置所有缓存（交易、标签收益、Token收益、链交易计数器）
        logger.info(`重置所有缓存...`);
        cacheService.resetDailyCache();
        
        // 2. 更新内存收益数据（今日、昨日、本周、本月、上月）
        logger.info(`更新内存收益数据...`);
        await this.profitService.updateTodayProfits();
        
        logger.info(`每日凌晨任务完成`);
      } catch (error) {
        logger.error(`每日凌晨任务失败: ${error}`);
      }
    });

    // 每天凌晨2点清理过期交易数据（保留70天）
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info(`开始清理过期交易数据...`);
        await this.cleanupOldTrades();
        logger.info(`过期交易数据清理完成`);
      } catch (error) {
        logger.error(`清理过期交易数据失败: ${error}`);
      }
    });

    // 每小时更新当日收益缓存
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info(`开始更新当日收益缓存...`);
        await this.profitService.updateTodayProfits();
        logger.info(`当日收益缓存更新完成`);
      } catch (error) {
        logger.error(`更新当日收益缓存失败: ${error}`);
      }
    });
    logger.info(`定时任务服务启动完成`);
  }

  // ==================== 数据清理功能 ====================
  
  /**
   * 清理70天前的交易数据
   */
  async cleanupOldTrades(): Promise<number> {
    if (!this.tradeRepository) {
      await this.initializeRepositories();
    }

    if (!this.tradeRepository) {
      logger.error(`交易数据仓库未初始化`);
      return 0;
    }

    try {
      const seventyDaysAgo = dayjs().subtract(70, 'days').toDate();
      
      const result = await this.tradeRepository
        .createQueryBuilder()
        .delete()
        .from(TradeInfo)
        .where('createdAt < :date', { date: seventyDaysAgo })
        .execute();

      const deletedCount = result.affected || 0;
      
      if (deletedCount > 0) {
        logger.info(`清理了 ${deletedCount} 条过期交易记录 (保留70天)`);
      }

      return deletedCount;
    } catch (error) {
      logger.error(`清理过期交易数据失败: ${error}`);
      return 0;
    }
  }

  /**
   * 手动清理所有过期数据
   */
  async cleanupAllExpiredData(): Promise<{
    trades: number;
  }> {
    const tradesDeleted = await this.cleanupOldTrades();

    return {
      trades: tradesDeleted
    };
  }

  /**
   * 获取数据库存储统计
   */
  async getStorageStats(): Promise<{
    totalTrades: number;
    oldestTrade: string | null;
    newestTrade: string | null;
  }> {
    if (!this.tradeRepository) {
      await this.initializeRepositories();
    }

    try {
      const totalTrades = await this.tradeRepository.count();

      let oldestTrade = null;
      let newestTrade = null;

      if (totalTrades > 0) {
        const oldestTradeRecord = await this.tradeRepository.findOne({
          order: { createdAt: 'ASC' }
        });
        const newestTradeRecord = await this.tradeRepository.findOne({
          order: { createdAt: 'DESC' }
        });

        oldestTrade = oldestTradeRecord ? dayjs(oldestTradeRecord.createdAt).format('YYYY-MM-DD HH:mm:ss') : null;
        newestTrade = newestTradeRecord ? dayjs(newestTradeRecord.createdAt).format('YYYY-MM-DD HH:mm:ss') : null;
      }

      return {
        totalTrades,
        oldestTrade,
        newestTrade
      };
    } catch (error) {
      logger.error(`获取存储统计失败: ${error}`);
      return {
        totalTrades: 0,
        oldestTrade: null,
        newestTrade: null
      };
    }
  }

  /**
   * 获取定时任务状态
   */
  async getTaskStatus(): Promise<{
    cacheStats: any;
    storageStats: any;
    storageInfo: string;
  }> {
    const cacheStats = cacheService.getCacheStats();
    const storageStats = await this.getStorageStats();
    
    return {
      cacheStats,
      storageStats,
      storageInfo: '数据库存储: 交易数据保留70天, 收益数据存储在内存中'
    };
  }
}