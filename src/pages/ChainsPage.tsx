import { Card, Stack, Text, Title } from '@mantine/core';
import ChainManagementContent from '../components/dashboard/ChainManagementContent';

const ChainsPage = () => {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2}>链配置中心</Title>
        <Text c="dimmed">将原本散落在侧栏弹窗里的链配置管理提升为独立模块页面。</Text>
      </Stack>

      <Card withBorder radius="md" p="lg">
        <ChainManagementContent />
      </Card>
    </Stack>
  );
};

export default ChainsPage;
