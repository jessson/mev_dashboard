import {
  Card,
  Grid,
  Group,
  Progress,
  ScrollArea,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Server, Wifi, WifiOff } from 'lucide-react';
import { useChains } from '../../hooks/useChains';
import { NodeStatusResponse } from '../../types';

interface NodeStatusContentProps {
  nodeStatus: NodeStatusResponse | null;
  loading?: boolean;
  height?: number | string;
}

const getStatusColor = (value: number, warning: number, danger: number) => {
  if (value >= danger) return 'red';
  if (value >= warning) return 'yellow';
  return 'green';
};

const NodeStatusContent = ({ nodeStatus, loading = false, height = 560 }: NodeStatusContentProps) => {
  const { getChainDisplayName, getChainColor } = useChains();

  return (
    <Stack gap="md">
      {nodeStatus?.summary && (
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder>
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon variant="light" color="blue">
                    <Server size={16} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    总节点数
                  </Text>
                </Group>
                <Title order={4}>{nodeStatus.summary.total}</Title>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder>
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon variant="light" color="green">
                    <Wifi size={16} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    在线节点
                  </Text>
                </Group>
                <Title order={4} c="green">
                  {nodeStatus.summary.online}
                </Title>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder>
              <Group justify="space-between">
                <Group gap={8}>
                  <ThemeIcon variant="light" color="red">
                    <WifiOff size={16} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    离线节点
                  </Text>
                </Group>
                <Title order={4} c="red">
                  {nodeStatus.summary.offline}
                </Title>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      <ScrollArea h={height}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>链</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>CPU</Table.Th>
              <Table.Th>内存</Table.Th>
              <Table.Th>追块时间</Table.Th>
              <Table.Th>区块高度</Table.Th>
              <Table.Th>最后更新</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(nodeStatus?.nodes || []).map((node) => (
              <Table.Tr key={node.chain}>
                <Table.Td>
                  <Group gap={6}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        display: 'inline-block',
                        backgroundColor: getChainColor(node.chain),
                      }}
                    />
                    <Text fw={600}>{getChainDisplayName(node.chain)}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text c={node.online ? 'green' : 'red'} fw={600}>
                    {node.online ? '在线' : '离线'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="xs">当前 {node.cpuUsage.current.toFixed(1)}%</Text>
                    <Progress
                      value={node.cpuUsage.current}
                      color={getStatusColor(node.cpuUsage.current, 70, 90)}
                      size="sm"
                    />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="xs">当前 {node.memoryUsage.current.toFixed(1)}%</Text>
                    <Progress
                      value={node.memoryUsage.current}
                      color={getStatusColor(node.memoryUsage.current, 80, 95)}
                      size="sm"
                    />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{node.blockTime.current.toFixed(0)} ms</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{node.blockHeight}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {new Date(node.lastUpdate).toLocaleString()}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {loading && <Text c="dimmed">加载中...</Text>}
    </Stack>
  );
};

export default NodeStatusContent;
