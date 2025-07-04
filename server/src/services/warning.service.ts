import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

interface WarningInfo {
  id: number;
  type: string;
  msg: string;
  chain: string;
  createdAt: Date;
}

export class WarningService {
  constructor() {}

  async createWarning(type: string, msg: string, chain: string): Promise<WarningInfo> {
    const warning = cacheService.addWarning(type, msg, chain);
    logger.info(`创建预警: ${chain} - ${type}`);
    return warning;
  }

  async getWarnings(limit: number = 100): Promise<WarningInfo[]> {
    const warnings = cacheService.getWarnings();
    return warnings.slice(0, limit);
  }

  async getWarningsByChain(chain: string, limit: number = 100): Promise<WarningInfo[]> {
    const warnings = cacheService.getWarningsByChain(chain);
    return warnings.slice(0, limit);
  }

  async deleteWarning(id: number): Promise<boolean> {
    return cacheService.deleteWarning(id);
  }

  async deleteWarnings(ids: number[]): Promise<number> {
    return cacheService.deleteWarnings(ids);
  }

  async getWarningById(id: number): Promise<WarningInfo | null> {
    const warnings = cacheService.getWarnings();
    return warnings.find(w => w.id === id) || null;
  }

  /**
   * 清空所有预警
   */
  async clearAllWarnings(): Promise<void> {
    cacheService.clearWarnings();
    logger.info(`清空所有预警信息`);
  }

  /**
   * 获取预警统计信息
   */
  async getWarningStats(): Promise<{
    total: number;
    byChain: Array<{ chain: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  }> {
    const warnings = cacheService.getWarnings();
    
    // 按链统计
    const chainStats = new Map<string, number>();
    const typeStats = new Map<string, number>();
    
    warnings.forEach(warning => {
      // 按链统计
      chainStats.set(warning.chain, (chainStats.get(warning.chain) || 0) + 1);
      
      // 按类型统计
      typeStats.set(warning.type, (typeStats.get(warning.type) || 0) + 1);
    });

    return {
      total: warnings.length,
      byChain: Array.from(chainStats.entries()).map(([chain, count]) => ({ chain, count })),
      byType: Array.from(typeStats.entries()).map(([type, count]) => ({ type, count }))
    };
  }
}