import { z } from 'zod';

// TokenInfo类型定义
export interface TokenInfo {
  addr: string;
  symbol: string;
}

// Token统计数据
export interface TokenProfitInfo {
  addr: string;
  symbol: string;
  count: number;
  totalProfit: number;
}

export const tradeSearchSchema = {
  type: 'object',
  properties: {
    chain: { type: 'string' },
    keyword: { type: 'string' },
    tag: { type: 'string' },
    sort: { type: 'string' },
    order: { type: 'string', enum: ['asc', 'desc'] },
    limit: { type: 'number', minimum: 1, maximum: 1000 },
    start: { type: 'string' },
    end: { type: 'string' }
  }
};

export const tradeSearchZodSchema = z.object({
  chain: z.string().optional(),
  keyword: z.string().optional(),
  tag: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(1000).optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

export type TradeSearchRequest = z.infer<typeof tradeSearchZodSchema>;

export interface TradeSearchFilters {
  chain?: string;
  keyword?: string;
  tag?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  start?: string;
  end?: string;
}