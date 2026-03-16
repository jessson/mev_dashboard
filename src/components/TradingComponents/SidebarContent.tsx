import React from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  NavLink,
  Progress,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Flame, Settings, TrendingUp } from 'lucide-react';
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

    const topTokenProfit = tokenStats[0]?.totalProfit || 1;
    const topTagProfit = tagStats[0]?.totalProfit || 1;

    return (
      <Stack gap="lg">
        <Card className="sidebar-panel" p="md">
          <Group justify="space-between" mb={6}>
            <div>
              <Text className="sidebar-section-title">区块链网络</Text>
              <Text className="sidebar-section-note">切换当前链</Text>
            </div>
            {isAdmin && (
              <ActionIcon variant="white" onClick={onChainManagerOpen} aria-label="链配置管理">
                <Settings size={16} />
              </ActionIcon>
            )}
          </Group>

          <Stack gap={8} mt="md">
            {enabledChains.map((chain) => (
              <NavLink
                key={chain.id}
                className="chain-link"
                active={selectedChain === chain.id}
                leftSection={<ThemeIcon size={26} radius="xl" color={chain.color} variant="filled" />}
                rightSection={selectedChain === chain.id ? <Badge color="brand">Live</Badge> : undefined}
                label={
                  <Group justify="space-between" wrap="nowrap" w="100%">
                    <Text fw={700}>{chain.displayName}</Text>
                    <Text size="xs" c="dimmed">
                      {chain.id.toUpperCase()}
                    </Text>
                  </Group>
                }
                onClick={() => handleChainSelect(chain.id)}
                styles={{
                  root: {
                    borderRadius: 18,
                    background:
                      selectedChain === chain.id
                        ? 'linear-gradient(145deg, rgba(22,119,255,0.12), rgba(255,255,255,0.9))'
                        : 'rgba(255,255,255,0.45)',
                    border:
                      selectedChain === chain.id
                        ? '1px solid rgba(22,119,255,0.16)'
                        : '1px solid rgba(148,163,184,0.08)',
                  },
                }}
              />
            ))}
          </Stack>
        </Card>

        {tokenStats.length > 0 && (
          <Card className="token-card" p="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text className="sidebar-section-title">热门代币</Text>
                <Text className="sidebar-section-note">按累计净收益排序</Text>
              </div>
              <ThemeIcon size="lg" radius="xl" variant="light" color="brand">
                <Flame size={16} />
              </ThemeIcon>
            </Group>

            <ScrollArea h={320} viewportRef={tokenScrollRef}>
              <Stack gap="sm">
                {tokenStats.map((token, idx) => {
                  const share = Math.max(6, Math.min(100, (token.totalProfit / topTokenProfit) * 100));

                  return (
                    <Card key={token.addr + idx} radius="lg" p="sm" bg="rgba(255,255,255,0.72)">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={5}>
                          <Group gap={8}>
                            <Text fw={800}>{token.symbol}</Text>
                            <Badge variant="filled" color="brand.1" c="brand.7">
                              #{idx + 1}
                            </Badge>
                          </Group>
                          {isAdmin ? (
                            <Text
                              component="a"
                              href={getExplorerUrl(selectedChain, token.addr, 'address')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mono-link"
                              size="xs"
                            >
                              {token.addr.slice(0, 8)}...{token.addr.slice(-6)}
                            </Text>
                          ) : (
                            <Text className="mono-block" size="xs" c="dimmed">
                              {token.addr.slice(0, 8)}...{token.addr.slice(-6)}
                            </Text>
                          )}
                        </Stack>

                        <Stack gap={2} align="flex-end">
                          <Text fw={800} c="brand.6">
                            ${token.totalProfit.toFixed(2)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {token.count} 次命中
                          </Text>
                        </Stack>
                      </Group>
                      <Progress mt="sm" value={share} color="brand" size="sm" radius="xl" />
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Card>
        )}

        {tagStats.length > 0 && (
          <Card className="tag-card" p="md">
            <Group gap={10} mb="sm">
              <ThemeIcon size="lg" radius="xl" variant="light" color="orange">
                <TrendingUp size={16} />
              </ThemeIcon>
              <div>
                <Text className="sidebar-section-title">标签收益</Text>
                <Text className="sidebar-section-note">标签收益概览</Text>
              </div>
            </Group>

            <ScrollArea h={300}>
              <Stack gap="sm">
                {tagStats.map((tagStat) => {
                  const share = Math.max(6, Math.min(100, (tagStat.totalProfit / topTagProfit) * 100));

                  return (
                    <Card key={`${tagStat.chain}-${tagStat.tag}`} radius="lg" p="sm" bg="rgba(255,255,255,0.72)">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={3}>
                          <Text fw={800}>{tagStat.tag || '未知标签'}</Text>
                          <Text size="xs" c="dimmed">
                            {tagStat.txCount} 次交易
                          </Text>
                        </Stack>
                        <Stack gap={2} align="flex-end">
                          <Text fw={800} c="brand.6">
                            ${tagStat.totalProfit.toFixed(2)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            均值 ${tagStat.txCount > 0 ? (tagStat.totalProfit / tagStat.txCount).toFixed(2) : '0.00'}
                          </Text>
                        </Stack>
                      </Group>
                      <Progress mt="sm" value={share} color="orange" size="sm" radius="xl" />
                    </Card>
                  );
                })}
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
