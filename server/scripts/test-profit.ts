import { DataSource, Repository } from 'typeorm';
import { TradeInfo } from '../src/entities/TradeInfo';
import { User } from '../src/entities/User';
import { ChainConfig } from '../src/entities/ChainConfig';
import { chainService } from '../src/config/chains';
import { cacheService } from '../src/services/cache.service';
import { ProfitService } from '../src/services/profit.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import * as path from 'path';
import * as fs from 'fs';

// 配置dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear);

// 创建测试数据库连接
const testDbPath = './data/test.db';

// 确保数据目录存在
const dataDir = path.dirname(testDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const TestDbConnection = new DataSource({
  type: 'sqlite',
  database: testDbPath,
  synchronize: true,
  logging: false, // 测试时关闭日志
  entities: [User, TradeInfo, ChainConfig],
  // SQLite优化配置
  extra: {
    pragma: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = 1000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA busy_timeout = 30000'
    ]
  },
  maxQueryExecutionTime: 30000
});

// 测试版本的ProfitService，使用测试数据库
class TestProfitService {
  private tradeRepository: Repository<TradeInfo>;

  constructor(dataSource: DataSource) {
    this.tradeRepository = dataSource.getRepository(TradeInfo);
  }

  /**
   * 获取指定时间段的收益数据 - 直接从测试数据库计算
   */
  private async getProfitForPeriod(chain: string, startDate: Date, endDate: Date): Promise<{ income: number; gross: number; txCount: number }> {
    const result = await this.tradeRepository
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
   * 获取所有链的收益数据
   */
  async getChainProfits(): Promise<Array<{
    chain: string;
    today: { income: number; gross: number; txCount: number };
    yesterday: { income: number; gross: number; txCount: number };
    thisWeek: { income: number; gross: number; txCount: number };
    lastWeek: { income: number; gross: number; txCount: number };
    thisMonth: { income: number; gross: number; txCount: number };
    lastMonth: { income: number; gross: number; txCount: number };
  }>> {
    const chains = chainService.getEnabledChains();
    const results: Array<{
      chain: string;
      today: { income: number; gross: number; txCount: number };
      yesterday: { income: number; gross: number; txCount: number };
      thisWeek: { income: number; gross: number; txCount: number };
      lastWeek: { income: number; gross: number; txCount: number };
      thisMonth: { income: number; gross: number; txCount: number };
      lastMonth: { income: number; gross: number; txCount: number };
    }> = [];

    for (const chainConfig of chains) {
      const chainProfit = await this.calculateChainProfit(chainConfig.id);
      results.push(chainProfit);
    }

    return results;
  }

  /**
   * 计算单个链的收益数据
   */
  private async calculateChainProfit(chain: string): Promise<{
    chain: string;
    today: { income: number; gross: number; txCount: number };
    yesterday: { income: number; gross: number; txCount: number };
    thisWeek: { income: number; gross: number; txCount: number };
    lastWeek: { income: number; gross: number; txCount: number };
    thisMonth: { income: number; gross: number; txCount: number };
    lastMonth: { income: number; gross: number; txCount: number };
  }> {
    const now = dayjs();
    
    // 使用clone避免修改原对象
    const todayStart = now.clone().startOf('day');
    const todayEnd = now.clone().endOf('day');
    
    const yesterdayStart = now.clone().subtract(1, 'day').startOf('day');
    const yesterdayEnd = now.clone().subtract(1, 'day').endOf('day');
    
    const thisWeekStart = now.clone().startOf('week');
    const thisWeekEnd = now.clone().endOf('week');
    
    const lastWeekStart = now.clone().subtract(1, 'week').startOf('week');
    const lastWeekEnd = now.clone().subtract(1, 'week').endOf('week');
    
    const thisMonthStart = now.clone().startOf('month');
    const thisMonthEnd = now.clone().endOf('month');
    
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
}

interface ProfitTestResult {
  chain: string;
  today: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  yesterday: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  thisWeek: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  lastWeek: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  thisMonth: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  lastMonth: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
  totalInDatabase: {
    income: number;
    gross: number;
    txCount: number;
    dateRange: string;
  };
}

class ProfitTester {
  private tradeRepository: Repository<TradeInfo>;

  constructor() {
    this.tradeRepository = TestDbConnection.getRepository(TradeInfo);
  }

  /**
   * 初始化测试环境 - 确保所有服务使用测试数据库
   */
  async initializeTestEnvironment(): Promise<void> {
    console.log('🔧 初始化测试环境...');
    
    // 设置环境变量让其他服务也使用测试数据库
    process.env.DATABASE_PATH = testDbPath;
    
    // 检查测试数据库是否有数据
    const totalTrades = await this.tradeRepository.count();
    console.log(`📊 测试数据库中共有 ${totalTrades} 笔交易记录`);
    
    if (totalTrades === 0) {
      console.log('⚠️  测试数据库为空，建议先导入一些测试数据');
      console.log('提示: 可以从生产数据库复制一些数据到测试数据库');
    }
    
    console.log('✅ 测试环境初始化完成');
  }

  /**
   * 获取指定时间段的实际数据库数据
   */
  private async getPeriodDataFromDB(
    chain: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{ income: number; gross: number; txCount: number; trades: any[] }> {
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.chain = :chain', { chain })
      .andWhere('trade.createdAt >= :startDate', { startDate })
      .andWhere('trade.createdAt <= :endDate', { endDate })
      .orderBy('trade.createdAt', 'DESC')
      .getMany();

    const income = trades.reduce((sum, trade) => sum + (Number(trade.income) || 0), 0);
    const gross = trades.reduce((sum, trade) => sum + (Number(trade.gross) || 0), 0);
    const txCount = trades.length;

    return { income, gross, txCount, trades };
  }

  /**
   * 获取数据库中的全量数据
   */
  private async getTotalDataFromDB(chain: string): Promise<{ income: number; gross: number; txCount: number; dateRange: string }> {
    const result = await this.tradeRepository
      .createQueryBuilder('trade')
      .select('SUM(trade.income)', 'income')
      .addSelect('SUM(trade.gross)', 'gross')
      .addSelect('COUNT(*)', 'txCount')
      .addSelect('MIN(trade.createdAt)', 'minDate')
      .addSelect('MAX(trade.createdAt)', 'maxDate')
      .where('trade.chain = :chain', { chain })
      .getRawOne();

    return {
      income: parseFloat(result.income) || 0,
      gross: parseFloat(result.gross) || 0,
      txCount: parseInt(result.txCount) || 0,
      dateRange: result.minDate && result.maxDate 
        ? `${dayjs(result.minDate).format('YYYY-MM-DD')} ~ ${dayjs(result.maxDate).format('YYYY-MM-DD')}`
        : 'No data'
    };
  }

  /**
   * 显示详细的时间段信息
   */
  private getTimeRangeInfo() {
    const now = dayjs();
    
    console.log('\n=== 时间段定义 ===');
    console.log(`当前时间: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`今天: ${now.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`昨天: ${now.clone().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`本周: ${now.clone().startOf('week').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('week').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`上周: ${now.clone().subtract(1, 'week').startOf('week').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'week').endOf('week').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`本月: ${now.clone().startOf('month').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('month').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`上月: ${now.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log('\n注意: 周的开始是周日(0)，周一是1，以此类推');
  }

  /**
   * 测试单个链的profit数据
   */
  async testChainProfit(chain: string): Promise<ProfitTestResult> {
    const now = dayjs();
    
    // 计算各个时间段
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

    // 并行获取所有时间段的数据
    const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, total] = await Promise.all([
      this.getPeriodDataFromDB(chain, todayStart, todayEnd),
      this.getPeriodDataFromDB(chain, yesterdayStart, yesterdayEnd),
      this.getPeriodDataFromDB(chain, thisWeekStart, thisWeekEnd),
      this.getPeriodDataFromDB(chain, lastWeekStart, lastWeekEnd),
      this.getPeriodDataFromDB(chain, thisMonthStart, thisMonthEnd),
      this.getPeriodDataFromDB(chain, lastMonthStart, lastMonthEnd),
      this.getTotalDataFromDB(chain)
    ]);

    return {
      chain,
      today: {
        ...today,
        dateRange: `${dayjs(todayStart).format('YYYY-MM-DD')} ~ ${dayjs(todayEnd).format('YYYY-MM-DD')}`
      },
      yesterday: {
        ...yesterday,
        dateRange: `${dayjs(yesterdayStart).format('YYYY-MM-DD')} ~ ${dayjs(yesterdayEnd).format('YYYY-MM-DD')}`
      },
      thisWeek: {
        ...thisWeek,
        dateRange: `${dayjs(thisWeekStart).format('YYYY-MM-DD')} ~ ${dayjs(thisWeekEnd).format('YYYY-MM-DD')}`
      },
      lastWeek: {
        ...lastWeek,
        dateRange: `${dayjs(lastWeekStart).format('YYYY-MM-DD')} ~ ${dayjs(lastWeekEnd).format('YYYY-MM-DD')}`
      },
      thisMonth: {
        ...thisMonth,
        dateRange: `${dayjs(thisMonthStart).format('YYYY-MM-DD')} ~ ${dayjs(thisMonthEnd).format('YYYY-MM-DD')}`
      },
      lastMonth: {
        ...lastMonth,
        dateRange: `${dayjs(lastMonthStart).format('YYYY-MM-DD')} ~ ${dayjs(lastMonthEnd).format('YYYY-MM-DD')}`
      },
      totalInDatabase: total
    };
  }

  /**
   * 格式化输出profit数据
   */
  private formatProfitData(period: string, data: any) {
    return `${period}: $${data.income.toFixed(4)} (${data.txCount}笔) [${data.dateRange}]`;
  }

  /**
   * 测试所有启用链的profit数据
   */
  async testAllChains(): Promise<void> {
    console.log('\n🧪 开始Profit数据测试...\n');
    
    // 显示时间段信息
    this.getTimeRangeInfo();

    const enabledChains = chainService.getEnabledChains();
    console.log(`\n=== 测试链列表 ===`);
    enabledChains.forEach(chain => {
      console.log(`- ${chain.id} (${chain.displayName})`);
    });

    for (const chainConfig of enabledChains) {
      const chain = chainConfig.id;
      console.log(`\n🔍 测试链: ${chain} (${chainConfig.displayName})`);
      console.log('='.repeat(60));

      try {
        const result = await this.testChainProfit(chain);
        
        console.log(this.formatProfitData('📅 今天', result.today));
        console.log(this.formatProfitData('📅 昨天', result.yesterday));
        console.log(this.formatProfitData('📅 本周', result.thisWeek));
        console.log(this.formatProfitData('📅 上周', result.lastWeek));
        console.log(this.formatProfitData('📅 本月', result.thisMonth));
        console.log(this.formatProfitData('📅 上月', result.lastMonth));
        console.log(this.formatProfitData('📊 全部', result.totalInDatabase));

        // 数据一致性检查
        this.validateProfitData(result);

      } catch (error) {
        console.error(`❌ 测试链 ${chain} 时出错:`, error);
      }
    }
  }

  /**
   * 验证profit数据的一致性
   */
  private validateProfitData(result: ProfitTestResult) {
    console.log('\n📊 数据验证:');
    
    // 检查今天和昨天的数据是否在本周内
    const todayPlusYesterday = result.today.income + result.yesterday.income;
    if (Math.abs(todayPlusYesterday - result.thisWeek.income) > 0.01 && result.thisWeek.income > 0) {
      console.log(`⚠️  本周数据可能不包含今天+昨天: 今天+昨天=$${todayPlusYesterday.toFixed(4)}, 本周=$${result.thisWeek.income.toFixed(4)}`);
    }

    // 检查数据合理性
    if (result.today.income > result.totalInDatabase.income) {
      console.log(`❌ 异常: 今天收益($${result.today.income.toFixed(4)})大于总收益($${result.totalInDatabase.income.toFixed(4)})`);
    }

    if (result.thisMonth.income > result.totalInDatabase.income) {
      console.log(`❌ 异常: 本月收益($${result.thisMonth.income.toFixed(4)})大于总收益($${result.totalInDatabase.income.toFixed(4)})`);
    }

    console.log('✅ 基础数据验证完成');
  }

  /**
   * 对比系统计算结果和数据库实际结果
   */
  async compareWithSystemData(): Promise<void> {
    console.log('\n🔄 对比系统计算结果和数据库实际数据...\n');

    try {
      // 创建测试版本的ProfitService，使用测试数据库
      const testProfitService = new TestProfitService(TestDbConnection);
      const systemData = await testProfitService.getChainProfits();
      
      for (const systemProfit of systemData) {
        console.log(`\n🔍 链: ${systemProfit.chain}`);
        console.log('-'.repeat(40));
        
        const dbResult = await this.testChainProfit(systemProfit.chain);
        
        // 对比各个时间段
        this.comparePeriod('今天', systemProfit.today, dbResult.today);
        this.comparePeriod('昨天', systemProfit.yesterday, dbResult.yesterday);
        this.comparePeriod('本周', systemProfit.thisWeek, dbResult.thisWeek);
        this.comparePeriod('上周', systemProfit.lastWeek, dbResult.lastWeek);
        this.comparePeriod('本月', systemProfit.thisMonth, dbResult.thisMonth);
        this.comparePeriod('上月', systemProfit.lastMonth, dbResult.lastMonth);
      }
    } catch (error) {
      console.error('❌ 系统数据对比失败:', error.message);
      console.log('⚠️  跳过系统数据对比，继续其他测试...');
    }
  }

  /**
   * 对比单个时间段的数据
   */
  private comparePeriod(
    periodName: string, 
    systemData: { income: number; gross: number; txCount: number }, 
    dbData: { income: number; gross: number; txCount: number; dateRange: string }
  ) {
    const incomeMatch = Math.abs(systemData.income - dbData.income) < 0.01;
    const grossMatch = Math.abs(systemData.gross - dbData.gross) < 0.01;
    const txCountMatch = systemData.txCount === dbData.txCount;
    
    const status = incomeMatch && grossMatch && txCountMatch ? '✅' : '❌';
    
    console.log(`${status} ${periodName}: 系统=$${systemData.income.toFixed(4)}(${systemData.txCount}笔) | 数据库=$${dbData.income.toFixed(4)}(${dbData.txCount}笔) [${dbData.dateRange}]`);
    
    if (!incomeMatch || !grossMatch || !txCountMatch) {
      console.log(`   差异详情: 收益差=${(systemData.income - dbData.income).toFixed(4)}, 交易差=${systemData.txCount - dbData.txCount}`);
    }
  }

  /**
   * 显示最近几天的交易数据样本
   */
  async showRecentTradeSamples(chain: string, days: number = 7): Promise<void> {
    console.log(`\n📋 ${chain} 最近${days}天交易样本:`);
    console.log('='.repeat(80));

    for (let i = 0; i < days; i++) {
      const date = dayjs().subtract(i, 'days');
      const startDate = date.startOf('day').toDate();
      const endDate = date.endOf('day').toDate();

      const trades = await this.tradeRepository
        .createQueryBuilder('trade')
        .where('trade.chain = :chain', { chain })
        .andWhere('trade.createdAt >= :startDate', { startDate })
        .andWhere('trade.createdAt <= :endDate', { endDate })
        .orderBy('trade.createdAt', 'DESC')
        .limit(3) // 每天最多显示3笔
        .getMany();

      const dayIncome = trades.reduce((sum, trade) => sum + (Number(trade.income) || 0), 0);
      console.log(`\n📅 ${date.format('YYYY-MM-DD')} (${trades.length}笔交易, 总收益: $${dayIncome.toFixed(4)})`);
      
      trades.forEach((trade, index) => {
        console.log(`  ${index + 1}. ${dayjs(trade.createdAt).format('HH:mm:ss')} | $${Number(trade.income).toFixed(4)} | ${trade.hash.slice(0, 10)}...`);
      });
    }
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 初始化测试数据库连接...');
    console.log(`📁 测试数据库路径: ${testDbPath}`);
    await TestDbConnection.initialize();

    console.log('📊 初始化链配置和缓存服务...');
    // ChainService会自动加载默认配置，无需手动初始化
    
    const tester = new ProfitTester();
    
    // 初始化测试环境
    await tester.initializeTestEnvironment();
    
    // 测试所有链的profit数据
    await tester.testAllChains();
    
    // 对比系统计算结果
    await tester.compareWithSystemData();
    
    // 显示最近几天的交易样本（第一个启用的链）
    const enabledChains = chainService.getEnabledChains();
    if (enabledChains.length > 0) {
      await tester.showRecentTradeSamples(enabledChains[0].id, 7);
    }

    console.log('\n✅ 测试完成!');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    // 关闭测试数据库连接
    if (TestDbConnection.isInitialized) {
      await TestDbConnection.destroy();
    }
    process.exit(0);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

export { ProfitTester };
