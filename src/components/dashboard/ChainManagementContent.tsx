import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  ColorInput,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { useChains } from '../../hooks/useChains';
import { ChainConfig } from '../../types';

interface ChainFormState {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  color: string;
  txExplorerUrl: string;
  addressExplorerUrl: string;
  enabled: boolean;
  order: number;
}

const defaultForm: ChainFormState = {
  id: '',
  name: '',
  displayName: '',
  symbol: '',
  color: '#228be6',
  txExplorerUrl: '',
  addressExplorerUrl: '',
  enabled: true,
  order: 999,
};

const ChainManagementContent = () => {
  const { chains, updateChainConfig, addChain, deleteChain } = useChains();

  const [formOpened, setFormOpened] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainConfig | null>(null);
  const [formState, setFormState] = useState<ChainFormState>(defaultForm);

  const sortedChains = useMemo(() => [...chains].sort((left, right) => left.order - right.order), [chains]);

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingChain(null);
  };

  const openAddModal = () => {
    resetForm();
    setFormOpened(true);
  };

  const openEditModal = (chain: ChainConfig) => {
    setEditingChain(chain);
    setFormState({
      id: chain.id,
      name: chain.name,
      displayName: chain.displayName,
      symbol: chain.symbol,
      color: chain.color,
      txExplorerUrl: chain.explorerUrl.tx,
      addressExplorerUrl: chain.explorerUrl.address,
      enabled: chain.enabled,
      order: chain.order,
    });
    setFormOpened(true);
  };

  const handleToggleEnabled = async (chainId: string, enabled: boolean) => {
    const success = await updateChainConfig(chainId, { enabled });
    notifications.show({
      title: success ? '链状态已更新' : '操作失败',
      message: success ? `链 ${chainId} 已${enabled ? '启用' : '禁用'}` : '请稍后重试',
      color: success ? 'green' : 'red',
    });
  };

  const handleSave = async () => {
    if (!formState.id || !formState.name || !formState.displayName || !formState.symbol) {
      notifications.show({ title: '参数错误', message: '请填写必填字段', color: 'yellow' });
      return;
    }

    const chainData: ChainConfig = {
      id: formState.id,
      name: formState.name,
      displayName: formState.displayName,
      symbol: formState.symbol,
      color: formState.color,
      explorerUrl: {
        tx: formState.txExplorerUrl,
        address: formState.addressExplorerUrl,
      },
      enabled: formState.enabled,
      order: formState.order,
    };

    const success = editingChain
      ? await updateChainConfig(editingChain.id, chainData)
      : await addChain(chainData);

    if (success) {
      notifications.show({
        title: editingChain ? '更新成功' : '添加成功',
        message: editingChain ? '链配置已更新' : '新链已添加',
        color: 'green',
      });
      setFormOpened(false);
      resetForm();
      return;
    }

    notifications.show({
      title: editingChain ? '更新失败' : '添加失败',
      message: '请检查参数并重试',
      color: 'red',
    });
  };

  const handleDelete = async (chainId: string) => {
    const success = await deleteChain(chainId);
    notifications.show({
      title: success ? '删除成功' : '删除失败',
      message: success ? `链 ${chainId} 已删除` : '请稍后重试',
      color: success ? 'green' : 'red',
    });
  };

  return (
    <>
      <Stack>
        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            管理可用链、浏览器链接、显示顺序和启用状态
          </Text>
          <Button leftSection={<Plus size={16} />} onClick={openAddModal}>
            添加新链
          </Button>
        </Group>

        <ScrollArea h={460}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>链ID</Table.Th>
                <Table.Th>显示名称</Table.Th>
                <Table.Th>符号</Table.Th>
                <Table.Th>颜色</Table.Th>
                <Table.Th>排序</Table.Th>
                <Table.Th>启用</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedChains.map((chain) => (
                <Table.Tr key={chain.id}>
                  <Table.Td>
                    <Badge color="blue" variant="light">
                      {chain.id}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{chain.displayName}</Table.Td>
                  <Table.Td>{chain.symbol}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          display: 'inline-block',
                          backgroundColor: chain.color,
                        }}
                      />
                      <Text size="xs">{chain.color}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{chain.order}</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={chain.enabled}
                      onChange={(event) => handleToggleEnabled(chain.id, event.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => openEditModal(chain)}>
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(chain.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>

      <Modal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        title={editingChain ? '编辑链配置' : '添加新链'}
        size="lg"
        centered
      >
        <Stack>
          <Group grow>
            <TextInput
              label="链ID"
              placeholder="如: BSC"
              value={formState.id}
              disabled={Boolean(editingChain)}
              onChange={(event) => setFormState((previous) => ({ ...previous, id: event.currentTarget.value }))}
              required
            />
            <TextInput
              label="链名称"
              placeholder="如: bsc"
              value={formState.name}
              onChange={(event) => setFormState((previous) => ({ ...previous, name: event.currentTarget.value }))}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="显示名称"
              placeholder="如: Binance Smart Chain"
              value={formState.displayName}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, displayName: event.currentTarget.value }))
              }
              required
            />
            <TextInput
              label="代币符号"
              placeholder="如: BNB"
              value={formState.symbol}
              onChange={(event) => setFormState((previous) => ({ ...previous, symbol: event.currentTarget.value }))}
              required
            />
          </Group>

          <Group grow align="flex-end">
            <ColorInput
              label="主题颜色"
              value={formState.color}
              onChange={(value) => setFormState((previous) => ({ ...previous, color: value }))}
            />
            <NumberInput
              label="排序"
              value={formState.order}
              onChange={(value) =>
                setFormState((previous) => ({
                  ...previous,
                  order: typeof value === 'number' ? value : previous.order,
                }))
              }
            />
            <Switch
              label="启用"
              checked={formState.enabled}
              onChange={(event) =>
                setFormState((previous) => ({ ...previous, enabled: event.currentTarget.checked }))
              }
            />
          </Group>

          <TextInput
            label="交易浏览器 URL"
            placeholder="https://..."
            value={formState.txExplorerUrl}
            onChange={(event) => setFormState((previous) => ({ ...previous, txExplorerUrl: event.currentTarget.value }))}
          />

          <TextInput
            label="地址浏览器 URL"
            placeholder="https://..."
            value={formState.addressExplorerUrl}
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, addressExplorerUrl: event.currentTarget.value }))
            }
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFormOpened(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>{editingChain ? '保存修改' : '添加链'}</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ChainManagementContent;
