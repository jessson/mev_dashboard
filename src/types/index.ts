export interface TradeInfo {
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
  tags?: string[];
  incTokens?: TokenInfo[];
  created_at: string;
}

export interface PoolInfo {
  symbol: string;
  address: string;
  counter: number;
}

export interface TopInfo {
  chain: string;
  pools: PoolInfo[];
  builders: { name: string; address: string; counter: number }[];
}

export interface ProfitInfo {
  income: number;    // 实际收入
  gross: number;     // 总收益
  txCount: number;   // 交易数量
}

export interface ProfitEvent {
  chain: string;     // 链名称
  today: ProfitInfo; // 今日收益
  yesterday: ProfitInfo; // 昨日收益
  thisWeek: ProfitInfo;  // 本周收益
  lastWeek: ProfitInfo;  // 上周收益
  thisMonth: ProfitInfo; // 本月收益
  lastMonth: ProfitInfo; // 上月收益
}

export interface TagProfitInfo {
  chain: string;
  tag: string;
  totalProfit: number;
  txCount: number;
}

export interface WarningInfo {
  id: number;
  create_at: string;
  type: string;
  msg: string;
  chain: string;
  delete?: boolean;
}

export interface User {
  username: string;
  type: 'normal' | 'admin' | 'guess';
}

export interface SearchFilters {
  chain?: string;
  keyword?: string;
  tag?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  start?: string;
  end?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface HistoryResponse {
  trades: TradeInfo[];
  warnings: WarningInfo[];
  profits: ProfitEvent[];
  tops: TopInfo[];
}

export interface WelcomeStats {
  chain: string;
  income: number;
  txCount: number;
}

export interface ChainConfig {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  color: string;
  explorerUrl: {
    tx: string;
    address: string;
  };
  enabled: boolean;
  order: number;
}

export interface TokenInfo {
  addr: string;
  symbol: string;
}

export interface TokenProfitInfo {
  addr: string;
  symbol: string;
  count: number;
  totalProfit: number;
}

// 节点状态相关类型
export interface NodeMetric {
  current: number;     // 当前值
  average: number;     // 平均值
  peak: number;        // 最高值
}

export interface NodeStatus {
  chain: string;       // 链标识
  online: boolean;     // 是否在线
  cpuUsage: NodeMetric;     // CPU占用率 (%)
  memoryUsage: NodeMetric;  // 内存占用率 (%)
  blockHeight: number;      // 当前区块高度
  blockTime: NodeMetric;    // 追块时间 (ms)
  lastUpdate: string;       // 最后更新时间
}

export interface NodeStatusResponse {
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    offline: number;
  };
}