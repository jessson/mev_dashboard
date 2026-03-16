import { useState } from 'react';
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Bell,
  Cable,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings2,
  TableProperties,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import NodeStatusModal from '../components/NodeStatusModal';
import { SidebarContent } from '../components/TradingComponents';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

const DashboardLayout = () => {
  const [opened, { toggle, close }] = useDisclosure();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [nodeModalOpened, setNodeModalOpened] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    enabledChains,
    selectedChain,
    setSelectedChain,
    currentChainTagStats,
    currentChainTokenStats,
    getExplorerUrl,
    tokenScrollRef,
    wsConnected,
    wsError,
    reconnectSocket,
    nodeStatus,
    nodeStatusLoading,
  } = useDashboard();

  const isAdmin = user?.type === 'admin';

  const navItems = [
    { to: '/app/overview', label: '总览', icon: LayoutDashboard, visible: true },
    { to: '/app/trades', label: '交易', icon: TableProperties, visible: true },
    { to: '/app/nodes', label: '节点', icon: Server, visible: true },
    { to: '/app/warnings', label: '预警', icon: Bell, visible: isAdmin },
    { to: '/app/chains', label: '链配置', icon: Settings2, visible: isAdmin },
  ];

  const handleLogout = () => {
    logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <>
      <AppShell
        header={{ height: 72 }}
        navbar={{ width: 280, breakpoint: 'md', collapsed: { mobile: !opened, desktop: desktopCollapsed } }}
        padding="md"
      >
        <AppShell.Header>
          <Group justify="space-between" h="100%" px="md" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />
              <ActionIcon
                visibleFrom="md"
                variant="subtle"
                size="lg"
                onClick={() => setDesktopCollapsed((value) => !value)}
                aria-label={desktopCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              >
                {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </ActionIcon>
              <Box>
                <Title order={4}>MEV Dashboard</Title>
                <Text size="xs" c="dimmed">
                  实时监控、收益分析与节点运维
                </Text>
              </Box>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Badge
                color={wsConnected ? 'green' : 'red'}
                leftSection={wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                variant="light"
              >
                {wsConnected ? '实时连接' : '连接中断'}
              </Badge>
              {wsError && (
                <Button variant="subtle" size="xs" leftSection={<Cable size={14} />} onClick={reconnectSocket}>
                  重连
                </Button>
              )}
              <Button
                variant="light"
                size="xs"
                leftSection={<Server size={14} />}
                onClick={() => setNodeModalOpened(true)}
              >
                节点 {nodeStatus?.summary.online || 0}/{nodeStatus?.summary.total || 0}
              </Button>
              <Text visibleFrom="sm" size="sm" fw={500}>
                {user?.username}
              </Text>
              <Button color="red" variant="light" size="xs" leftSection={<LogOut size={14} />} onClick={handleLogout}>
                退出
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm">
          <ScrollArea h="100%">
            <Stack gap="md">
              <Stack gap={4}>
                {navItems
                  .filter((item) => item.visible)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.to;

                    return (
                      <NavLink
                        key={item.to}
                        component={Link}
                        to={item.to}
                        label={item.label}
                        active={active}
                        leftSection={<Icon size={16} />}
                        onClick={close}
                      />
                    );
                  })}
              </Stack>

              <Divider />

              <SidebarContent
                enabledChains={enabledChains}
                selectedChain={selectedChain}
                onChainSelect={(chainId) => {
                  setSelectedChain(chainId);
                  close();
                }}
                tokenStats={currentChainTokenStats}
                tokenScrollRef={tokenScrollRef}
                tagStats={currentChainTagStats}
                getExplorerUrl={getExplorerUrl}
                isAdmin={isAdmin}
                onChainManagerOpen={() => navigate('/app/chains')}
              />

              {wsError && (
                <>
                  <Divider />
                  <Text size="xs" c="yellow.8">
                    {wsError}
                  </Text>
                </>
              )}
            </Stack>
          </ScrollArea>
        </AppShell.Navbar>

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>

      <NodeStatusModal
        visible={nodeModalOpened}
        onClose={() => setNodeModalOpened(false)}
        nodeStatus={nodeStatus}
        loading={nodeStatusLoading}
      />
    </>
  );
};

export default DashboardLayout;
