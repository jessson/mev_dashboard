// 动态获取API基础URL
export const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 可选：使用同源（适用于“前端端口 + API:3000，但由网关反代 /api 的场景”）
  const sameOriginFlag = String(import.meta.env.VITE_API_SAME_ORIGIN ?? '').toLowerCase();
  if (sameOriginFlag === '1' || sameOriginFlag === 'true') {
    return window.location.origin;
  }
  
  // 开发环境
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  
  // 生产环境：使用当前域名+端口3000
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
};

export const API_BASE_URL = getApiBaseUrl();

// 导入mock数据
import { 
  mockWelcomeStats, 
  mockTrades, 
  mockProfits, 
  mockWarnings, 
  mockTops, 
  mockUser,
  mockTagProfits,
  mockChains
} from './mockData';

class ApiService {
  private token: string | null = null;
  private useMock = false; // 使用真实API

  constructor() {
    this.token = localStorage.getItem('token');
    
    // 在开发环境下打印配置信息
    if (import.meta.env.DEV) {
      console.log('🔧 API服务配置:');
      console.log(`📡 API基础URL: ${API_BASE_URL}`);
      console.log(`🎭 使用Mock数据: ${this.useMock}`);
      console.log(`🔑 当前Token: ${this.token ? '已设置' : '未设置'}`);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };



    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors', // 明确指定CORS模式
        credentials: 'include', // 包含凭据
      });



      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API错误: ${response.status} - ${errorText}`);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error(`❌ 请求失败:`, error);
      
      throw error;
    }
  }

  // 模拟延迟
  private delay(ms: number = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 认证相关
  async login(username: string, password: string) {
    if (this.useMock) {
      await this.delay();
      // Mock模式下始终返回成功（仅用于开发测试）
      const mockToken = 'mock_token_' + Date.now();
      this.token = mockToken;
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      return {
        token: mockToken,
        user: mockUser
      };
    }

    const response = await this.request<{ token: string; user: any }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    this.token = response.token;
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // 测试连接
  async testConnection() {
    try {
      await this.request('/api/health');
      return true;
    } catch (error) {
      console.error('❌ API连接失败:', error);
      return false;
    }
  }

  // 链配置相关
  async getChains() {
    if (this.useMock) {
      await this.delay();
      return mockChains;
    }
    return this.request<any[]>('/api/chains');
  }

  async getEnabledChains() {
    if (this.useMock) {
      await this.delay();
      return mockChains.filter(chain => chain.enabled);
    }
    return this.request<any[]>('/api/chains/enabled');
  }

  async updateChainConfig(chainId: string, config: any) {
    if (this.useMock) {
      await this.delay();
      return { success: true };
    }
    return this.request(`/api/chains/${chainId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async addChain(config: any) {
    if (this.useMock) {
      await this.delay();
      return { success: true };
    }
    return this.request('/api/chains', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async deleteChain(chainId: string) {
    if (this.useMock) {
      await this.delay();
      return { success: true };
    }
    return this.request(`/api/chains/${chainId}`, {
      method: 'DELETE',
    });
  }

  // 数据获取
  async getHistory() {
    if (this.useMock) {
      await this.delay();
      return {
        trades: mockTrades,
        warnings: mockWarnings,
        profits: mockProfits,
        tops: mockTops
      };
    }
    
    const data = await this.request<any>('/api/history');
    
    // 确保数据格式正确
    return {
      trades: (data.trades || []).map((trade: any) => ({
        ...trade,
        // 统一时间字段 - 避免动态生成时间
        created_at: trade.created_at || trade.createdAt || '2025-01-01T00:00:00Z',
        // 确保数值字段为数字
        gross: Number(trade.gross) || 0,
        bribe: Number(trade.bribe) || 0,
        income: Number(trade.income) || 0,
        txCount: Number(trade.txCount) || 0,
        ratio: Number(trade.ratio) || 0
      })),
      warnings: data.warnings || [],
      profits: data.profits || [],
      tops: data.tops || []
    };
  }

  async getWelcomeStats() {
    if (this.useMock) {
      await this.delay(300);
      return mockWelcomeStats;
    }
    return this.request<any[]>('/api/welcome');
  }

  async getTagDailyProfit() {
    if (this.useMock) {
      await this.delay();
      return mockTagProfits;
    }
    return this.request<any[]>('/api/tag/daily-profit');
  }

  async getProfit() {
    if (this.useMock) {
      await this.delay();
      return mockProfits;
    }
    
    const data = await this.request<any[]>('/api/profit');
    console.log('收益数据原始响应:', data);
    
    // 确保收益数据格式正确
    return (data || []).map((profit: any) => ({
      ...profit,
      // 确保所有收益字段都是数字
      today: {
        income: Number(profit.today?.income) || 0,
        gross: Number(profit.today?.gross) || 0,
        txCount: Number(profit.today?.txCount) || 0
      },
      yesterday: {
        income: Number(profit.yesterday?.income) || 0,
        gross: Number(profit.yesterday?.gross) || 0,
        txCount: Number(profit.yesterday?.txCount) || 0
      },
      thisWeek: {
        income: Number(profit.thisWeek?.income) || 0,
        gross: Number(profit.thisWeek?.gross) || 0,
        txCount: Number(profit.thisWeek?.txCount) || 0
      },
      lastWeek: {
        income: Number(profit.lastWeek?.income) || 0,
        gross: Number(profit.lastWeek?.gross) || 0,
        txCount: Number(profit.lastWeek?.txCount) || 0
      },
      thisMonth: {
        income: Number(profit.thisMonth?.income) || 0,
        gross: Number(profit.thisMonth?.gross) || 0,
        txCount: Number(profit.thisMonth?.txCount) || 0
      },
      lastMonth: {
        income: Number(profit.lastMonth?.income) || 0,
        gross: Number(profit.lastMonth?.gross) || 0,
        txCount: Number(profit.lastMonth?.txCount) || 0
      }
    }));
  }

  // 交易搜索 - 修复排序参数映射
  async searchTrades(params: any) {
    if (this.useMock) {
      await this.delay();
      // 简单的mock搜索逻辑
      let filteredTrades = [...mockTrades];
      
      if (params.chain) {
        filteredTrades = filteredTrades.filter(trade => trade.chain === params.chain);
      }
      
      if (params.keyword) {
        filteredTrades = filteredTrades.filter(trade => 
          trade.hash.toLowerCase().includes(params.keyword.toLowerCase()) ||
          trade.builder.toLowerCase().includes(params.keyword.toLowerCase())
        );
      }
      
      if (params.tag) {
        filteredTrades = filteredTrades.filter(trade => 
          trade.tags?.some(tag => tag.toLowerCase().includes(params.tag.toLowerCase()))
        );
      }
      
      // 排序
      if (params.order === 'asc') {
        filteredTrades.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      } else {
        filteredTrades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      
      return filteredTrades;
    }

    // 修复排序字段映射
    const sortFieldMap: { [key: string]: string } = {
      'created_at': 'createdAt',
      'income': 'income',
      'gross': 'gross',
      'bribe': 'bribe',
      'ratio': 'ratio',
      'txCount': 'txCount'
    };

    // 映射排序字段
    const mappedParams = {
      ...params,
      sort: sortFieldMap[params.sort] || params.sort
    };

    console.log('🔍 搜索参数映射:', { 原始: params, 映射后: mappedParams });

    const queryString = new URLSearchParams(
      Object.entries(mappedParams)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)])
    ).toString();
    
    const data = await this.request<any[]>(`/api/trade/search?${queryString}`);
    
    // 确保搜索结果格式正确
    return data.map((trade: any) => ({
      ...trade,
      created_at: trade.created_at || trade.createdAt || '2025-01-01T00:00:00Z',
      gross: Number(trade.gross) || 0,
      bribe: Number(trade.bribe) || 0,
      income: Number(trade.income) || 0,
      txCount: Number(trade.txCount) || 0,
      ratio: Number(trade.ratio) || 0
    }));
  }

  // 预警相关
  async addWarning(warning: Omit<any, 'id' | 'create_at'>) {
    if (this.useMock) {
      await this.delay();
      // 模拟添加预警
      return { success: true };
    }
    return this.request('/api/warning', {
      method: 'POST',
      body: JSON.stringify(warning),
    });
  }

  async deleteWarning(id: number) {
    if (this.useMock) {
      await this.delay();
      // 模拟删除预警
      return { success: true };
    }
    return this.request(`/api/warning/${id}`, {
      method: 'DELETE',
    });
  }

  // Top信息
  async updateTop(chain: string, pools: any[]) {
    if (this.useMock) {
      await this.delay();
      return { success: true };
    }
    return this.request('/api/top', {
      method: 'POST',
      body: JSON.stringify({ chain, pools }),
    });
  }

  // Token统计相关方法
  async getTokenStats(chain?: string) {
    if (this.useMock) {
      await this.delay();
      
      // 基于mock交易数据生成token统计
      const tokenStatsMap: { [key: string]: { [addr: string]: { addr: string; symbol: string; count: number; totalProfit: number } } } = {};
      
      // 统计每个链的token数据
      mockTrades.forEach(trade => {
        if (trade.incTokens) {
          if (!tokenStatsMap[trade.chain]) {
            tokenStatsMap[trade.chain] = {};
          }
          
          trade.incTokens.forEach(token => {
            const key = token.addr.toLowerCase();
            if (!tokenStatsMap[trade.chain][key]) {
              tokenStatsMap[trade.chain][key] = {
                addr: token.addr,
                symbol: token.symbol,
                count: 0,
                totalProfit: 0
              };
            }
            tokenStatsMap[trade.chain][key].count++;
            tokenStatsMap[trade.chain][key].totalProfit += trade.income || 0;
          });
        }
      });
      
      // 转换为数组格式并排序
      const tokens: { [chain: string]: any[] } = {};
      Object.keys(tokenStatsMap).forEach(chainKey => {
        tokens[chainKey] = Object.values(tokenStatsMap[chainKey])
          .sort((a, b) => b.totalProfit - a.totalProfit);
      });
      
      // 如果指定了chain，只返回该链的数据
      if (chain) {
        return {
          chain,
          tokens: tokens[chain] || []
        };
      }
      
      // 返回所有链的数据
      const totalTokens = Object.values(tokens).reduce((sum, chainTokens) => sum + chainTokens.length, 0);
      return {
        tokens,
        stats: { 
          totalTokens, 
          totalChains: Object.keys(tokens).length, 
          cacheSize: totalTokens 
        }
      };
    }

    const endpoint = chain ? `/api/token/stats/${chain}` : '/api/token/stats';
    return this.request<any>(endpoint);
  }

  async getTopTokens(limit: number = 20) {
    if (this.useMock) {
      await this.delay();
      return {
        tokens: [
          { addr: '0x123...', symbol: 'USDT', count: 45, totalProfit: 1234.56 },
          { addr: '0x456...', symbol: 'USDC', count: 38, totalProfit: 987.34 },
          { addr: '0x789...', symbol: 'WETH', count: 32, totalProfit: 856.78 }
        ],
        limit
      };
    }

    return this.request<any>(`/api/token/top?limit=${limit}`);
  }

  async getTokenDetail(chain: string, addr: string) {
    if (this.useMock) {
      await this.delay();
      return {
        chain,
        addr,
        found: true,
        stats: { addr, symbol: 'MOCK', count: 10, totalProfit: 123.45 }
      };
    }

    return this.request<any>(`/api/token/${chain}/${addr}`);
  }

  async clearTokenCache() {
    if (this.useMock) {
      await this.delay();
      return { success: true, message: 'Mock缓存已清理' };
    }

    return this.request('/api/token/cache', {
      method: 'DELETE',
    });
  }

  async getTokenCacheStats() {
    if (this.useMock) {
      await this.delay();
      return { totalTokens: 25, totalChains: 3, cacheSize: 25 };
    }

    return this.request<any>('/api/token/cache-stats');
  }

  // 节点状态相关方法
  async getNodeStatus() {
    const response = await this.request<any>('/api/node/status');
    return response.data; // 解析嵌套的data字段
  }

  async getTradeDetail(id: number) {
    return this.request<any>(`/api/trade/${id}`);
  }
}

export const apiService = new ApiService();
