#!/usr/bin/env tsx

import 'reflect-metadata';
import { DataSource, QueryRunner, In } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import dayjs from 'dayjs';

// 新的实体
import { User, UserType } from '../src/entities/User';
import { TradeInfo } from '../src/entities/TradeInfo';
import { Profit } from '../src/entities/Profit';
import { Warning } from '../src/entities/Warning';
import { TopInfo } from '../src/entities/TopInfo';
import { TagProfit } from '../src/entities/TagProfit';
import { ChainConfig } from '../src/entities/ChainConfig';

// 旧数据库连接配置
const OLD_DB_PATH = process.env.OLD_DATABASE_PATH || './data/old_mev.db';
const NEW_DB_PATH = process.env.DATABASE_PATH || './data/mev.db';

// 批处理配置
const BATCH_SIZE = 1000;  // 每批处理的记录数
const QUERY_BATCH_SIZE = 5000;  // 查询批次大小
const PROGRESS_INTERVAL = 1000;  // 进度显示间隔

// 旧数据库连接 - 优化配置
const oldConnection = new DataSource({
  type: 'sqlite',
  database: OLD_DB_PATH,
  synchronize: false,
  logging: false,
  entities: [], // 不需要实体，直接用原始SQL查询
  extra: {
    pragma: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = 10000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA mmap_size = 268435456', // 256MB
    ]
  },
});

// 新数据库连接 - 优化配置
const newConnection = new DataSource({
  type: 'sqlite',
  database: NEW_DB_PATH,
  synchronize: true,
  logging: false,
  entities: [User, TradeInfo, Profit, Warning, TopInfo, TagProfit, ChainConfig],
  extra: {
    pragma: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = 20000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA busy_timeout = 30000',
      'PRAGMA mmap_size = 268435456', // 256MB
    ]
  },
});

interface OldTradeInfo {
  id: number;
  chain: string;
  builder: string;
  hash: string;
  vicHashes: string;
  gross: number;
  bribe: number;
  income: number;
  txCount: number;
  ratio: number;
  extraInfo: string;
  tags: string;
  created_at: string;
}

interface OldProfit {
  id: string; // UUID
  chain: string;
  gross: number;
  income: number;
  txCount: number;
  created_at: string;
}

interface OldUser {
  id: number;
  username: string;
  password: string;
  type: string;
}

interface OldWarning {
  id: number;
  type: string;
  msg: string;
  chain: string;
  created_at?: string;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  startTime: number;
  estimatedTimeRemaining?: string;
}

async function checkOldDatabaseExists(): Promise<boolean> {
  return fs.existsSync(OLD_DB_PATH);
}

async function getTableNames(connection: DataSource): Promise<string[]> {
  const result = await connection.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  return result.map((row: any) => row.name);
}

async function getTableCount(connection: DataSource, tableName: string): Promise<number> {
  const result = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return result[0].count;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${(seconds % 60).toFixed(0)}秒`;
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
}

function updateProgress(stats: MigrationStats, processed: number): void {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = processed / elapsed;
  const remaining = stats.total - processed;
  const eta = remaining / rate;
  
  stats.estimatedTimeRemaining = formatTime(eta);
  
  const progress = (processed / stats.total * 100).toFixed(1);
  console.log(`📊 进度: ${processed}/${stats.total} (${progress}%) - 速度: ${rate.toFixed(1)}条/秒 - 预计剩余: ${stats.estimatedTimeRemaining}`);
}

async function migrateUsers(): Promise<void> {
  console.log('🔄 迁移用户数据...');
  
  try {
    // 检查旧表是否存在
    const tables = await getTableNames(oldConnection);
    const userTable = tables.find(t => t.toLowerCase().includes('user'));
    
    if (!userTable) {
      console.log('⚠️  未找到用户表，跳过用户数据迁移');
      return;
    }

    const oldUsers = await oldConnection.query(`SELECT * FROM ${userTable}`) as OldUser[];
    
    if (!oldUsers.length) {
      console.log('📄 没有用户数据需要迁移');
      return;
    }

    const userRepo = newConnection.getRepository(User);
    let migrated = 0;

    for (const oldUser of oldUsers) {
      try {
        // 检查用户是否已存在
        const exists = await userRepo.findOne({ where: { username: oldUser.username } });
        if (exists) {
          console.log(`👤 用户 ${oldUser.username} 已存在，跳过`);
          continue;
        }

                 const newUser = new User();
         newUser.username = oldUser.username;
         newUser.password = oldUser.password;
         
         // 转换用户类型
         switch (oldUser.type?.toLowerCase()) {
           case 'admin':
             newUser.type = UserType.ADMIN;
             break;
           case 'guest':
           case 'guess':
             newUser.type = UserType.GUEST;
             break;
           default:
             newUser.type = UserType.NORMAL;
         }

        await userRepo.save(newUser);
        migrated++;
      } catch (error) {
        console.error(`❌ 迁移用户 ${oldUser.username} 失败:`, error);
      }
    }

    console.log(`✅ 用户数据迁移完成: ${migrated}/${oldUsers.length}`);
  } catch (error) {
    console.error('❌ 用户数据迁移失败:', error);
  }
}

async function migrateTradeInfo(): Promise<void> {
  console.log('🔄 开始优化迁移交易数据...');
  
  try {
    const tables = await getTableNames(oldConnection);
    const tradeTable = tables.find(t => t.toLowerCase().includes('trade'));
    
    if (!tradeTable) {
      console.log('⚠️  未找到交易表，跳过交易数据迁移');
      return;
    }

    const totalCount = await getTableCount(oldConnection, tradeTable);
    console.log(`📊 发现 ${totalCount.toLocaleString()} 条交易记录`);
    
    if (totalCount === 0) {
      console.log('📄 没有交易数据需要迁移');
      return;
    }

    const stats: MigrationStats = {
      total: totalCount,
      migrated: 0,
      skipped: 0,
      failed: 0,
      startTime: Date.now()
    };

    const tradeRepo = newConnection.getRepository(TradeInfo);
    const queryRunner = newConnection.createQueryRunner();
    
    try {
      // 分批处理数据
      for (let offset = 0; offset < totalCount; offset += QUERY_BATCH_SIZE) {
        const startTime = Date.now();
        
        // 批量查询数据
        const oldTrades = await oldConnection.query(
          `SELECT * FROM ${tradeTable} ORDER BY id LIMIT ${QUERY_BATCH_SIZE} OFFSET ${offset}`
        ) as OldTradeInfo[];

        if (oldTrades.length === 0) break;

        // 批量检查重复记录
        const hashes = oldTrades.map(t => t.hash);
        const existingTrades = await tradeRepo.find({
          where: { hash: In(hashes) },
          select: ['hash']
        });
        const existingHashes = new Set(existingTrades.map(t => t.hash));

        // 过滤出需要插入的新记录
        const newTrades = oldTrades
          .filter(oldTrade => !existingHashes.has(oldTrade.hash))
          .map(oldTrade => {
            const newTrade = new TradeInfo();
            newTrade.chain = oldTrade.chain;
            newTrade.builder = oldTrade.builder;
            newTrade.hash = oldTrade.hash;
            
            // 处理JSON字段
            try {
              newTrade.vicHashes = oldTrade.vicHashes ? JSON.parse(oldTrade.vicHashes) : [];
            } catch {
              newTrade.vicHashes = [];
            }
            
            try {
              newTrade.tags = oldTrade.tags ? JSON.parse(oldTrade.tags) : [];
            } catch {
              newTrade.tags = [];
            }

            // 数值字段转换
            newTrade.gross = Number(oldTrade.gross) || 0;
            newTrade.bribe = Number(oldTrade.bribe) || 0;
            newTrade.income = Number(oldTrade.income) || 0;
            newTrade.txCount = Number(oldTrade.txCount) || 0;
            newTrade.ratio = Number(oldTrade.ratio) || 0;
            
            newTrade.extraInfo = oldTrade.extraInfo || '';
            newTrade.incTokens = [];
            
            // 处理时间字段
            if (oldTrade.created_at) {
              newTrade.createdAt = new Date(oldTrade.created_at);
            }

            return newTrade;
          });

        // 统计
        stats.skipped += oldTrades.length - newTrades.length;

        // 批量插入新记录
        if (newTrades.length > 0) {
          // 进一步分批插入，避免单次插入数据过多
          for (let i = 0; i < newTrades.length; i += BATCH_SIZE) {
            const batch = newTrades.slice(i, i + BATCH_SIZE);
            
            try {
              await queryRunner.startTransaction();
              await queryRunner.manager.save(TradeInfo, batch);
              await queryRunner.commitTransaction();
              
              stats.migrated += batch.length;
            } catch (error) {
              await queryRunner.rollbackTransaction();
              console.error(`❌ 批量插入失败 (批次 ${i / BATCH_SIZE + 1}):`, error);
              
              // 降级为逐条插入
              for (const trade of batch) {
                try {
                  await tradeRepo.save(trade);
                  stats.migrated++;
                } catch (singleError) {
                  stats.failed++;
                  console.error(`❌ 单条记录插入失败 ${trade.hash}:`, singleError);
                }
              }
            }
          }
        }

        const batchTime = (Date.now() - startTime) / 1000;
        const processed = offset + oldTrades.length;
        
        if (processed % PROGRESS_INTERVAL === 0 || processed >= totalCount) {
          updateProgress(stats, processed);
          console.log(`⚡ 当前批次处理 ${oldTrades.length} 条记录，耗时 ${batchTime.toFixed(2)}秒`);
        }
      }

    } finally {
      await queryRunner.release();
    }

    const totalTime = (Date.now() - stats.startTime) / 1000;
    const avgRate = stats.total / totalTime;
    
    console.log('✅ 交易数据迁移完成!');
    console.log(`📊 统计信息:`);
    console.log(`   - 总记录数: ${stats.total.toLocaleString()}`);
    console.log(`   - 成功迁移: ${stats.migrated.toLocaleString()}`);
    console.log(`   - 跳过重复: ${stats.skipped.toLocaleString()}`);
    console.log(`   - 失败记录: ${stats.failed.toLocaleString()}`);
    console.log(`   - 总耗时: ${formatTime(totalTime)}`);
    console.log(`   - 平均速度: ${avgRate.toFixed(1)}条/秒`);

  } catch (error) {
    console.error('❌ 交易数据迁移失败:', error);
    throw error;
  }
}

async function migrateProfits(): Promise<void> {
  console.log('🔄 开始优化迁移收益数据...');
  
  try {
    const tables = await getTableNames(oldConnection);
    const profitTable = tables.find(t => t.toLowerCase().includes('profit'));
    
    if (!profitTable) {
      console.log('⚠️  未找到收益表，跳过收益数据迁移');
      return;
    }

    const totalCount = await getTableCount(oldConnection, profitTable);
    console.log(`📊 发现 ${totalCount.toLocaleString()} 条收益记录`);
    
    if (totalCount === 0) {
      console.log('📄 没有收益数据需要迁移');
      return;
    }

    const profitRepo = newConnection.getRepository(Profit);
    const stats: MigrationStats = {
      total: totalCount,
      migrated: 0,
      skipped: 0,
      failed: 0,
      startTime: Date.now()
    };

    // 分批处理
    for (let offset = 0; offset < totalCount; offset += QUERY_BATCH_SIZE) {
      const oldProfits = await oldConnection.query(
        `SELECT * FROM ${profitTable} ORDER BY created_at LIMIT ${QUERY_BATCH_SIZE} OFFSET ${offset}`
      ) as OldProfit[];

      if (oldProfits.length === 0) break;

      const newProfits = oldProfits.map(oldProfit => {
        const newProfit = new Profit();
        newProfit.chain = oldProfit.chain;
        newProfit.gross = Number(oldProfit.gross) || 0;
        newProfit.income = Number(oldProfit.income) || 0;
        newProfit.txCount = Number(oldProfit.txCount) || 0;
        
        if (oldProfit.created_at) {
          newProfit.createdAt = new Date(oldProfit.created_at);
        }

        return newProfit;
      });

      // 批量插入
      try {
        await profitRepo.save(newProfits);
        stats.migrated += newProfits.length;
      } catch (error) {
        console.error(`❌ 收益数据批量插入失败:`, error);
        // 降级为逐条插入
        for (const profit of newProfits) {
          try {
            await profitRepo.save(profit);
            stats.migrated++;
          } catch (singleError) {
            stats.failed++;
          }
        }
      }

      const processed = offset + oldProfits.length;
      if (processed % PROGRESS_INTERVAL === 0 || processed >= totalCount) {
        updateProgress(stats, processed);
      }
    }

    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log(`✅ 收益数据迁移完成: ${stats.migrated}/${stats.total} (耗时 ${formatTime(totalTime)})`);

  } catch (error) {
    console.error('❌ 收益数据迁移失败:', error);
  }
}

async function migrateWarnings(): Promise<void> {
  console.log('🔄 迁移预警数据...');
  
  try {
    const tables = await getTableNames(oldConnection);
    const warningTable = tables.find(t => t.toLowerCase().includes('warning'));
    
    if (!warningTable) {
      console.log('⚠️  未找到预警表，跳过预警数据迁移');
      return;
    }

    const totalCount = await getTableCount(oldConnection, warningTable);
    if (totalCount === 0) {
      console.log('📄 没有预警数据需要迁移');
      return;
    }

    console.log(`📊 发现 ${totalCount.toLocaleString()} 条预警记录`);
    const warningRepo = newConnection.getRepository(Warning);
    let migrated = 0;

    // 分批处理预警数据
    for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
      const oldWarnings = await oldConnection.query(
        `SELECT * FROM ${warningTable} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      ) as OldWarning[];

      if (oldWarnings.length === 0) break;

      const newWarnings = oldWarnings.map(oldWarning => {
        const newWarning = new Warning();
        newWarning.type = oldWarning.type;
        newWarning.msg = oldWarning.msg;
        newWarning.chain = oldWarning.chain;
        
        if (oldWarning.created_at) {
          newWarning.createdAt = new Date(oldWarning.created_at);
        }

        return newWarning;
      });

      try {
        await warningRepo.save(newWarnings);
        migrated += newWarnings.length;
      } catch (error) {
        console.error(`❌ 预警数据批量插入失败:`, error);
      }
    }

    console.log(`✅ 预警数据迁移完成: ${migrated}/${totalCount}`);
  } catch (error) {
    console.error('❌ 预警数据迁移失败:', error);
  }
}

async function main() {
  console.log('🚀 开始优化数据库迁移...');
  console.log(`📂 旧数据库: ${OLD_DB_PATH}`);
  console.log(`📂 新数据库: ${NEW_DB_PATH}`);
  console.log(`⚙️  批处理配置: 查询批次=${QUERY_BATCH_SIZE}, 插入批次=${BATCH_SIZE}`);

  // 检查旧数据库是否存在
  if (!await checkOldDatabaseExists()) {
    console.error(`❌ 旧数据库文件不存在: ${OLD_DB_PATH}`);
    console.log('💡 可以通过环境变量 OLD_DATABASE_PATH 指定旧数据库路径');
    process.exit(1);
  }

  const overallStartTime = Date.now();

  try {
    // 初始化数据库连接
    console.log('📡 连接数据库...');
    await oldConnection.initialize();
    await newConnection.initialize();

    console.log('✅ 数据库连接成功');

    // 显示表信息
    const oldTables = await getTableNames(oldConnection);
    console.log(`📋 旧数据库表: ${oldTables.join(', ')}`);

    // 显示数据量信息
    console.log('\n📊 数据量统计:');
    for (const table of oldTables) {
      try {
        const count = await getTableCount(oldConnection, table);
        console.log(`   - ${table}: ${count.toLocaleString()} 条记录`);
      } catch (error) {
        console.log(`   - ${table}: 无法获取记录数`);
      }
    }
    console.log('');

    // 执行迁移
    await migrateUsers();
    await migrateTradeInfo();
    await migrateProfits();
    await migrateWarnings();

    const totalTime = (Date.now() - overallStartTime) / 1000;
    console.log(`🎉 数据库迁移完成! 总耗时: ${formatTime(totalTime)}`);

  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (oldConnection.isInitialized) {
      await oldConnection.destroy();
    }
    if (newConnection.isInitialized) {
      await newConnection.destroy();
    }
    console.log('📡 数据库连接已关闭');
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 启动迁移
if (require.main === module) {
  main();
}

export { main as migrateDatabase };