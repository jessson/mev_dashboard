#!/usr/bin/env ts-node

/**
 * Trade数据库操作脚本
 * 支持删除和修改trade信息
 * 
 * 使用方法：
 * 
 * 删除操作：
 * npx ts-node scripts/trade-manager.ts delete --id 123
 * npx ts-node scripts/trade-manager.ts delete --hash 0x1234...
 * npx ts-node scripts/trade-manager.ts delete --chain BSC --before "2024-01-01"
 * npx ts-node scripts/trade-manager.ts delete --chain BSC --after "2024-01-01" --before "2024-02-01"
 * 
 * 修改操作：
 * npx ts-node scripts/trade-manager.ts update --id 123 --income 100.5 --tags "MEV,Arbitrage"
 * npx ts-node scripts/trade-manager.ts update --hash 0x1234... --builder "flashbots"
 * 
 * 查询操作：
 * npx ts-node scripts/trade-manager.ts query --chain BSC --limit 10
 * npx ts-node scripts/trade-manager.ts query --hash 0x1234...
 */

import { TypeormConnection } from '../src/config/database';
import { TradeInfo } from '../src/entities/TradeInfo';
import { logger } from '../src/utils/logger';
import dayjs from 'dayjs';

interface DeleteOptions {
  id?: number;
  hash?: string;
  chain?: string;
  builder?: string;
  before?: string;
  after?: string;
  dryRun?: boolean;
}

interface UpdateOptions {
  id?: number;
  hash?: string;
  chain?: string;
  builder?: string;
  gross?: number;
  bribe?: number;
  income?: number;
  txCount?: number;
  ratio?: number;
  extraInfo?: string;
  tags?: string;
  incTokens?: string;
  dryRun?: boolean;
}

interface QueryOptions {
  id?: number;
  hash?: string;
  chain?: string;
  builder?: string;
  before?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

class TradeManager {
  private tradeRepository: any = null;

  async initialize(): Promise<void> {
    try {
      if (!TypeormConnection.isInitialized) {
        await TypeormConnection.initialize();
        logger.info('数据库连接成功');
      }
      this.tradeRepository = TypeormConnection.getRepository(TradeInfo);
    } catch (error) {
      logger.error(`数据库初始化失败: ${error}`);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (TypeormConnection.isInitialized) {
      await TypeormConnection.destroy();
      logger.info('数据库连接已关闭');
    }
  }

  /**
   * 删除trade记录
   */
  async deleteTrades(options: DeleteOptions): Promise<number> {
    const queryBuilder = this.tradeRepository.createQueryBuilder('trade');

    // 构建查询条件
    if (options.id) {
      queryBuilder.where('trade.id = :id', { id: options.id });
    } else {
      let whereAdded = false;

      if (options.hash) {
        queryBuilder.where('trade.hash = :hash', { hash: options.hash });
        whereAdded = true;
      }

      if (options.chain) {
        if (whereAdded) {
          queryBuilder.andWhere('trade.chain = :chain', { chain: options.chain.toUpperCase() });
        } else {
          queryBuilder.where('trade.chain = :chain', { chain: options.chain.toUpperCase() });
          whereAdded = true;
        }
      }

      if (options.builder) {
        if (whereAdded) {
          queryBuilder.andWhere('trade.builder = :builder', { builder: options.builder });
        } else {
          queryBuilder.where('trade.builder = :builder', { builder: options.builder });
          whereAdded = true;
        }
      }

      if (options.after) {
        const afterDate = dayjs(options.after).toDate();
        if (whereAdded) {
          queryBuilder.andWhere('trade.createdAt >= :after', { after: afterDate });
        } else {
          queryBuilder.where('trade.createdAt >= :after', { after: afterDate });
          whereAdded = true;
        }
      }

      if (options.before) {
        const beforeDate = dayjs(options.before).toDate();
        if (whereAdded) {
          queryBuilder.andWhere('trade.createdAt < :before', { before: beforeDate });
        } else {
          queryBuilder.where('trade.createdAt < :before', { before: beforeDate });
          whereAdded = true;
        }
      }

      if (!whereAdded) {
        throw new Error('必须提供至少一个删除条件');
      }
    }

    // 如果是dry run，只查询不删除
    if (options.dryRun) {
      const trades = await queryBuilder.getMany();
      logger.info(`[DRY RUN] 将删除 ${trades.length} 条记录:`);
      
      if (trades.length > 0) {
        console.log('\n=== 即将删除的记录详情 (JSON格式) ===');
        trades.forEach((trade, index) => {
          console.log(`\n[${index + 1}] Trade ID: ${trade.id}`);
          console.log('---');
          console.log(JSON.stringify({
            id: trade.id,
            chain: trade.chain,
            builder: trade.builder,
            hash: trade.hash,
            vicHashes: trade.vicHashes,
            gross: parseFloat(trade.gross.toString()),
            bribe: parseFloat(trade.bribe.toString()),
            income: parseFloat(trade.income.toString()),
            txCount: trade.txCount,
            ratio: parseFloat(trade.ratio.toString()),
            extraInfo: trade.extraInfo,
            tags: trade.tags,
            incTokens: trade.incTokens,
            createdAt: trade.createdAt.toISOString(),
            createdAtFormatted: dayjs(trade.createdAt).format('YYYY-MM-DD HH:mm:ss')
          }, null, 2));
        });
        console.log('\n=== 预览结束 ===\n');
      }
      
      return trades.length;
    }

    // 执行删除
    const result = await queryBuilder.delete().execute();
    const deletedCount = result.affected || 0;
    
    logger.info(`成功删除 ${deletedCount} 条trade记录`);
    return deletedCount;
  }

  /**
   * 更新trade记录
   */
  async updateTrades(options: UpdateOptions): Promise<number> {
    const queryBuilder = this.tradeRepository.createQueryBuilder();

    // 构建查询条件
    if (options.id) {
      queryBuilder.where('id = :id', { id: options.id });
    } else if (options.hash) {
      queryBuilder.where('hash = :hash', { hash: options.hash });
    } else {
      throw new Error('必须提供id或hash来指定要更新的记录');
    }

    // 构建更新数据
    const updateData: any = {};

    if (options.chain !== undefined) updateData.chain = options.chain.toUpperCase();
    if (options.builder !== undefined) updateData.builder = options.builder;
    if (options.gross !== undefined) updateData.gross = options.gross;
    if (options.bribe !== undefined) updateData.bribe = options.bribe;
    if (options.income !== undefined) updateData.income = options.income;
    if (options.txCount !== undefined) updateData.txCount = options.txCount;
    if (options.ratio !== undefined) updateData.ratio = options.ratio;
    if (options.extraInfo !== undefined) updateData.extraInfo = options.extraInfo;
    
    if (options.tags !== undefined) {
      updateData.tags = options.tags.split(',').map(tag => tag.trim());
    }
    
    if (options.incTokens !== undefined) {
      try {
        updateData.incTokens = JSON.parse(options.incTokens);
      } catch (error) {
        throw new Error('incTokens必须是有效的JSON格式');
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('必须提供至少一个要更新的字段');
    }

    // 如果是dry run，只查询不更新
    if (options.dryRun) {
      const trades = await this.tradeRepository.find({
        where: options.id ? { id: options.id } : { hash: options.hash }
      });
      
      if (trades.length === 0) {
        logger.warn('[DRY RUN] 未找到匹配的记录');
        return 0;
      }

      logger.info(`[DRY RUN] 将更新 ${trades.length} 条记录:`);
      
      console.log('\n=== 当前记录详情 (JSON格式) ===');
      trades.forEach((trade, index) => {
        console.log(`\n[${index + 1}] Trade ID: ${trade.id}`);
        console.log('--- 当前记录 ---');
        console.log(JSON.stringify({
          id: trade.id,
          chain: trade.chain,
          builder: trade.builder,
          hash: trade.hash,
          vicHashes: trade.vicHashes,
          gross: parseFloat(trade.gross.toString()),
          bribe: parseFloat(trade.bribe.toString()),
          income: parseFloat(trade.income.toString()),
          txCount: trade.txCount,
          ratio: parseFloat(trade.ratio.toString()),
          extraInfo: trade.extraInfo,
          tags: trade.tags,
          incTokens: trade.incTokens,
          createdAt: trade.createdAt.toISOString(),
          createdAtFormatted: dayjs(trade.createdAt).format('YYYY-MM-DD HH:mm:ss')
        }, null, 2));
        
        console.log('\n--- 将要更新的字段 ---');
        console.log(JSON.stringify(updateData, null, 2));
      });
      console.log('\n=== 预览结束 ===\n');
      
      return trades.length;
    }

    // 执行更新
    const result = await queryBuilder.update(updateData).execute();
    const updatedCount = result.affected || 0;
    
    logger.info(`成功更新 ${updatedCount} 条trade记录`);
    return updatedCount;
  }

  /**
   * 查询trade记录
   */
  async queryTrades(options: QueryOptions): Promise<TradeInfo[]> {
    const queryBuilder = this.tradeRepository.createQueryBuilder('trade');

    // 构建查询条件
    let whereAdded = false;

    if (options.id) {
      queryBuilder.where('trade.id = :id', { id: options.id });
      whereAdded = true;
    }

    if (options.hash) {
      if (whereAdded) {
        queryBuilder.andWhere('trade.hash = :hash', { hash: options.hash });
      } else {
        queryBuilder.where('trade.hash = :hash', { hash: options.hash });
        whereAdded = true;
      }
    }

    if (options.chain) {
      if (whereAdded) {
        queryBuilder.andWhere('trade.chain = :chain', { chain: options.chain.toUpperCase() });
      } else {
        queryBuilder.where('trade.chain = :chain', { chain: options.chain.toUpperCase() });
        whereAdded = true;
      }
    }

    if (options.builder) {
      if (whereAdded) {
        queryBuilder.andWhere('trade.builder = :builder', { builder: options.builder });
      } else {
        queryBuilder.where('trade.builder = :builder', { builder: options.builder });
        whereAdded = true;
      }
    }

    if (options.after) {
      const afterDate = dayjs(options.after).toDate();
      if (whereAdded) {
        queryBuilder.andWhere('trade.createdAt >= :after', { after: afterDate });
      } else {
        queryBuilder.where('trade.createdAt >= :after', { after: afterDate });
        whereAdded = true;
      }
    }

    if (options.before) {
      const beforeDate = dayjs(options.before).toDate();
      if (whereAdded) {
        queryBuilder.andWhere('trade.createdAt < :before', { before: beforeDate });
      } else {
        queryBuilder.where('trade.createdAt < :before', { before: beforeDate });
        whereAdded = true;
      }
    }

    // 排序
    queryBuilder.orderBy('trade.createdAt', 'DESC');

    // 分页
    if (options.limit) {
      queryBuilder.limit(options.limit);
    }
    if (options.offset) {
      queryBuilder.offset(options.offset);
    }

    const trades = await queryBuilder.getMany();
    
    logger.info(`查询到 ${trades.length} 条记录`);
    
    if (trades.length > 0) {
      console.log('\n=== Trade 记录详情 (JSON格式) ===');
      trades.forEach((trade, index) => {
        console.log(`\n[${index + 1}] Trade ID: ${trade.id}`);
        console.log('---');
        console.log(JSON.stringify({
          id: trade.id,
          chain: trade.chain,
          builder: trade.builder,
          hash: trade.hash,
          vicHashes: trade.vicHashes,
          gross: parseFloat(trade.gross.toString()),
          bribe: parseFloat(trade.bribe.toString()),
          income: parseFloat(trade.income.toString()),
          txCount: trade.txCount,
          ratio: parseFloat(trade.ratio.toString()),
          extraInfo: trade.extraInfo,
          tags: trade.tags,
          incTokens: trade.incTokens,
          createdAt: trade.createdAt.toISOString(),
          createdAtFormatted: dayjs(trade.createdAt).format('YYYY-MM-DD HH:mm:ss')
        }, null, 2));
      });
      console.log('\n=== 查询结束 ===\n');
    } else {
      logger.info('未找到匹配的记录');
    }

    return trades;
  }
}

// 命令行参数解析
function parseArgs(): { command: string; options: any } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  const options: any = {};

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (!key.startsWith('--')) {
      throw new Error(`无效的参数: ${key}`);
    }

    const optionName = key.substring(2);
    
    // 数值类型转换
    if (['id', 'txCount', 'limit', 'offset'].includes(optionName)) {
      options[optionName] = parseInt(value, 10);
    } else if (['gross', 'bribe', 'income', 'ratio'].includes(optionName)) {
      options[optionName] = parseFloat(value);
    } else if (optionName === 'dryRun') {
      options[optionName] = true;
      i--; // dry-run不需要值
    } else {
      options[optionName] = value;
    }
  }

  return { command, options };
}

function printUsage(): void {
  console.log(`
Trade数据库操作脚本

使用方法：

删除操作：
  npx ts-node scripts/trade-manager.ts delete --id 123
  npx ts-node scripts/trade-manager.ts delete --hash 0x1234567890abcdef
  npx ts-node scripts/trade-manager.ts delete --chain BSC --before "2024-01-01"
  npx ts-node scripts/trade-manager.ts delete --chain BSC --after "2024-01-01" --before "2024-02-01"
  npx ts-node scripts/trade-manager.ts delete --builder "flashbots" --dry-run

更新操作：
  npx ts-node scripts/trade-manager.ts update --id 123 --income 100.5 --tags "MEV,Arbitrage"
  npx ts-node scripts/trade-manager.ts update --hash 0x1234... --builder "flashbots"
  npx ts-node scripts/trade-manager.ts update --id 123 --incTokens '[{"addr":"0x123","symbol":"USDT"}]'
  npx ts-node scripts/trade-manager.ts update --id 123 --chain ETH --dry-run

查询操作（以JSON格式显示完整字段信息）：
  npx ts-node scripts/trade-manager.ts query --chain BSC --limit 10
  npx ts-node scripts/trade-manager.ts query --hash 0x1234567890abcdef
  npx ts-node scripts/trade-manager.ts query --builder "flashbots" --after "2024-01-01"
  npx ts-node scripts/trade-manager.ts query --limit 20 --offset 10

参数说明：
  --id            记录ID
  --hash          交易哈希
  --chain         链名称 (BSC, ETH, SOL等)
  --builder       构建者
  --before        时间范围结束 (YYYY-MM-DD格式)
  --after         时间范围开始 (YYYY-MM-DD格式)
  --gross         总收益
  --bribe         贿赂金额
  --income        实际收入
  --txCount       交易数量
  --ratio         比例
  --extraInfo     额外信息
  --tags          标签 (逗号分隔)
  --incTokens     代币信息 (JSON格式)
  --limit         查询限制数量
  --offset        查询偏移量
  --dry-run       预览模式，不实际执行操作

输出格式：
  • 查询操作会以JSON格式显示所有trade字段的完整信息
  • --dry-run 模式会显示即将操作的记录的完整JSON详情
  • 所有数值字段已转换为数字类型便于处理
  • 时间字段包含ISO格式和格式化显示
`);
}

async function main() {
  try {
    const { command, options } = parseArgs();
    const manager = new TradeManager();
    
    await manager.initialize();

    switch (command) {
      case 'delete':
        await manager.deleteTrades(options);
        break;
      
      case 'update':
        await manager.updateTrades(options);
        break;
      
      case 'query':
        await manager.queryTrades(options);
        break;
      
      default:
        logger.error(`未知命令: ${command}`);
        printUsage();
        process.exit(1);
    }

    await manager.destroy();
    
  } catch (error) {
    logger.error(`操作失败: ${error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 