import { logger } from '../utils/logger';
import { chainService } from '../config/chains';

// 节点指标类型
export interface NodeMetric {
  current: number;
  average: number;
  peak: number;
}

// 节点状态类型
export interface NodeStatus {
  chain: string;
  online: boolean;
  cpuUsage: NodeMetric;
  memoryUsage: NodeMetric;
  blockHeight: number;
  blockTime: NodeMetric;
  lastUpdate: string;
}

// 节点状态响应类型
export interface NodeStatusResponse {
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    offline: number;
  };
}

// 历史数据存储类型（用于计算平均值和峰值）
interface NodeHistoryData {
  chain: string;
  cpuUsage: number[];
  memoryUsage: number[];
  blockTime: number[];
  maxHistory: number; // 最大历史记录数
}

export class NodeService {
  private nodeStatusCache: Map<string, NodeStatus> = new Map();
  private nodeHistory: Map<string, NodeHistoryData> = new Map();
  private readonly maxHistorySize = 1000; // 保留最近1000个数据点用于计算平均值

  constructor() {
    logger.info(`节点服务已初始化`);
  }

  /**
   * 更新节点状态数据
   * @param chain 链标识
   * @param data 当前节点数据
   */
  updateNodeStatus(chain: string, data: {
    online: boolean;
    cpuUsage: number;
    memoryUsage: number;
    blockHeight: number;
    blockTime: number;
  }): void {
    try {
      // 获取或创建历史数据
      if (!this.nodeHistory.has(chain)) {
        this.nodeHistory.set(chain, {
          chain,
          cpuUsage: [],
          memoryUsage: [],
          blockTime: [],
          maxHistory: this.maxHistorySize
        });
      }

      const history = this.nodeHistory.get(chain)!;

      // 只有在线时才记录性能数据
      if (data.online) {
        // 添加新数据到历史记录
        history.cpuUsage.push(data.cpuUsage);
        history.memoryUsage.push(data.memoryUsage);
        history.blockTime.push(data.blockTime);

        // 保持历史记录大小严格限制在maxHistorySize以内
        while (history.cpuUsage.length > this.maxHistorySize) {
          history.cpuUsage.shift();
          history.memoryUsage.shift();
          history.blockTime.shift();
        }
      }

      // 计算指标
      const cpuUsage = this.calculateMetric(history.cpuUsage, data.online ? data.cpuUsage : 0);
      const memoryUsage = this.calculateMetric(history.memoryUsage, data.online ? data.memoryUsage : 0);
      const blockTime = this.calculateMetric(history.blockTime, data.online ? data.blockTime : 0);

      // 创建节点状态对象
      const nodeStatus: NodeStatus = {
        chain,
        online: data.online,
        cpuUsage,
        memoryUsage,
        blockHeight: data.blockHeight,
        blockTime,
        lastUpdate: new Date().toISOString()
      };

      // 更新缓存
      this.nodeStatusCache.set(chain, nodeStatus);

      logger.debug(`节点状态已更新: ${chain}`, {
        online: data.online,
        cpu: `${data.cpuUsage}%`,
        memory: `${data.memoryUsage}%`,
        blockTime: `${data.blockTime}ms`
      });

    } catch (error) {
      logger.error(`更新节点状态失败: ${chain}`, error);
    }
  }

  /**
   * 计算指标的当前值、平均值和峰值
   */
  private calculateMetric(historyData: number[], currentValue: number): NodeMetric {
    if (historyData.length === 0) {
      return {
        current: currentValue,
        average: currentValue,
        peak: currentValue
      };
    }

    const average = historyData.reduce((sum, val) => sum + val, 0) / historyData.length;
    const peak = Math.max(...historyData);

    return {
      current: currentValue,
      average: Number(average.toFixed(2)),
      peak: Number(peak.toFixed(2))
    };
  }

  /**
   * 获取所有节点状态 - 只返回启用链的状态
   */
  getAllNodeStatus(): NodeStatusResponse {
    const allNodes = Array.from(this.nodeStatusCache.values());
    
    // 获取启用的链列表
    const enabledChainIds = chainService.getEnabledChains().map(chain => chain.id);
    
    // 只返回启用链的节点状态
    const enabledNodes = allNodes.filter(node => enabledChainIds.includes(node.chain));
    
    const summary = {
      total: enabledNodes.length,
      online: enabledNodes.filter(n => n.online).length,
      offline: enabledNodes.filter(n => !n.online).length
    };

    logger.debug(`节点状态过滤: 总节点=${allNodes.length}, 启用链节点=${enabledNodes.length}`, {
      enabledChains: enabledChainIds,
      allChains: allNodes.map(n => n.chain),
      filteredChains: enabledNodes.map(n => n.chain)
    });

    return {
      nodes: enabledNodes.sort((a, b) => a.chain.localeCompare(b.chain)),
      summary
    };
  }

  /**
   * 获取特定链的节点状态
   */
  getNodeStatus(chain: string): NodeStatus | null {
    return this.nodeStatusCache.get(chain) || null;
  }

  /**
   * 标记节点为离线状态
   */
  markNodeOffline(chain: string): void {
    const existingStatus = this.nodeStatusCache.get(chain);
    if (!existingStatus) {
      // 如果没有记录，创建一个基本的离线状态
      const offlineStatus: NodeStatus = {
        chain,
        online: false,
        cpuUsage: { current: 0, average: 0, peak: 0 },
        memoryUsage: { current: 0, average: 0, peak: 0 },
        blockHeight: 0,
        blockTime: { current: 0, average: 0, peak: 0 },
        lastUpdate: new Date().toISOString()
      };
      this.nodeStatusCache.set(chain, offlineStatus);
    } else {
      // 更新为离线状态，保留历史数据
      const history = this.nodeHistory.get(chain);
      const offlineStatus: NodeStatus = {
        ...existingStatus,
        online: false,
        cpuUsage: { ...existingStatus.cpuUsage, current: 0 },
        memoryUsage: { ...existingStatus.memoryUsage, current: 0 },
        blockTime: { ...existingStatus.blockTime, current: 0 },
        lastUpdate: new Date().toISOString()
      };
      this.nodeStatusCache.set(chain, offlineStatus);
    }

    logger.warn(`节点已标记为离线: ${chain}`);
  }

  /**
   * 清理过期的节点状态数据
   * @param maxAge 最大年龄（毫秒）
   */
  cleanupExpiredNodes(maxAge: number = 10 * 60 * 1000): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [chain, status] of this.nodeStatusCache.entries()) {
      const lastUpdate = new Date(status.lastUpdate).getTime();
      if (now - lastUpdate > maxAge) {
        this.markNodeOffline(chain);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了 ${cleanedCount} 个过期节点状态`);
    }
  }

  /**
   * 初始化模拟数据（用于开发测试） - 只为启用的链生成数据
   */
  initMockData(): void {
    // 获取启用的链
    const enabledChains = chainService.getEnabledChains();
    
    enabledChains.forEach((chainConfig, index) => {
      const chain = chainConfig.id;
      const isOnline = Math.random() > 0.2; // 80%在线率
      
      this.updateNodeStatus(chain, {
        online: isOnline,
        cpuUsage: isOnline ? 30 + Math.random() * 40 : 0,
        memoryUsage: isOnline ? 50 + Math.random() * 30 : 0,
        blockHeight: Math.floor(Math.random() * 1000000),
        blockTime: isOnline ? 1000 + Math.random() * 2000 : 0
      });
    });

    logger.info(`节点服务模拟数据已初始化: ${enabledChains.length}个启用链`, {
      enabledChains: enabledChains.map(c => c.id)
    });
  }

  /**
   * 获取节点统计摘要 - 只统计启用链的数据
   */
  getNodeSummary() {
    const allNodes = Array.from(this.nodeStatusCache.values());
    
    // 获取启用的链列表
    const enabledChainIds = chainService.getEnabledChains().map(chain => chain.id);
    
    // 只统计启用链的节点
    const enabledNodes = allNodes.filter(node => enabledChainIds.includes(node.chain));
    
    return {
      total: enabledNodes.length,
      online: enabledNodes.filter(n => n.online).length,
      offline: enabledNodes.filter(n => !n.online).length,
      avgCpuUsage: this.calculateAverageMetric(enabledNodes, 'cpuUsage'),
      avgMemoryUsage: this.calculateAverageMetric(enabledNodes, 'memoryUsage'),
      avgBlockTime: this.calculateAverageMetric(enabledNodes, 'blockTime')
    };
  }

  /**
   * 计算在线节点的平均指标
   */
  private calculateAverageMetric(nodes: NodeStatus[], metric: 'cpuUsage' | 'memoryUsage' | 'blockTime'): number {
    const onlineNodes = nodes.filter(n => n.online);
    if (onlineNodes.length === 0) return 0;
    
    const sum = onlineNodes.reduce((acc, node) => acc + node[metric].current, 0);
    return Number((sum / onlineNodes.length).toFixed(2));
  }
} 