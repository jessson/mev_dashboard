import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { TradeInfo } from '../entities/TradeInfo';
import { ChainConfig } from '../entities/ChainConfig';
import * as path from 'path';
import * as fs from 'fs';

// 确保数据目录存在
const dataDir = path.dirname(process.env.DATABASE_PATH || './data/mev.db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const TypeormConnection = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './data/mev.db',
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, TradeInfo, ChainConfig],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
  // SQLite优化配置 - 防止锁定问题
  extra: {
    // 启用WAL模式，提高并发性能
    pragma: [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA cache_size = 1000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA busy_timeout = 30000'
    ]
  },
  // 查询超时配置
  maxQueryExecutionTime: 30000
});