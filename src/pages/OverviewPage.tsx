import { Alert, Badge, Button, Card, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { ArrowRight, Bell, TrendingUp, WifiOff } from 'lucide-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { ProfitStatistics } from '../components/TradingComponents';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

const OverviewPage = () => {
  const { user } = useAuth();
  const {
    currentChainProfit,
    currentChainTrades,
    currentChainTagStats,
    currentChainTokenStats,
    warnings,
    wsError,
    selectedChain,
    getChainDisplayName,
  } = useDashboard();

  const isAdmin = user?.type === 'admin';
  const latestTrades = currentChainTrades.slice(0, 8);
  const latestWarnings = warnings.slice(0, 6);
  const todayIncome = currentChainProfit?.today.income || 0;
  const todayTrades = currentChainProfit?.today.txCount || 0;

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2}>{getChainDisplayName(selectedChain)} 总览</Title>
        <Text c="dimmed">将实时交易、收益、标签与运维状态拆到独立 dashboard 模块后的概览页。</Text>
      </Stack>

      {wsError && (
        <Alert color="yellow" title="实时连接异常" icon={<WifiOff size={16} />}>
          {wsError}
        </Alert>
      )}

      {currentChainProfit && <ProfitStatistics profitData={currentChainProfit} isMobile={false} />}

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        <Card withBorder radius="md">
          <Text size="sm" c="dimmed">
            今日收益
          </Text>
          <Title order={3}>${todayIncome.toFixed(2)}</Title>
          <Text size="sm" c="dimmed">
            {todayTrades} 笔交易
          </Text>
        </Card>
        <Card withBorder radius="md">
          <Text size="sm" c="dimmed">
            当前链交易池
          </Text>
          <Title order={3}>{currentChainTrades.length}</Title>
          <Text size="sm" c="dimmed">
            实时列表中保留最新 500 笔
          </Text>
        </Card>
        <Card withBorder radius="md">
          <Text size="sm" c="dimmed">
            标签覆盖
          </Text>
          <Title order={3}>{currentChainTagStats.length}</Title>
          <Text size="sm" c="dimmed">
            已聚合的利润标签
          </Text>
        </Card>
        <Card withBorder radius="md">
          <Text size="sm" c="dimmed">
            热门代币
          </Text>
          <Title order={3}>{currentChainTokenStats.length}</Title>
          <Text size="sm" c="dimmed">
            按累计利润排序
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: isAdmin ? 2 : 1 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Group gap={8}>
              <TrendingUp size={16} />
              <Title order={4}>最新交易</Title>
            </Group>
            <Button component={Link} to="/app/trades" variant="subtle" rightSection={<ArrowRight size={14} />}>
              查看全部
            </Button>
          </Group>

          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>时间</Table.Th>
                <Table.Th>交易哈希</Table.Th>
                <Table.Th>构建者</Table.Th>
                <Table.Th>净利</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {latestTrades.map((trade) => (
                <Table.Tr key={trade.id}>
                  <Table.Td>{dayjs(trade.created_at).format('MM-DD HH:mm')}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="xs">
                      {trade.hash.slice(0, 10)}...{trade.hash.slice(-8)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{trade.builder}</Table.Td>
                  <Table.Td>
                    <Text c="blue">${trade.income.toFixed(4)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {isAdmin && (
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Group gap={8}>
                <Bell size={16} />
                <Title order={4}>最新预警</Title>
              </Group>
              <Button component={Link} to="/app/warnings" variant="subtle" rightSection={<ArrowRight size={14} />}>
                查看全部
              </Button>
            </Group>

            <Stack gap="xs">
              {latestWarnings.map((warning) => (
                <Card key={warning.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Group gap={6}>
                        <Badge color="yellow" variant="light">
                          {warning.type}
                        </Badge>
                        <Badge variant="outline">{warning.chain}</Badge>
                      </Group>
                      <Text size="sm">{warning.msg}</Text>
                    </Stack>
                    <Text size="xs" c="dimmed">
                      {dayjs(warning.create_at).format('MM-DD HH:mm')}
                    </Text>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
};

export default OverviewPage;
