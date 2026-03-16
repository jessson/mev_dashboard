import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Pagination,
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
import { ArrowLeft, Filter, Search, WifiOff } from 'lucide-react';
import dayjs from 'dayjs';
import { MobileTradeCard } from '../components/TradingComponents';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { SearchFilters, TradeInfo } from '../types';

const DESKTOP_PAGE_SIZE = 20;

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

  const paginatedTrades = useMemo(() => {
    if (isMobile) return currentChainTrades.slice(0, 50);
    const start = (page - 1) * DESKTOP_PAGE_SIZE;
    return currentChainTrades.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [currentChainTrades, isMobile, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(currentChainTrades.length / DESKTOP_PAGE_SIZE)),
    [currentChainTrades.length]
  );

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
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2}>交易控制台</Title>
        <Text c="dimmed">筛选、检索并查看当前链的实时交易流与历史结果。</Text>
      </Stack>

      {wsError && (
        <Alert color="yellow" title="Socket.IO 连接异常" icon={<WifiOff size={16} />}>
          {wsError}
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

      <Card withBorder radius="md">
        <Stack gap="sm">
          <Group align="end" wrap="wrap">
            <TextInput
              label="关键字"
              placeholder="交易哈希 / 构建者"
              leftSection={<Search size={14} />}
              value={filters.keyword || ''}
              onChange={(event) => setFilters((previous) => ({ ...previous, keyword: event.currentTarget.value }))}
            />
            <TextInput
              label="标签"
              placeholder="例如 Arb"
              value={filters.tag || ''}
              onChange={(event) => setFilters((previous) => ({ ...previous, tag: event.currentTarget.value }))}
            />
            <Select
              label="排序字段"
              w={120}
              value={filters.sort || 'createdAt'}
              onChange={(value) => setFilters((previous) => ({ ...previous, sort: value || 'createdAt' }))}
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
              onChange={(value) =>
                setFilters((previous) => ({ ...previous, order: (value as 'asc' | 'desc') || 'desc' }))
              }
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
                setFilters((previous) => ({
                  ...previous,
                  start: value[0] ? dayjs(value[0]).format('YYYY-MM-DD') : undefined,
                  end: value[1] ? dayjs(value[1]).format('YYYY-MM-DD') : undefined,
                }));
              }}
            />
            <Button loading={loading} onClick={handleSearch}>
              搜索
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {isSearchMode ? `搜索结果: ${currentChainTrades.length} 条` : `共 ${currentChainTrades.length} 条交易记录`}
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
                  onTradeClick={handleTradeClick}
                />
              ))}
              {currentChainTrades.length > 50 && (
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
                            onClick={() => handleTradeClick(trade)}
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
    </Stack>
  );
};

export default TradesPage;
