import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { RefreshCcw } from 'lucide-react';
import NodeStatusContent from '../components/dashboard/NodeStatusContent';
import { useDashboard } from '../context/DashboardContext';

const NodesPage = () => {
  const { nodeStatus, nodeStatusLoading, fetchNodeStatus } = useDashboard();

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={2}>节点监控</Title>
          <Text c="dimmed">把原来的节点弹窗提升为完整运维页面，方便长期监控和排查。</Text>
        </Stack>

        <Button variant="light" leftSection={<RefreshCcw size={14} />} onClick={() => void fetchNodeStatus()}>
          刷新状态
        </Button>
      </Group>

      <Card withBorder radius="md" p="lg">
        <NodeStatusContent nodeStatus={nodeStatus} loading={nodeStatusLoading} height="calc(100vh - 280px)" />
      </Card>
    </Stack>
  );
};

export default NodesPage;
