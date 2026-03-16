import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import {
  ArrowLeft,
  ArrowUpRight,
  Blocks,
  CalendarRange,
  Filter,
  Hash,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import dayjs from 'dayjs';
import { MobileTradeCard } from '../components/TradingComponents';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { SearchFilters, TradeInfo } from '../types';

const DESKTOP_PAGE_SIZE = 20;

const formatCurrency = (value?: number) => `$${(value || 0).toFixed(4)}`;
const formatPercent = (value?: number) => `${(value || 0).toFixed(2)}%`;
const shortenHash = (value: string) => `${value.slice(0, 10)}...${value.slice(-8)}`;

const TradesPage = () => {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const { user } = useAuth();
  const {
    selectedChain,
    currentChainTrades,
    searchResults,
    isSearchMode,
    loading,
    wsError,
    searchTrades,
    exitSearchMode,
    fetchTradeDetail,
    getChainColor,
    getChainDisplayName,
    getExplorerUrl,
  } = useDashboard();

  const [page, setPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<TradeInfo | null>(null);
  const [tradeDetailVisible, setTradeDetailVisible] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: 'createdAt',
    order: 'desc',
    limit: 500,
    keyword: '',
    tag: '',
  });
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  useEffect(() => {
    setFilters((previous) => ({ ...previous, chain: selectedChain }));
    setPage(1);
    exitSearchMode();
  }, [selectedChain, exitSearchMode]);

  const dataSource = currentChainTrades;
  const paginatedTrades = useMemo(() => {
    if (isMobile) return dataSource.slice(0, 50);
    const start = (page - 1) * DESKTOP_PAGE_SIZE;
    return dataSource.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [dataSource, isMobile, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(dataSource.length / DESKTOP_PAGE_SIZE)), [dataSource.length]);

  const summary = useMemo(() => {
    const trades = dataSource.slice(0, 100);
    const totalIncome = trades.reduce((sum, trade) => sum + (trade.income || 0), 0);
    const totalBribe = trades.reduce((sum, trade) => sum + (trade.bribe || 0), 0);
    const avgRatio = trades.length > 0 ? trades.reduce((sum, trade) => sum + (trade.ratio || 0), 0) / trades.length : 0;

    return {
      totalIncome,
      totalBribe,
      avgRatio,
    };
  }, [dataSource]);

  const handleSearch = async () => {
    const payload: SearchFilters = {
      ...filters,
      chain: selectedChain,
      start: filters.start || dayjs().format('YYYY-MM-DD'),
      end: filters.end || dayjs().format('YYYY-MM-DD'),
    };

    await searchTrades(payload);
    setPage(1);
  };

  const handleTradeClick = async (trade: TradeInfo) => {
    if (user?.type !== 'admin') return;
    const detail = await fetchTradeDetail(trade);
    setSelectedTrade(detail);
    setTradeDetailVisible(true);
  };

  return (
    <Stack gap="lg" className="page-shell">
      <Card className="page-hero" padding="xl">
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl" verticalSpacing="lg">
          <Stack gap="md">
            <div className="terminal-eyebrow">
              <Sparkles size={14} />
              Flow Terminal
            </div>

            <div>
              <Text component="h1" className="page-title">
                交易流控制台
              </Text>
              <Text className="page-subtitle" mt="sm">
                查看当前链的实时交易与搜索结果。
              </Text>
            </div>
          </Stack>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{dataSource.length}</span>
              <span className="hero-stat-label">当前链交易池</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{formatCurrency(summary.totalIncome)}</span>
              <span className="hero-stat-label">近 100 条净收益</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{formatPercent(summary.avgRatio)}</span>
              <span className="hero-stat-label">平均比例</span>
            </div>
          </div>
        </SimpleGrid>
      </Card>

      {wsError && (
        <Alert color="yellow" title="Socket.IO 连接异常" icon={<WifiOff size={16} />}>
          {wsError}
        </Alert>
      )}

      {isSearchMode && (
        <Alert color="brand" title="搜索模式" icon={<Filter size={16} />}>
          <Group justify="space-between">
            <Text size="sm">显示 {searchResults.length} 条搜索结果，实时模式已暂停。</Text>
            <Button size="xs" variant="subtle" leftSection={<ArrowLeft size={14} />} onClick={exitSearchMode}>
              返回实时流
            </Button>
          </Group>
        </Alert>
      )}

      <Card className="surface-card filter-toolbar" padding="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-end">
            <div>
              <Text className="terminal-eyebrow">
                <Filter size={14} />
                Query Workspace
              </Text>
              <Text className="section-title" mt={8}>
                交易筛选工作台
              </Text>
              <Text c="dimmed" mt={4}>
                关键词、标签与时间筛选。
              </Text>
            </div>
            <Badge color="brand" variant="light" size="lg">
              {getChainDisplayName(selectedChain)}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} spacing="md" verticalSpacing="md">
            <TextInput
              label="关键字"
              placeholder="交易哈希 / 构建者"
              leftSection={<Search size={15} />}
              value={filters.keyword || ''}
              onChange={(event) => setFilters((previous) => ({ ...previous, keyword: event.currentTarget.value }))}
            />
            <TextInput
              label="标签"
              placeholder="例如 Arb / UniV4"
              leftSection={<Tags size={15} />}
              value={filters.tag || ''}
              onChange={(event) => setFilters((previous) => ({ ...previous, tag: event.currentTarget.value }))}
            />
            <Select
              label="排序字段"
              value={filters.sort || 'createdAt'}
              onChange={(value) => setFilters((previous) => ({ ...previous, sort: value || 'createdAt' }))}
              data={[
                { value: 'createdAt', label: '时间优先' },
                { value: 'income', label: '净收益' },
                { value: 'gross', label: '毛利' },
                { value: 'bribe', label: '贿赂' },
                { value: 'ratio', label: '比例' },
                { value: 'txCount', label: '交易数' },
              ]}
            />
            <Select
              label="排序方式"
              value={filters.order || 'desc'}
              onChange={(value) =>
                setFilters((previous) => ({ ...previous, order: (value as 'asc' | 'desc') || 'desc' }))
              }
              data={[
                { value: 'desc', label: '由高到低' },
                { value: 'asc', label: '由低到高' },
              ]}
            />
            <DatePickerInput
              type="range"
              label="时间范围"
              placeholder="开始日期 - 结束日期"
              leftSection={<CalendarRange size={15} />}
              value={dateRange}
              onChange={(value) => {
                setDateRange(value as [Date | null, Date | null]);
                setFilters((previous) => ({
                  ...previous,
                  start: value[0] ? dayjs(value[0]).format('YYYY-MM-DD') : undefined,
                  end: value[1] ? dayjs(value[1]).format('YYYY-MM-DD') : undefined,
                }));
              }}
            />
          </SimpleGrid>

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Badge size="lg" color="brand">
                近 100 条贿赂 {formatCurrency(summary.totalBribe)}
              </Badge>
              <Badge size="lg" color="orange" variant="light">
                实时链 {selectedChain.toUpperCase()}
              </Badge>
            </Group>

            <Button loading={loading} leftSection={<Search size={16} />} size="md" onClick={handleSearch}>
              执行搜索
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card className="surface-card" padding="xl">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text className="terminal-eyebrow">
                <TrendingUp size={14} />
                Live Ledger
              </Text>
              <Text className="section-title" mt={8}>
                {isSearchMode ? '搜索结果视图' : '实时交易主表'}
              </Text>
              <Text c="dimmed" mt={4}>
                {isSearchMode ? `${searchResults.length} 条结果` : `${dataSource.length} 条记录`}
              </Text>
            </div>

            {!isMobile && (
              <Badge size="lg" color="dark" variant="light">
                第 {page}/{totalPages} 页
              </Badge>
            )}
          </Group>

          {isMobile ? (
            <Stack gap="sm">
              {paginatedTrades.map((trade) => (
                <MobileTradeCard
                  key={trade.id}
                  trade={trade}
                  isAdmin={user?.type === 'admin'}
                  onTradeClick={handleTradeClick}
                />
              ))}
              {dataSource.length > 50 && (
                <Text size="sm" c="dimmed" ta="center">
                  移动端仅展示前 50 条记录
                </Text>
              )}
            </Stack>
          ) : (
            <>
              <div className="trade-table-wrap">
                <ScrollArea>
                  <Table className="trade-table" highlightOnHover horizontalSpacing="lg" verticalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>流编号</Table.Th>
                        <Table.Th>类型 / 标签</Table.Th>
                        <Table.Th>交易哈希</Table.Th>
                        <Table.Th>构建者</Table.Th>
                        <Table.Th ta="right">净收益</Table.Th>
                        <Table.Th ta="right">贿赂</Table.Th>
                        <Table.Th ta="right">比例</Table.Th>
                        <Table.Th>时间</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paginatedTrades.map((trade) => (
                        <Table.Tr key={trade.id}>
                          <Table.Td>
                            <Text fw={800}>{trade.txCount || 0}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={8}>
                              <Badge color="brand" variant="light">
                                {trade.tags?.[0] || '未知'}
                              </Badge>
                              {(trade.tags || []).slice(1, 3).map((tag) => (
                                <Badge key={tag} variant="outline" color="brand">
                                  {tag}
                                </Badge>
                              ))}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              className="mono-link"
                              style={{ cursor: user?.type === 'admin' ? 'pointer' : 'default' }}
                              onClick={() => handleTradeClick(trade)}
                            >
                              {shortenHash(trade.hash)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="violet" variant="light" size="lg">
                              {trade.builder}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text className="number-positive">{formatCurrency(trade.income)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text className="number-warning">{formatCurrency(trade.bribe)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text className="number-danger">{formatPercent(trade.ratio)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {dayjs(trade.created_at).format('MM-DD HH:mm:ss')}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </div>

              <Group justify="center" pt="sm">
                <Pagination value={page} onChange={setPage} total={totalPages} />
              </Group>
            </>
          )}
        </Stack>
      </Card>

      <Modal
        opened={tradeDetailVisible}
        onClose={() => setTradeDetailVisible(false)}
        centered
        classNames={{ content: 'center-modal' }}
        title={
          <Group gap="xs">
            <ThemeIcon color="brand" variant="light" radius="xl" size="lg">
              <Blocks size={16} />
            </ThemeIcon>
            <div>
              <Text fw={800}>交易详情</Text>
              <Text size="xs" c="dimmed">
                交易摘要与原始信息
              </Text>
            </div>
          </Group>
        }
        size="min(1100px, 92vw)"
      >
        {selectedTrade && (
          <ScrollArea className="detail-panel" h="min(72vh, 900px)">
            <Stack gap="lg">
              <div className="detail-summary-card">
                <Group justify="space-between" align="flex-start" mb="md">
                  <Stack gap={8}>
                    <Text className="terminal-eyebrow">
                      <Hash size={14} />
                      Trade Snapshot
                    </Text>
                    <Text fw={800} size="xl">
                      {selectedTrade.builder}
                    </Text>
                    <Group gap={8}>
                      <Badge style={{ backgroundColor: getChainColor(selectedTrade.chain), color: '#fff' }}>
                        {getChainDisplayName(selectedTrade.chain)}
                      </Badge>
                      <Badge color="brand" variant="outline">
                        {(selectedTrade.tags || [])[0] || '未知'}
                      </Badge>
                    </Group>
                  </Stack>

                  <Button
                    component="a"
                    href={getExplorerUrl(selectedTrade.chain, selectedTrade.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    rightSection={<ArrowUpRight size={14} />}
                  >
                    查看链上
                  </Button>
                </Group>

                <div className="detail-grid">
                  <div className="detail-metric">
                    <div className="detail-metric-label">净收益</div>
                    <div className="detail-metric-value number-positive">{formatCurrency(selectedTrade.income)}</div>
                  </div>
                  <div className="detail-metric">
                    <div className="detail-metric-label">贿赂</div>
                    <div className="detail-metric-value number-warning">{formatCurrency(selectedTrade.bribe)}</div>
                  </div>
                  <div className="detail-metric">
                    <div className="detail-metric-label">比例</div>
                    <div className="detail-metric-value number-danger">{formatPercent(selectedTrade.ratio)}</div>
                  </div>
                </div>
              </div>

              <Card className="surface-card" padding="lg">
                <Stack gap="sm">
                  <Text className="section-title">交易标识</Text>
                  <Text className="mono-block" size="sm" c="brand.6">
                    {selectedTrade.hash}
                  </Text>
                  <Group gap="xs">
                    {(selectedTrade.tags || []).map((tag) => (
                      <Badge key={tag} variant="outline" color="brand">
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <div>
                      <Text className="detail-metric-label">交易数量</Text>
                      <Text fw={800} size="lg">
                        {selectedTrade.txCount}
                      </Text>
                    </div>
                    <div>
                      <Text className="detail-metric-label">创建时间</Text>
                      <Text fw={700}>{dayjs(selectedTrade.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </div>
                  </SimpleGrid>
                </Stack>
              </Card>

              {selectedTrade.incTokens?.length ? (
                <Card className="surface-card" padding="lg">
                  <Stack gap="sm">
                    <Text className="section-title">涉及代币</Text>
                    <Group gap="xs">
                      {selectedTrade.incTokens.map((token, index) => (
                        <Badge key={`${token.addr}-${index}`} color="brand" size="lg">
                          {token.symbol} ({token.addr.slice(0, 6)}...{token.addr.slice(-4)})
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Card>
              ) : null}

              {selectedTrade.vicHashes?.length ? (
                <Card className="surface-card" padding="lg">
                  <Stack gap="sm">
                    <Text className="section-title">受害者哈希</Text>
                    {selectedTrade.vicHashes.map((hash, index) => (
                      <Text
                        key={index}
                        component="a"
                        href={getExplorerUrl(selectedTrade.chain, hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-link"
                      >
                        {hash}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              ) : null}

              {selectedTrade.extraInfo && (
                <Card className="surface-card" padding="lg">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text className="section-title">原始调试信息</Text>
                      <Badge color="dark" variant="light">
                        Raw Log
                      </Badge>
                    </Group>
                    <Divider />
                    <div className="detail-code">{selectedTrade.extraInfo}</div>
                  </Stack>
                </Card>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  );
};

export default TradesPage;
