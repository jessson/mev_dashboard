import React from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Settings, TrendingUp } from 'lucide-react';
import { TagProfitInfo, TokenProfitInfo } from '../../types';

interface ChainInfo {
  id: string;
  displayName: string;
  color: string;
}

interface SidebarContentProps {
  enabledChains: ChainInfo[];
  selectedChain: string;
  onChainSelect: (chainId: string) => void;
  tokenStats: TokenProfitInfo[];
  tokenScrollRef: any;
  tagStats: TagProfitInfo[];
  getExplorerUrl: (chain: string, address: string, type?: 'tx' | 'address') => string;
  isAdmin: boolean;
  isMobile?: boolean;
  onChainManagerOpen: () => void;
  onSidebarClose?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = React.memo(
  ({
    enabledChains,
    selectedChain,
    onChainSelect,
    tokenStats,
    tokenScrollRef,
    tagStats,
    getExplorerUrl,
    isAdmin,
    isMobile,
    onChainManagerOpen,
    onSidebarClose,
  }) => {
    const handleChainSelect = (chainId: string) => {
      onChainSelect(chainId);
      if (isMobile && onSidebarClose) {
        onSidebarClose();
      }
    };

    return (
      <Stack gap="md" p="sm">
        <Group justify="space-between">
          <Title order={5}>区块链网络</Title>
          {isAdmin && (
            <ActionIcon variant="subtle" onClick={onChainManagerOpen} aria-label="链配置管理">
              <Settings size={16} />
            </ActionIcon>
          )}
        </Group>

        <Stack gap={6}>
          {enabledChains.map((chain) => (
            <NavLink
              key={chain.id}
              label={chain.displayName}
              active={selectedChain === chain.id}
              leftSection={<ThemeIcon size="xs" radius="xl" color={chain.color} variant="filled" />}
              onClick={() => handleChainSelect(chain.id)}
            />
          ))}
        </Stack>

        {tokenStats.length > 0 && (
          <Card withBorder radius="md" p="sm">
            <Text fw={600} mb="xs">
              热门代币（前100）
            </Text>
            <ScrollArea h={280} viewportRef={tokenScrollRef}>
              <Stack gap={8}>
                {tokenStats.map((token, idx) => (
                  <Group key={token.addr + idx} justify="space-between" wrap="nowrap">
                    <Stack gap={0}>
                      <Group gap={6}>
                        <Text size="sm" fw={600}>
                          {token.symbol}
                        </Text>
                        <Badge variant="light" size="xs">
                          #{idx + 1}
                        </Badge>
                      </Group>
                      {isAdmin ? (
                        <Text
                          component="a"
                          href={getExplorerUrl(selectedChain, token.addr, 'address')}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          c="blue"
                        >
                          {token.addr.slice(0, 8)}...{token.addr.slice(-6)}
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          {token.addr.slice(0, 8)}...{token.addr.slice(-6)}
                        </Text>
                      )}
                    </Stack>
                    <Stack gap={0} align="flex-end">
                      <Badge color="blue" variant="light">
                        ${token.totalProfit.toFixed(2)}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {token.count} 次
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Card>
        )}

        {tagStats.length > 0 && (
          <Card withBorder radius="md" p="sm">
            <Group gap={6} mb="xs">
              <TrendingUp size={14} />
              <Text fw={600}>标签统计</Text>
            </Group>
            <ScrollArea h={280}>
              <Stack gap={8}>
                {tagStats.map((tagStat) => (
                  <Group key={`${tagStat.chain}-${tagStat.tag}`} justify="space-between" wrap="nowrap">
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {tagStat.tag || '未知标签'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {tagStat.txCount} 次
                      </Text>
                    </Stack>
                    <Stack gap={0} align="flex-end">
                      <Text size="sm" fw={600} c="blue">
                        ${tagStat.totalProfit.toFixed(2)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        平均 ${tagStat.txCount > 0 ? (tagStat.totalProfit / tagStat.txCount).toFixed(2) : '0.00'}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Card>
        )}
      </Stack>
    );
  }
);

SidebarContent.displayName = 'SidebarContent';

export default SidebarContent;
