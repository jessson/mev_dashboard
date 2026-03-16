import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { notifications } from '@mantine/notifications';
import { io, Socket } from 'socket.io-client';
import { useChains } from '../hooks/useChains';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import { apiService, getApiBaseUrl } from '../services/api';
import {
  NodeStatusResponse,
  ProfitEvent,
  SearchFilters,
  TagProfitInfo,
  TokenProfitInfo,
  TradeInfo,
  WarningInfo,
} from '../types';

interface DashboardContextValue {
  selectedChain: string;
  setSelectedChain: (chainId: string) => void;
  enabledChains: ReturnType<typeof useChains>['enabledChains'];
  getChainColor: ReturnType<typeof useChains>['getChainColor'];
  getChainDisplayName: ReturnType<typeof useChains>['getChainDisplayName'];
  getExplorerUrl: ReturnType<typeof useChains>['getExplorerUrl'];
  refreshChains: ReturnType<typeof useChains>['refetch'];
  trades: TradeInfo[];
  currentChainTrades: TradeInfo[];
  warnings: WarningInfo[];
  currentChainTagStats: TagProfitInfo[];
  currentChainTokenStats: TokenProfitInfo[];
  currentChainProfit?: ProfitEvent;
  chainProfits: Record<string, ProfitEvent>;
  loading: boolean;
  wsConnected: boolean;
  wsError: string | null;
  reconnectSocket: () => void;
  testSocket: () => void;
  searchTrades: (filters: SearchFilters) => Promise<void>;
  searchResults: TradeInfo[];
  isSearchMode: boolean;
  exitSearchMode: () => void;
  deleteWarning: (id: number) => Promise<void>;
  batchDeleteWarnings: (ids: number[]) => Promise<void>;
  fetchTradeDetail: (trade: TradeInfo) => Promise<TradeInfo>;
  nodeStatus: NodeStatusResponse | null;
  nodeStatusLoading: boolean;
  fetchNodeStatus: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  tokenScrollRef: RefObject<HTMLDivElement>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const groupTagProfitsByChain = (rows: TagProfitInfo[]) =>
  rows.reduce<Record<string, TagProfitInfo[]>>((accumulator, row) => {
    if (!row.chain) return accumulator;
    accumulator[row.chain] = [...(accumulator[row.chain] || []), row];
    return accumulator;
  }, {});

export const DashboardProvider = ({ children }: PropsWithChildren) => {
  const { enabledChains, getChainColor, getChainDisplayName, getExplorerUrl, refetch: refreshChains } = useChains();

  const [selectedChain, setSelectedChain] = useState('');
  const [trades, setTrades] = useState<TradeInfo[]>([]);
  const [searchResults, setSearchResults] = useState<TradeInfo[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [warnings, setWarnings] = useState<WarningInfo[]>([]);
  const [chainTagStats, setChainTagStats] = useState<Record<string, TagProfitInfo[]>>({});
  const [chainTokenStats, setChainTokenStats] = useState<Record<string, TokenProfitInfo[]>>({});
  const [chainProfits, setChainProfits] = useState<Record<string, ProfitEvent>>({});
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketVersion, setSocketVersion] = useState(0);
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null);
  const [nodeStatusLoading, setNodeStatusLoading] = useState(false);

  const tokenScrollRef = useScrollPreservation({ dependencies: [chainTokenStats], enabled: true });

  useEffect(() => {
    if (enabledChains.length === 0) return;

    const chainExists = enabledChains.some((chain) => chain.id === selectedChain);
    if (!selectedChain || !chainExists) {
      setSelectedChain(enabledChains[0].id);
    }
  }, [enabledChains, selectedChain]);

  const fetchNodeStatus = useCallback(async () => {
    try {
      setNodeStatusLoading(true);
      const data = await apiService.getNodeStatus();
      setNodeStatus(data);
    } catch {
      notifications.show({ title: '节点状态', message: '获取节点状态失败', color: 'red' });
    } finally {
      setNodeStatusLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const [historyData, profitData, tagProfitData, tokenData] = await Promise.all([
        apiService.getHistory(),
        apiService.getProfit(),
        apiService.getTagDailyProfit(),
        apiService.getTokenStats(),
      ]);

      setTrades(historyData.trades || []);
      setWarnings(
        (historyData.warnings || []).filter(
          (warning: WarningInfo, index: number, list: WarningInfo[]) =>
            index === list.findIndex((item) => item.id === warning.id)
        )
      );

      if (Array.isArray(profitData)) {
        setChainProfits(
          profitData.reduce<Record<string, ProfitEvent>>((accumulator, profit) => {
            if (profit.chain) {
              accumulator[profit.chain] = profit;
            }
            return accumulator;
          }, {})
        );
      }

      if (Array.isArray(tagProfitData)) {
        setChainTagStats(groupTagProfitsByChain(tagProfitData));
      }

      setChainTokenStats(tokenData?.tokens || {});
    } catch {
      notifications.show({ title: '加载失败', message: '获取数据失败', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    void fetchNodeStatus();
  }, [fetchDashboard, fetchNodeStatus]);

  useEffect(() => {
    let socketInstance: Socket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setWsError('连接失败次数过多，请稍后刷新页面');
        return;
      }

      try {
        socketInstance = io(getApiBaseUrl(), {
          path: '/socket.io',
          transports: ['polling', 'websocket'],
          timeout: 45000,
          forceNew: true,
          reconnection: false,
          autoConnect: true,
          auth: {
            token: localStorage.getItem('token'),
          },
        });

        socketInstance.on('connect', () => {
          setWsConnected(true);
          setWsError(null);
          setSocket(socketInstance);
          reconnectAttempts = 0;

          if (selectedChain) {
            socketInstance?.emit('join-chain', selectedChain);
          }
        });

        socketInstance.on('disconnect', (reason) => {
          setWsConnected(false);
          setSocket(null);

          if (!isManualClose && reason !== 'io client disconnect') {
            reconnectAttempts += 1;
            const delays = [1000, 2000, 5000, 10000, 15000];
            const delay = delays[Math.min(reconnectAttempts - 1, delays.length - 1)];
            setWsError(`连接断开，${delay / 1000} 秒后重连 (${reconnectAttempts}/${maxReconnectAttempts})`);
            reconnectTimer = setTimeout(connectSocket, delay);
          }
        });

        socketInstance.on('new_trade', (payload) => {
          if (isSearchMode) return;

          const tradeData = payload.data || payload;
          if (!tradeData) return;

          setTrades((previous) => {
            const exists = previous.some((trade) => trade.hash === tradeData.hash);
            if (exists) return previous;

            notifications.show({
              title: '新交易',
              message: `${tradeData.chain} - $${tradeData.income?.toFixed(4) || '0.0000'}`,
              color: 'green',
            });

            return [tradeData, ...previous.slice(0, 499)];
          });
        });

        socketInstance.on('trade_update', (payload) => {
          if (isSearchMode) return;

          const tradeData = payload.data || payload;
          if (!tradeData) return;

          setTrades((previous) => {
            const exists = previous.some((trade) => trade.hash === tradeData.hash);
            if (exists) return previous;

            return [tradeData, ...previous.slice(0, 499)];
          });
        });

        socketInstance.on('new_warning', (payload) => {
          const warningData = payload.data || payload;
          if (!warningData) return;

          setWarnings((previous) => {
            if (previous.some((warning) => warning.id === warningData.id)) {
              return previous;
            }

            notifications.show({
              title: '新预警',
              message: `${warningData.chain} - ${warningData.type}`,
              color: 'yellow',
            });

            return [warningData, ...previous];
          });
        });

        socketInstance.on('warning_update', (payload) => {
          const warningData = payload.data || payload;
          if (!warningData) return;

          setWarnings((previous) => {
            if (previous.some((warning) => warning.id === warningData.id)) {
              return previous;
            }

            return [warningData, ...previous];
          });
        });

        socketInstance.on('tag_profits_changed', async (payload) => {
          const tagProfitsData = payload.data || payload;

          if (tagProfitsData?.chain && Array.isArray(tagProfitsData.tagProfits)) {
            setChainTagStats((previous) => ({
              ...previous,
              [tagProfitsData.chain]: tagProfitsData.tagProfits,
            }));
            return;
          }

          if (Array.isArray(tagProfitsData)) {
            setChainTagStats(groupTagProfitsByChain(tagProfitsData));
            return;
          }

          try {
            const fallback = await apiService.getTagDailyProfit();
            setChainTagStats(groupTagProfitsByChain(fallback));
          } catch {
            // ignore fallback errors
          }
        });

        socketInstance.on('token_profits_changed', (payload) => {
          const tokenProfitsData = payload.data || payload;

          if (tokenProfitsData?.chain && Array.isArray(tokenProfitsData.tokenProfits)) {
            setChainTokenStats((previous) => ({
              ...previous,
              [tokenProfitsData.chain]: tokenProfitsData.tokenProfits,
            }));
            return;
          }

          if (tokenProfitsData?.tokens && selectedChain) {
            setChainTokenStats((previous) => ({
              ...previous,
              [selectedChain]: tokenProfitsData.tokens,
            }));
          }
        });

        socketInstance.on('profit_update', (payload) => {
          const profitData = payload.data || payload;

          if (profitData?.chain) {
            setChainProfits((previous) => ({ ...previous, [profitData.chain]: profitData }));
          }
        });

        socketInstance.on('profit_changed', (payload) => {
          const profitData = payload.data || payload;

          if (profitData?.chain) {
            setChainProfits((previous) => ({ ...previous, [profitData.chain]: profitData }));
          }
        });

        socketInstance.on('node_status_update', (payload) => {
          const nodeStatusData = payload.data || payload;
          if (nodeStatusData) {
            setNodeStatus(nodeStatusData);
          }
        });

        socketInstance.on('connect_error', (error) => {
          setWsConnected(false);
          setSocket(null);

          if (error.message.includes('timeout')) {
            setWsError('连接超时，请检查网络');
          } else if (error.message.includes('ECONNREFUSED')) {
            setWsError('服务器拒绝连接');
          } else {
            setWsError(`连接错误: ${error.message}`);
          }

          if (!isManualClose && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts += 1;
            const delays = [1000, 2000, 5000, 10000, 15000];
            const delay = delays[Math.min(reconnectAttempts - 1, delays.length - 1)];
            reconnectTimer = setTimeout(connectSocket, delay);
          }
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '未知错误';
        setWsConnected(false);
        setWsError(`初始化失败: ${message}`);
      }
    };

    const handleOnline = () => {
      if (!socketInstance || !socketInstance.connected) {
        reconnectAttempts = 0;
        connectSocket();
      }
    };

    const handleOffline = () => {
      setWsError('网络连接断开');
      setWsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connectTimer = setTimeout(connectSocket, 1200);

    return () => {
      isManualClose = true;
      clearTimeout(connectTimer);

      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketInstance) socketInstance.disconnect();

      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSearchMode, selectedChain, socketVersion]);

  useEffect(() => {
    if (socket && socket.connected && selectedChain) {
      socket.emit('join-chain', selectedChain);
    }
  }, [selectedChain, socket]);

  const searchTrades = useCallback(async (filters: SearchFilters) => {
    try {
      setLoading(true);
      const data = await apiService.searchTrades(filters);
      setSearchResults(data);
      setIsSearchMode(true);
    } catch {
      notifications.show({ title: '搜索失败', message: '请稍后重试', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchResults([]);
  }, []);

  const deleteWarning = useCallback(async (id: number) => {
    try {
      await apiService.deleteWarning(id);
      setWarnings((previous) => previous.filter((warning) => warning.id !== id));
      notifications.show({ title: '删除成功', message: '预警已删除', color: 'green' });
    } catch {
      notifications.show({ title: '删除失败', message: '请稍后重试', color: 'red' });
    }
  }, []);

  const batchDeleteWarnings = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      notifications.show({ title: '未选择', message: '请选择要删除的预警', color: 'yellow' });
      return;
    }

    try {
      await Promise.all(ids.map((id) => apiService.deleteWarning(id)));
      setWarnings((previous) => previous.filter((warning) => !ids.includes(warning.id)));
      notifications.show({
        title: '批量删除成功',
        message: `成功删除 ${ids.length} 条预警`,
        color: 'green',
      });
    } catch {
      notifications.show({ title: '批量删除失败', message: '请稍后重试', color: 'red' });
    }
  }, []);

  const fetchTradeDetail = useCallback(async (trade: TradeInfo) => {
    try {
      const detail = await apiService.getTradeDetail(trade.id);
      return {
        ...detail,
        created_at: detail.created_at || detail.createdAt || trade.created_at,
      } as TradeInfo;
    } catch {
      return trade;
    }
  }, []);

  const reconnectSocket = useCallback(() => {
    setSocketVersion((value) => value + 1);
  }, []);

  const testSocket = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit('ping', { test: true, timestamp: Date.now() });
      notifications.show({ title: '连接测试', message: 'Socket.IO 连接测试中...', color: 'blue' });
      return;
    }

    notifications.show({ title: '连接测试', message: 'Socket.IO 未连接', color: 'yellow' });
  }, [socket]);

  const currentChainTrades = useMemo(
    () => (isSearchMode ? searchResults : trades.filter((trade) => trade.chain === selectedChain)),
    [isSearchMode, searchResults, selectedChain, trades]
  );

  const currentChainTagStats = useMemo(
    () => [...(chainTagStats[selectedChain] || [])].sort((left, right) => right.totalProfit - left.totalProfit),
    [chainTagStats, selectedChain]
  );

  const currentChainTokenStats = useMemo(
    () => chainTokenStats[selectedChain] || [],
    [chainTokenStats, selectedChain]
  );

  const currentChainProfit = useMemo(() => chainProfits[selectedChain], [chainProfits, selectedChain]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      selectedChain,
      setSelectedChain,
      enabledChains,
      getChainColor,
      getChainDisplayName,
      getExplorerUrl,
      refreshChains,
      trades,
      currentChainTrades,
      warnings,
      currentChainTagStats,
      currentChainTokenStats,
      currentChainProfit,
      chainProfits,
      loading,
      wsConnected,
      wsError,
      reconnectSocket,
      testSocket,
      searchTrades,
      searchResults,
      isSearchMode,
      exitSearchMode,
      deleteWarning,
      batchDeleteWarnings,
      fetchTradeDetail,
      nodeStatus,
      nodeStatusLoading,
      fetchNodeStatus,
      refreshDashboard: fetchDashboard,
      tokenScrollRef,
    }),
    [
      batchDeleteWarnings,
      chainProfits,
      currentChainProfit,
      currentChainTagStats,
      currentChainTokenStats,
      currentChainTrades,
      deleteWarning,
      enabledChains,
      exitSearchMode,
      fetchDashboard,
      fetchNodeStatus,
      fetchTradeDetail,
      getChainColor,
      getChainDisplayName,
      getExplorerUrl,
      isSearchMode,
      loading,
      nodeStatus,
      nodeStatusLoading,
      reconnectSocket,
      refreshChains,
      searchResults,
      searchTrades,
      selectedChain,
      testSocket,
      tokenScrollRef,
      trades,
      warnings,
      wsConnected,
      wsError,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }

  return context;
};
