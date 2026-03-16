import { useState } from 'react';
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Bell,
  Cable,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
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
    { to: '/app/overview', label: '总览', hint: 'Pulse', icon: LayoutDashboard, visible: true },
    { to: '/app/trades', label: '交易流', hint: 'Flow', icon: TableProperties, visible: true },
    { to: '/app/nodes', label: '节点', hint: 'Infra', icon: Server, visible: true },
    { to: '/app/warnings', label: '预警', hint: 'Risk', icon: Bell, visible: isAdmin },
    { to: '/app/chains', label: '链配置', hint: 'Setup', icon: Settings2, visible: isAdmin },
  ];

  const handleLogout = () => {
    logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <>
      <AppShell
        className="dashboard-shell"
        header={{ height: 86 }}
        navbar={{ width: 318, breakpoint: 'md', collapsed: { mobile: !opened, desktop: desktopCollapsed } }}
        padding={{ base: 'md', lg: 'xl' }}
      >
        <AppShell.Header className="dashboard-header">
          <Group justify="space-between" h="100%" px={{ base: 'md', lg: 'xl' }} wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />
              <ActionIcon
                visibleFrom="md"
                variant="white"
                size="lg"
                onClick={() => setDesktopCollapsed((value) => !value)}
                aria-label={desktopCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              >
                {desktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </ActionIcon>

              <div className="brand-lockup">
                <div className="brand-mark">
                  <Radar size={20} />
                </div>
                <Box>
                  <Text className="brand-title">MEV Terminal</Text>
                  <Text className="brand-subtitle">实时监控与收益追踪</Text>
                </Box>
              </div>
            </Group>

            <div className="topbar-controls">
              <div className={`status-pill ${wsConnected ? 'is-live' : ''}`}>
                {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>{wsConnected ? '实时连接' : '连接中断'}</span>
              </div>

              <button className="status-pill is-node" type="button" onClick={() => setNodeModalOpened(true)}>
                <Server size={14} />
                <span>
                  节点 {nodeStatus?.summary.online || 0}/{nodeStatus?.summary.total || 0}
                </span>
              </button>

              {wsError && (
                <Button variant="light" size="xs" leftSection={<Cable size={14} />} onClick={reconnectSocket}>
                  重连流
                </Button>
              )}

              <Text visibleFrom="sm" className="username-pill">
                {user?.username}
              </Text>

              <Button color="danger" variant="light" size="xs" leftSection={<LogOut size={14} />} onClick={handleLogout}>
                退出
              </Button>
            </div>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar className="dashboard-navbar" p="md">
          <ScrollArea h="100%" className="shell-scroll">
            <Stack gap="lg">
              <Paper className="sidebar-panel nav-cluster" p="sm">
                <Text className="nav-section-label">Workspace</Text>
                <Stack gap={6}>
                  {navItems
                    .filter((item) => item.visible)
                    .map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.to;

                      return (
                        <NavLink
                          key={item.to}
                          className="chain-link"
                          component={Link}
                          to={item.to}
                          active={active}
                          onClick={close}
                          leftSection={<Icon size={17} />}
                          label={
                            <Group justify="space-between" wrap="nowrap" w="100%">
                              <Text fw={700}>{item.label}</Text>
                              <Text size="xs" c="dimmed">
                                {item.hint}
                              </Text>
                            </Group>
                          }
                          styles={{
                            root: {
                              borderRadius: 18,
                              border: active ? '1px solid rgba(22, 119, 255, 0.16)' : '1px solid transparent',
                              background: active ? 'linear-gradient(145deg, rgba(22,119,255,0.12), rgba(255,255,255,0.8))' : 'transparent',
                            },
                            body: { gap: 2 },
                            section: { color: active ? 'var(--brand-600)' : 'var(--text-secondary)' },
                            label: { width: '100%' },
                          }}
                        />
                      );
                    })}
                </Stack>
              </Paper>

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

        <AppShell.Main className="dashboard-main">
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
