import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Menu,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Eye,
  Filter,
  LogOut,
  Menu as MenuIcon,
  Search,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import dayjs from 'dayjs';
import { io, Socket } from 'socket.io-client';
import {
  NodeStatusResponse,
  ProfitEvent,
  SearchFilters,
  TagProfitInfo,
  TokenProfitInfo,
  TradeInfo,
  WarningInfo,
} from '../types';
import { apiService } from '../services/api';
import { useChains } from '../hooks/useChains';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import ChainManager from './ChainManager';
import NodeStatusModal from './NodeStatusModal';
import { MobileTradeCard, ProfitStatistics, SidebarContent } from './TradingComponents';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

const DESKTOP_PAGE_SIZE = 20;

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const { enabledChains, getChainColor, getChainDisplayName, getExplorerUrl } = useChains();

  const [selectedChain, setSelectedChain] = useState<string>('');
  const [trades, setTrades] = useState<TradeInfo[]>([]);
  const [searchResults, setSearchResults] = useState<TradeInfo[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [warnings, setWarnings] = useState<WarningInfo[]>([]);
  const [chainTagStats, setChainTagStats] = useState<{ [chain: string]: TagProfitInfo[] }>({});
  const [chainTokenStats, setChainTokenStats] = useState<{ [chain: string]: TokenProfitInfo[] }>({});
  const [chainProfits, setChainProfits] = useState<{ [chain: string]: ProfitEvent }>({});

  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [chainManagerVisible, setChainManagerVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [warningDrawerVisible, setWarningDrawerVisible] = useState(false);
  const [warningDetailVisible, setWarningDetailVisible] = useState(false);

  const [tradeDetailVisible, setTradeDetailVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeInfo | null>(null);
  const [selectedWarning, setSelectedWarning] = useState<WarningInfo | null>(null);

  const [selectedWarningIds, setSelectedWarningIds] = useState<number[]>([]);

  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null);
  const [nodeStatusModalVisible, setNodeStatusModalVisible] = useState(false);
  const [nodeStatusLoading, setNodeStatusLoading] = useState(false);

  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<SearchFilters>({
    sort: 'createdAt',
    order: 'desc',
    limit: 500,
    keyword: '',
    tag: '',
  });
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const tokenScrollRef = useScrollPreservation({ dependencies: [chainTokenStats], enabled: true });

  useEffect(() => {
    if (enabledChains.length > 0 && !selectedChain) {
      setSelectedChain(enabledChains[0].id);
    }
  }, [enabledChains, selectedChain]);

  useEffect(() => {
    if (!selectedChain) return;
    setFilters((prev) => ({ ...prev, chain: selectedChain }));
    setPage(1);
    if (isSearchMode) {
      setIsSearchMode(false);
      setSearchResults([]);
    }
  }, [selectedChain]);

  const currentChainTagStats = useMemo(() => {
    return [...(chainTagStats[selectedChain] || [])].sort((a, b) => b.totalProfit - a.totalProfit);
  }, [chainTagStats, selectedChain]);

  const currentChainProfit = useMemo(() => chainProfits[selectedChain], [chainProfits, selectedChain]);

  const displayTrades = useMemo(() => {
    const base = isSearchMode ? searchResults : trades.filter((trade) => trade.chain === selectedChain);
    return base;
  }, [isSearchMode, searchResults, selectedChain, trades]);

  const paginatedTrades = useMemo(() => {
    if (isMobile) return displayTrades.slice(0, 50);
    const start = (page - 1) * DESKTOP_PAGE_SIZE;
    return displayTrades.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [displayTrades, isMobile, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(displayTrades.length / DESKTOP_PAGE_SIZE)), [displayTrades.length]);

  const getWebSocketUrl = (): string => {
    if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
    if (import.meta.env.DEV) return 'http://localhost:3000';
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  };

  useEffect(() => {
    let socketInstance: Socket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setWsError('连接失败次数过多，请刷新页面');
        return;
      }

      try {
        socketInstance = io(getWebSocketUrl(), {
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
            setWsError(`连接断开，${delay / 1000}秒后重连 (${reconnectAttempts}/${maxReconnectAttempts})`);
            reconnectTimer = setTimeout(connectSocket, delay);
          }
        });

        socketInstance.on('new_trade', (data) => {
          if (isSearchMode) return;
          const tradeData = data.data || data;
          if (!tradeData) return;
          setTrades((prev) => {
            const exists = prev.some((t) => t.hash === tradeData.hash);
            if (exists) return prev;
            notifications.show({
              title: '新交易',
              message: `${tradeData.chain} - $${tradeData.income?.toFixed(4) || '0.0000'}`,
              color: 'green',
            });
            return [tradeData, ...prev.slice(0, 499)];
          });
        });

        socketInstance.on('trade_update', (data) => {
          if (isSearchMode) return;
          const tradeData = data.data || data;
          if (!tradeData) return;
          setTrades((prev) => {
            const exists = prev.some((t) => t.hash === tradeData.hash);
            if (exists) return prev;
            return [tradeData, ...prev.slice(0, 499)];
          });
        });

        socketInstance.on('new_warning', (data) => {
          const warningData = data.data || data;
          if (!warningData) return;
          setWarnings((prev) => {
            if (prev.some((w) => w.id === warningData.id)) return prev;
            notifications.show({
              title: '新预警',
              message: `${warningData.chain} - ${warningData.type}`,
              color: 'yellow',
            });
            return [warningData, ...prev];
          });
        });

        socketInstance.on('warning_update', (data) => {
          const warningData = data.data || data;
          if (!warningData) return;
          setWarnings((prev) => {
            if (prev.some((w) => w.id === warningData.id)) return prev;
            return [warningData, ...prev];
          });
        });

        socketInstance.on('tag_profits_changed', async (data) => {
          const tagProfitsData = data.data || data;
          if (tagProfitsData?.chain && Array.isArray(tagProfitsData.tagProfits)) {
            setChainTagStats((prev) => ({ ...prev, [tagProfitsData.chain]: tagProfitsData.tagProfits }));
            return;
          }

          if (Array.isArray(tagProfitsData)) {
            const grouped: { [chain: string]: TagProfitInfo[] } = {};
            tagProfitsData.forEach((tag) => {
              if (!tag.chain) return;
              if (!grouped[tag.chain]) grouped[tag.chain] = [];
              grouped[tag.chain].push(tag);
            });
            setChainTagStats(grouped);
            return;
          }

          try {
            const fallback = await apiService.getTagDailyProfit();
            const grouped: { [chain: string]: TagProfitInfo[] } = {};
            fallback.forEach((tag) => {
              if (!tag.chain) return;
              if (!grouped[tag.chain]) grouped[tag.chain] = [];
              grouped[tag.chain].push(tag);
            });
            setChainTagStats(grouped);
          } catch {
            // ignore fallback errors
          }
        });

        socketInstance.on('token_profits_changed', (data) => {
          const tokenProfitsData = data.data || data;
          if (tokenProfitsData?.chain && Array.isArray(tokenProfitsData.tokenProfits)) {
            setChainTokenStats((prev) => ({ ...prev, [tokenProfitsData.chain]: tokenProfitsData.tokenProfits }));
            return;
          }
          if (tokenProfitsData?.tokens && selectedChain) {
            setChainTokenStats((prev) => ({ ...prev, [selectedChain]: tokenProfitsData.tokens }));
          }
        });

        socketInstance.on('profit_update', (data) => {
          const profitData = data.data || data;
          if (profitData?.chain) {
            setChainProfits((prev) => ({ ...prev, [profitData.chain]: profitData }));
          }
        });

        socketInstance.on('profit_changed', (data) => {
          const profitData = data.data || data;
          if (profitData?.chain) {
            setChainProfits((prev) => ({ ...prev, [profitData.chain]: profitData }));
          }
        });

        socketInstance.on('node_status_update', (data) => {
          const nodeStatusData = data.data || data;
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
      } catch (error: any) {
        setWsConnected(false);
        setWsError(`初始化失败: ${error.message}`);
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

    const connectTimer = setTimeout(connectSocket, 1500);

    return () => {
      isManualClose = true;
      clearTimeout(connectTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketInstance) socketInstance.disconnect();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSearchMode, selectedChain]);

  useEffect(() => {
    if (socket && socket.connected && selectedChain) {
      socket.emit('join-chain', selectedChain);
    }
  }, [selectedChain, socket]);

  const fetchNodeStatus = async () => {
    try {
      setNodeStatusLoading(true);
      const data = await apiService.getNodeStatus();
      setNodeStatus(data);
    } catch {
      notifications.show({ title: '节点状态', message: '获取节点状态失败', color: 'red' });
    } finally {
      setNodeStatusLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyData, profitData, tagProfitData, tokenData] = await Promise.all([
        apiService.getHistory(),
        apiService.getProfit(),
        apiService.getTagDailyProfit(),
        apiService.getTokenStats(),
      ]);

      setTrades(historyData.trades || []);

      const uniqueWarnings = (historyData.warnings || []).filter(
        (warning: WarningInfo, index: number, self: WarningInfo[]) =>
          index === self.findIndex((w: WarningInfo) => w.id === warning.id)
      );
      setWarnings(uniqueWarnings);

      if (Array.isArray(profitData)) {
        const profitsByChain: { [chain: string]: ProfitEvent } = {};
        profitData.forEach((profit) => {
          if (profit.chain) {
            profitsByChain[profit.chain] = profit;
          }
        });
        setChainProfits(profitsByChain);
      }

      if (Array.isArray(tagProfitData)) {
        const grouped: { [chain: string]: TagProfitInfo[] } = {};
        tagProfitData.forEach((tag) => {
          if (!tag.chain) return;
          if (!grouped[tag.chain]) grouped[tag.chain] = [];
          grouped[tag.chain].push(tag);
        });
        setChainTagStats(grouped);
      }

      setChainTokenStats(tokenData?.tokens || {});
    } catch {
      notifications.show({ title: '加载失败', message: '获取数据失败', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNodeStatus();
  }, []);

  const searchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const payload: SearchFilters = {
        ...filters,
        start: filters.start || dayjs().format('YYYY-MM-DD'),
        end: filters.end || dayjs().format('YYYY-MM-DD'),
      };

      const data = await apiService.searchTrades(payload);
      setSearchResults(data);
      setIsSearchMode(true);
      setPage(1);
    } catch {
      notifications.show({ title: '搜索失败', message: '请稍后重试', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchResults([]);
    setPage(1);
  }, []);

  const handleDeleteWarning = async (id: number) => {
    try {
      await apiService.deleteWarning(id);
      setWarnings((prev) => prev.filter((w) => w.id !== id));
      setSelectedWarningIds((prev) => prev.filter((wId) => wId !== id));
      notifications.show({ title: '删除成功', message: '预警已删除', color: 'green' });
    } catch {
      notifications.show({ title: '删除失败', message: '请稍后重试', color: 'red' });
    }
  };

  const handleBatchDeleteWarnings = async () => {
    if (selectedWarningIds.length === 0) {
      notifications.show({ title: '未选择', message: '请选择要删除的预警', color: 'yellow' });
      return;
    }

    try {
      await Promise.all(selectedWarningIds.map((id) => apiService.deleteWarning(id)));
      setWarnings((prev) => prev.filter((w) => !selectedWarningIds.includes(w.id)));
      notifications.show({
        title: '批量删除成功',
        message: `成功删除 ${selectedWarningIds.length} 条预警`,
        color: 'green',
      });
      setSelectedWarningIds([]);
    } catch {
      notifications.show({ title: '批量删除失败', message: '请稍后重试', color: 'red' });
    }
  };

  const handleTradeHashClick = async (trade: TradeInfo) => {
    if (user?.type !== 'admin') return;

    try {
      const response = await fetch(`/api/trade/${trade.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const fullTradeDetail = await response.json();
        setSelectedTrade({
          ...fullTradeDetail,
          created_at: fullTradeDetail.created_at || fullTradeDetail.createdAt || trade.created_at,
        });
      } else {
        setSelectedTrade(trade);
      }
    } catch {
      setSelectedTrade(trade);
    }

    setTradeDetailVisible(true);
  };

  const handleReconnectSocket = useCallback(() => {
    window.location.reload();
  }, []);

  const handleTestSocket = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit('ping', { test: true, timestamp: Date.now() });
      notifications.show({ title: '连接测试', message: 'Socket.IO连接测试中...', color: 'blue' });
      return;
    }
    notifications.show({ title: '连接测试', message: 'Socket.IO未连接', color: 'yellow' });
  }, [socket]);

  return (
    <Box mih="100vh" bg="linear-gradient(170deg, #f4f8ff 0%, #f7fbff 38%, #f3f7ff 100%)">
      <Paper shadow="sm" withBorder radius={0} p="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {isMobile && (
              <ActionIcon variant="subtle" onClick={() => setSidebarVisible(true)}>
                <MenuIcon size={18} />
              </ActionIcon>
            )}
            <Title order={4}>MEV Dashboard</Title>
            <Badge color={wsConnected ? 'green' : 'red'} leftSection={wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}>
              {wsConnected ? '实时连接' : '连接断开'}
            </Badge>
            {!isMobile && wsError && (
              <Button size="xs" variant="subtle" onClick={handleReconnectSocket}>
                重连
              </Button>
            )}
            {!isMobile && nodeStatus && (
              <Button
                size="xs"
                variant="light"
                leftSection={<Server size={14} />}
                onClick={() => setNodeStatusModalVisible(true)}
              >
                节点 {nodeStatus.summary.online}/{nodeStatus.summary.total}
              </Button>
            )}
          </Group>

          <Group gap="xs" wrap="nowrap">
            {!isMobile && <Text size="sm">欢迎, {user?.username}</Text>}
            {!isMobile && user?.type === 'admin' && (
              <Button variant="light" leftSection={<Bell size={14} />} onClick={() => setWarningDrawerVisible(true)}>
                预警 ({warnings.length})
              </Button>
            )}
            <Button color="red" variant="light" leftSection={<LogOut size={14} />} onClick={onLogout}>
              {!isMobile && '退出'}
            </Button>
          </Group>
        </Group>
      </Paper>

      <Group align="flex-start" gap="md" p="md" wrap="nowrap">
        {!isMobile && (
          <Paper withBorder radius="md" w={320} p="xs" style={{ position: 'sticky', top: 16 }}>
            <SidebarContent
              enabledChains={enabledChains}
              selectedChain={selectedChain}
              onChainSelect={setSelectedChain}
              tokenStats={chainTokenStats[selectedChain] || []}
              tokenScrollRef={tokenScrollRef}
              tagStats={currentChainTagStats}
              getExplorerUrl={getExplorerUrl}
              isAdmin={user?.type === 'admin'}
              onChainManagerOpen={() => setChainManagerVisible(true)}
            />
          </Paper>
        )}

        <Stack flex={1} gap="md">
          {wsError && (
            <Alert color="yellow" title="Socket.IO连接异常" icon={<WifiOff size={16} />}>
              <Group justify="space-between">
                <Text size="sm">{wsError}</Text>
                <Group gap={6}>
                  <Button size="xs" variant="light" onClick={handleTestSocket}>
                    测试
                  </Button>
                  <Button size="xs" variant="light" onClick={handleReconnectSocket}>
                    重连
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}

          {isSearchMode && (
            <Alert color="blue" title="搜索模式" icon={<Filter size={16} />}>
              <Group justify="space-between">
                <Text size="sm">显示 {searchResults.length} 条搜索结果，实时更新已暂停</Text>
                <Button size="xs" variant="subtle" leftSection={<ArrowLeft size={14} />} onClick={exitSearchMode}>
                  返回实时模式
                </Button>
              </Group>
            </Alert>
          )}

          {currentChainProfit && <ProfitStatistics profitData={currentChainProfit} isMobile={Boolean(isMobile)} />}

          <Card withBorder radius="md">
            <Stack gap="sm">
              <Group align="end" wrap="wrap">
                <TextInput
                  label="关键字"
                  placeholder="交易哈希 / 构建者"
                  leftSection={<Search size={14} />}
                  value={filters.keyword || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.currentTarget.value }))}
                />
                <TextInput
                  label="标签"
                  placeholder="例如 Arb"
                  value={filters.tag || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, tag: e.currentTarget.value }))}
                />
                <Select
                  label="排序字段"
                  w={120}
                  value={filters.sort || 'createdAt'}
                  onChange={(value) => setFilters((prev) => ({ ...prev, sort: value || 'createdAt' }))}
                  data={[
                    { value: 'createdAt', label: '时间' },
                    { value: 'income', label: '收益' },
                    { value: 'gross', label: '毛利' },
                    { value: 'bribe', label: '贿赂' },
                    { value: 'ratio', label: '比例' },
                    { value: 'txCount', label: '交易数' },
                  ]}
                />
                <Select
                  label="排序方式"
                  w={110}
                  value={filters.order || 'desc'}
                  onChange={(value) => setFilters((prev) => ({ ...prev, order: (value as 'asc' | 'desc') || 'desc' }))}
                  data={[
                    { value: 'desc', label: '降序' },
                    { value: 'asc', label: '升序' },
                  ]}
                />
                <DatePickerInput
                  type="range"
                  label="时间范围"
                  placeholder="开始日期 - 结束日期"
                  value={dateRange}
                  onChange={(value) => {
                    setDateRange(value as [Date | null, Date | null]);
                    setFilters((prev) => ({
                      ...prev,
                      start: value[0] ? dayjs(value[0]).format('YYYY-MM-DD') : undefined,
                      end: value[1] ? dayjs(value[1]).format('YYYY-MM-DD') : undefined,
                    }));
                  }}
                />
                <Button loading={loading} onClick={searchTrades}>
                  搜索
                </Button>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {isSearchMode ? `搜索结果: ${displayTrades.length} 条` : `共 ${displayTrades.length} 条交易记录`}
                </Text>
                {!isMobile && (
                  <Text size="sm" c="dimmed">
                    第 {page}/{totalPages} 页
                  </Text>
                )}
              </Group>

              {isMobile ? (
                <Stack gap="xs">
                  {paginatedTrades.map((trade) => (
                    <MobileTradeCard
                      key={trade.id}
                      trade={trade}
                      isAdmin={user?.type === 'admin'}
                      onTradeClick={handleTradeHashClick}
                    />
                  ))}
                  {displayTrades.length > 50 && (
                    <Text size="sm" c="dimmed" ta="center">
                      仅展示前 50 条记录
                    </Text>
                  )}
                </Stack>
              ) : (
                <>
                  <ScrollArea>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>交易数</Table.Th>
                          <Table.Th>交易类型</Table.Th>
                          <Table.Th>交易哈希</Table.Th>
                          <Table.Th>构建者</Table.Th>
                          <Table.Th>实际收入</Table.Th>
                          <Table.Th>贿赂</Table.Th>
                          <Table.Th>比例</Table.Th>
                          <Table.Th>标签</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {paginatedTrades.map((trade) => (
                          <Table.Tr key={trade.id}>
                            <Table.Td>{trade.txCount || 0}</Table.Td>
                            <Table.Td>
                              <Badge variant="light">{trade.tags?.[0] || '未知'}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                ff="monospace"
                                size="xs"
                                c={user?.type === 'admin' ? 'blue' : 'dimmed'}
                                style={{ cursor: user?.type === 'admin' ? 'pointer' : 'default' }}
                                onClick={() => handleTradeHashClick(trade)}
                              >
                                {trade.hash.slice(0, 10)}...{trade.hash.slice(-8)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="grape" variant="light">
                                {trade.builder}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text c="blue">${trade.income?.toFixed(4) || '0.0000'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text c="yellow.7">${trade.bribe?.toFixed(4) || '0.0000'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text c="red">{trade.ratio?.toFixed(2) || '0.00'}%</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {(trade.tags || []).slice(1).map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>

                  <Group justify="center" pt="xs">
                    <Pagination value={page} onChange={setPage} total={totalPages} />
                  </Group>
                </>
              )}
            </Stack>
          </Card>
        </Stack>
      </Group>

      <Drawer opened={sidebarVisible} onClose={() => setSidebarVisible(false)} title="菜单" position="left" size="sm">
        <SidebarContent
          enabledChains={enabledChains}
          selectedChain={selectedChain}
          onChainSelect={setSelectedChain}
          tokenStats={chainTokenStats[selectedChain] || []}
          tokenScrollRef={tokenScrollRef}
          tagStats={currentChainTagStats}
          getExplorerUrl={getExplorerUrl}
          isAdmin={user?.type === 'admin'}
          isMobile
          onChainManagerOpen={() => setChainManagerVisible(true)}
          onSidebarClose={() => setSidebarVisible(false)}
        />
      </Drawer>

      {user?.type === 'admin' && (
        <Drawer
          opened={warningDrawerVisible}
          onClose={() => {
            setWarningDrawerVisible(false);
            setSelectedWarningIds([]);
          }}
          title={`预警信息 (${warnings.length})`}
          position="right"
          size="md"
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Checkbox
                label="全选"
                checked={selectedWarningIds.length === warnings.length && warnings.length > 0}
                indeterminate={selectedWarningIds.length > 0 && selectedWarningIds.length < warnings.length}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    setSelectedWarningIds(warnings.map((w) => w.id));
                  } else {
                    setSelectedWarningIds([]);
                  }
                }}
              />
              {selectedWarningIds.length > 0 && (
                <Button color="red" variant="light" leftSection={<Trash2 size={14} />} onClick={handleBatchDeleteWarnings}>
                  批量删除 ({selectedWarningIds.length})
                </Button>
              )}
            </Group>

            <Divider />

            <ScrollArea h="calc(100vh - 220px)">
              <Stack gap="xs">
                {warnings.map((warning) => (
                  <Card key={warning.id} withBorder radius="md" p="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group align="flex-start" gap="xs" wrap="nowrap">
                        <Checkbox
                          checked={selectedWarningIds.includes(warning.id)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setSelectedWarningIds((prev) =>
                              checked ? [...prev, warning.id] : prev.filter((id) => id !== warning.id)
                            );
                          }}
                        />
                        <Stack gap={4}>
                          <Group gap={6}>
                            <Badge color="yellow" variant="light">
                              {warning.type}
                            </Badge>
                            <Badge style={{ backgroundColor: getChainColor(warning.chain), color: '#fff' }}>
                              {getChainDisplayName(warning.chain)}
                            </Badge>
                          </Group>
                          <Text size="sm">{warning.msg}</Text>
                          <Text size="xs" c="dimmed">
                            {dayjs(warning.create_at).format('MM-DD HH:mm')}
                          </Text>
                        </Stack>
                      </Group>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setSelectedWarning(warning);
                            setWarningDetailVisible(true);
                          }}
                        >
                          <Eye size={14} />
                        </ActionIcon>
                        <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteWarning(warning.id)}>
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Drawer>
      )}

      <Drawer
        opened={warningDetailVisible}
        onClose={() => setWarningDetailVisible(false)}
        title="预警详情"
        position="right"
        size="md"
      >
        {selectedWarning && (
          <Stack>
            <Group>
              <Text fw={600}>预警类型:</Text>
              <Badge color="yellow" variant="light">
                {selectedWarning.type}
              </Badge>
            </Group>
            <Group>
              <Text fw={600}>链:</Text>
              <Badge style={{ backgroundColor: getChainColor(selectedWarning.chain), color: '#fff' }}>
                {getChainDisplayName(selectedWarning.chain)}
              </Badge>
            </Group>
            <Group>
              <Text fw={600}>创建时间:</Text>
              <Text size="sm">{dayjs(selectedWarning.create_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </Group>
            <Card withBorder>
              <Text>{selectedWarning.msg}</Text>
            </Card>
            <Button color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDeleteWarning(selectedWarning.id)}>
              删除预警
            </Button>
          </Stack>
        )}
      </Drawer>

      <Drawer opened={tradeDetailVisible} onClose={() => setTradeDetailVisible(false)} title="交易详情" position="right" size="lg">
        {selectedTrade && (
          <Stack gap="sm">
            <Group>
              <Text fw={600}>链:</Text>
              <Badge style={{ backgroundColor: getChainColor(selectedTrade.chain), color: '#fff' }}>
                {getChainDisplayName(selectedTrade.chain)}
              </Badge>
            </Group>
            <Group>
              <Text fw={600}>构建者:</Text>
              <Text>{selectedTrade.builder}</Text>
            </Group>
            <Group>
              <Text fw={600}>交易数量:</Text>
              <Text>{selectedTrade.txCount}</Text>
            </Group>
            <Group>
              <Text fw={600}>净收益:</Text>
              <Text c="blue">${selectedTrade.income?.toFixed(4)}</Text>
            </Group>
            <Group>
              <Text fw={600}>贿赂:</Text>
              <Text c="yellow.7">${selectedTrade.bribe?.toFixed(4)}</Text>
            </Group>
            <Group>
              <Text fw={600}>比例:</Text>
              <Text c="red">{selectedTrade.ratio?.toFixed(2)}%</Text>
            </Group>

            <Text
              component="a"
              href={getExplorerUrl(selectedTrade.chain, selectedTrade.hash)}
              target="_blank"
              rel="noopener noreferrer"
              ff="monospace"
              size="sm"
              c="blue"
            >
              {selectedTrade.hash}
            </Text>

            {selectedTrade.vicHashes?.length ? (
              <Stack gap={4}>
                <Text fw={600}>受害者哈希</Text>
                {selectedTrade.vicHashes.map((hash, index) => (
                  <Text
                    key={index}
                    component="a"
                    href={getExplorerUrl(selectedTrade.chain, hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    ff="monospace"
                    size="xs"
                    c="blue"
                  >
                    {hash}
                  </Text>
                ))}
              </Stack>
            ) : null}

            {selectedTrade.tags?.length ? (
              <Group gap={4}>
                {selectedTrade.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </Group>
            ) : null}

            {selectedTrade.incTokens?.length ? (
              <Stack gap={4}>
                <Text fw={600}>涉及代币</Text>
                <Group gap={4}>
                  {selectedTrade.incTokens.map((token, index) => (
                    <Badge key={index} variant="light">
                      {token.symbol} ({token.addr.slice(0, 6)}...{token.addr.slice(-4)})
                    </Badge>
                  ))}
                </Group>
              </Stack>
            ) : null}

            <Group>
              <Text fw={600}>创建时间:</Text>
              <Text>{dayjs(selectedTrade.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </Group>

            {selectedTrade.extraInfo && (
              <Card withBorder>
                <Text ff="monospace" size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedTrade.extraInfo}
                </Text>
              </Card>
            )}
          </Stack>
        )}
      </Drawer>

      <ChainManager visible={chainManagerVisible} onClose={() => setChainManagerVisible(false)} />
      <NodeStatusModal
        visible={nodeStatusModalVisible}
        onClose={() => setNodeStatusModalVisible(false)}
        nodeStatus={nodeStatus}
        loading={nodeStatusLoading}
      />
    </Box>
  );
};

export default Dashboard;
