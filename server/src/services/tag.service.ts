import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

interface TagProfitInfo {
  chain: string;
  tag: string;
  totalProfit: number;
  txCount: number;
  date: string;
}

export class TagService {
  constructor() {}

  async updateTagProfit(chain: string, tag: string, profit: number, txCount: number = 1): Promise<void> {
    cacheService.updateTagProfit(chain, tag, profit, txCount);
    logger.debug(`更新标签收益: ${chain} - ${tag} - $${profit.toFixed(4)}`);
  }

  async getTagProfits(chain?: string, date?: string): Promise<TagProfitInfo[]> {
    return cacheService.getTagProfits(chain, date);
  }

  async getTagProfitStats(chain: string): Promise<Array<{
    tag: string;
    totalProfit: number;
    txCount: number;
  }>> {
    return cacheService.getTagProfitStats(chain);
  }

  /**
   * 获取所有链的标签收益统计
   */
  async getAllTagProfitStats(): Promise<Array<{
    chain: string;
    tags: Array<{
      tag: string;
      totalProfit: number;
      txCount: number;
    }>;
  }>> {
    const allTagProfits = cacheService.getTagProfits();
    
    // 按链分组
    const chainGroups = new Map<string, TagProfitInfo[]>();
    allTagProfits.forEach(tagProfit => {
      if (!chainGroups.has(tagProfit.chain)) {
        chainGroups.set(tagProfit.chain, []);
      }
      chainGroups.get(tagProfit.chain)!.push(tagProfit);
    });

    // 为每个链计算标签统计
    const results: Array<{
      chain: string;
      tags: Array<{
        tag: string;
        totalProfit: number;
        txCount: number;
      }>;
    }> = [];

    for (const [chain, tagProfits] of chainGroups.entries()) {
      const tagStats = cacheService.getTagProfitStats(chain);
      results.push({
        chain,
        tags: tagStats
      });
    }

    return results;
  }

  /**
   * 获取热门标签排行榜
   */
  async getTopTags(limit: number = 10): Promise<Array<{
    tag: string;
    totalProfit: number;
    txCount: number;
    chains: string[];
  }>> {
    const allTagProfits = cacheService.getTagProfits();
    
    // 按标签聚合
    const tagAggregation = new Map<string, {
      totalProfit: number;
      txCount: number;
      chains: Set<string>;
    }>();

    allTagProfits.forEach(tagProfit => {
      if (!tagAggregation.has(tagProfit.tag)) {
        tagAggregation.set(tagProfit.tag, {
          totalProfit: 0,
          txCount: 0,
          chains: new Set()
        });
      }

      const agg = tagAggregation.get(tagProfit.tag)!;
      agg.totalProfit += tagProfit.totalProfit;
      agg.txCount += tagProfit.txCount;
      agg.chains.add(tagProfit.chain);
    });

    // 转换为数组并排序
    return Array.from(tagAggregation.entries())
      .map(([tag, data]) => ({
        tag,
        totalProfit: data.totalProfit,
        txCount: data.txCount,
        chains: Array.from(data.chains)
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit);
  }

  /**
   * 获取标签收益趋势（按日期）
   */
  async getTagProfitTrend(tag: string, chain?: string): Promise<Array<{
    date: string;
    totalProfit: number;
    txCount: number;
    chain?: string;
  }>> {
    const allTagProfits = cacheService.getTagProfits(chain);
    
    return allTagProfits
      .filter(tp => tp.tag === tag)
      .map(tp => ({
        date: tp.date,
        totalProfit: tp.totalProfit,
        txCount: tp.txCount,
        chain: tp.chain
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 批量更新标签收益
   */
  async batchUpdateTagProfits(updates: Array<{
    chain: string;
    tag: string;
    profit: number;
    txCount?: number;
  }>): Promise<void> {
    updates.forEach(({ chain, tag, profit, txCount = 1 }) => {
      cacheService.updateTagProfit(chain, tag, profit, txCount);
    });
    
    logger.info(`批量更新标签收益: ${updates.length} 条记录`);
  }
}