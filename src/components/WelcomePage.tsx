import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Center,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowRight, Coins, TrendingUp } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiService } from '../services/api';
import { useChains } from '../hooks/useChains';
import { WelcomeStats } from '../types';

interface WelcomePageProps {
  onLogin: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onLogin }) => {
  const { getChainColor, getChainDisplayName } = useChains();
  const [stats, setStats] = useState<WelcomeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getWelcomeStats();
      setStats(data);
    } catch {
      notifications.show({ title: '加载失败', message: '获取欢迎页统计失败', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  const statCards = useMemo(
    () =>
      stats.map((stat) => {
        const color = getChainColor(stat.chain);
        const avg = stat.txCount > 0 ? stat.income / stat.txCount : 0;
        return (
          <Card
            key={stat.chain}
            radius="md"
            shadow="md"
            withBorder
            style={{
              background: `linear-gradient(160deg, ${color}15 0%, #ffffff 80%)`,
              borderTop: `3px solid ${color}`,
            }}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Badge color="blue" variant="light" size="lg">
                  {getChainDisplayName(stat.chain)}
                </Badge>
                <TrendingUp size={16} color="#228be6" />
              </Group>
              <div>
                <Text size="xs" c="dimmed">
                  总收益
                </Text>
                <Text fw={700} size="xl">
                  ${stat.income.toFixed(4)}
                </Text>
              </div>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">
                    交易数量
                  </Text>
                  <Text fw={600}>{stat.txCount}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    平均收益
                  </Text>
                  <Text fw={600}>${avg.toFixed(4)}</Text>
                </div>
              </Group>
            </Stack>
          </Card>
        );
      }),
    [getChainColor, getChainDisplayName, stats]
  );

  useEffect(() => {
    fetchStats();

    const getWebSocketUrl = (): string => {
      if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
      }
      const sameOriginFlag = String(import.meta.env.VITE_API_SAME_ORIGIN ?? '').toLowerCase();
      if (sameOriginFlag === '1' || sameOriginFlag === 'true') {
        return window.location.origin;
      }
      if (import.meta.env.DEV) {
        return 'http://localhost:3000';
      }
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:3000`;
    };

    const socketInstance = io(getWebSocketUrl(), {
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      query: {
        page: 'welcome',
        _t: Date.now(),
      },
    });

    socketInstance.on('connect', () => setSocket(socketInstance));
    socketInstance.on('disconnect', () => setSocket(null));
    socketInstance.on('welcome_stats_changed', (data) => {
      const payload = data.data || data;
      if (Array.isArray(payload)) {
        setStats(payload);
      }
    });

    const refreshTimer = setInterval(() => {
      if (!socketInstance.connected) {
        fetchStats();
      }
    }, 30000);

    return () => {
      clearInterval(refreshTimer);
      socketInstance.disconnect();
    };
  }, [fetchStats]);

  if (loading && stats.length === 0) {
    return (
      <Center h="100vh" bg="linear-gradient(160deg, #edf2ff 0%, #f5f9ff 45%, #eef8ff 100%)">
        <Loader type="dots" color="blue" />
      </Center>
    );
  }

  return (
    <Container fluid px="xl" py="md" bg="linear-gradient(160deg, #edf2ff 0%, #f5f9ff 45%, #eef8ff 100%)" mih="100vh">
      <Group justify="space-between" mb="xl">
        <Group gap="xs">
          <Badge color={socket?.connected ? 'green' : 'red'} variant="dot">
            {socket?.connected ? '实时数据推送' : '离线模式'}
          </Badge>
        </Group>
        <Button rightSection={<ArrowRight size={16} />} onClick={onLogin}>
          登录控制台
        </Button>
      </Group>

      <Stack align="center" gap="xs" mb={40}>
        <ThemeIcon radius="xl" size={64} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
          <Coins size={30} />
        </ThemeIcon>
        <Title order={1}>MEV 交易监控平台</Title>
        <Text c="dimmed">各链收益与交易量实时概览</Text>
      </Stack>

      <Paper withBorder radius="md" p="lg" mb="md">
        <Group justify="space-between" mb="sm">
          <Title order={3}>链上表现</Title>
          <Text size="sm" c="dimmed">
            实时更新
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {statCards}
        </SimpleGrid>

        {!loading && stats.length === 0 && (
          <Stack align="center" py="xl">
            <Text c="dimmed">暂无交易数据</Text>
            <Button variant="light" onClick={fetchStats}>
              刷新数据
            </Button>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default WelcomePage;
