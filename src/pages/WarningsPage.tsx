import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, Checkbox, Divider, Drawer, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { Eye, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { useDashboard } from '../context/DashboardContext';
import { WarningInfo } from '../types';

const WarningsPage = () => {
  const { warnings, deleteWarning, batchDeleteWarnings, getChainColor, getChainDisplayName } = useDashboard();
  const [selectedWarning, setSelectedWarning] = useState<WarningInfo | null>(null);
  const [warningDetailVisible, setWarningDetailVisible] = useState(false);
  const [selectedWarningIds, setSelectedWarningIds] = useState<number[]>([]);

  return (
    <>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2}>预警中心</Title>
          <Text c="dimmed">集中查看实时预警、执行批量处理，并保留详细审查入口。</Text>
        </Stack>

        <Card withBorder radius="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Checkbox
                label="全选"
                checked={selectedWarningIds.length === warnings.length && warnings.length > 0}
                indeterminate={selectedWarningIds.length > 0 && selectedWarningIds.length < warnings.length}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    setSelectedWarningIds(warnings.map((warning) => warning.id));
                  } else {
                    setSelectedWarningIds([]);
                  }
                }}
              />
              {selectedWarningIds.length > 0 && (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<Trash2 size={14} />}
                  onClick={async () => {
                    await batchDeleteWarnings(selectedWarningIds);
                    setSelectedWarningIds([]);
                  }}
                >
                  批量删除 ({selectedWarningIds.length})
                </Button>
              )}
            </Group>

            <Divider />

            <ScrollArea h="calc(100vh - 280px)">
              <Stack gap="xs">
                {warnings.map((warning) => (
                  <Card key={warning.id} withBorder radius="md" p="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group align="flex-start" gap="xs" wrap="nowrap">
                        <Checkbox
                          checked={selectedWarningIds.includes(warning.id)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setSelectedWarningIds((previous) =>
                              checked ? [...previous, warning.id] : previous.filter((id) => id !== warning.id)
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
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={async () => {
                            await deleteWarning(warning.id);
                            setSelectedWarningIds((previous) => previous.filter((id) => id !== warning.id));
                          }}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </Card>
      </Stack>

      <Drawer opened={warningDetailVisible} onClose={() => setWarningDetailVisible(false)} title="预警详情" position="right" size="md">
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
            <Button
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={async () => {
                await deleteWarning(selectedWarning.id);
                setWarningDetailVisible(false);
              }}
            >
              删除预警
            </Button>
          </Stack>
        )}
      </Drawer>
    </>
  );
};

export default WarningsPage;
