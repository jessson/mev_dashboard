import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Center,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Lock, TrendingUp, User, Wifi, WifiOff } from 'lucide-react';
import { apiService } from '../services/api';

interface LoginPageProps {
  onLogin: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await apiService.testConnection();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      notifications.show({ title: '参数缺失', message: '请输入用户名和密码', color: 'yellow' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.login(username, password);
      notifications.show({ title: '登录成功', message: `欢迎 ${response.user.username}`, color: 'green' });
      onLogin(response.user);
    } catch (error: any) {
      notifications.show({
        title: '登录失败',
        message: error?.message || '请检查用户名和密码',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('checking');
    try {
      const isConnected = await apiService.testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      notifications.show({
        title: '连接测试',
        message: isConnected ? 'API连接正常' : 'API连接失败',
        color: isConnected ? 'green' : 'red',
      });
    } catch {
      setConnectionStatus('disconnected');
      notifications.show({ title: '连接测试', message: 'API连接测试失败', color: 'red' });
    }
  };

  return (
    <Center h="100vh" bg="linear-gradient(160deg, #edf2ff 0%, #f3f9ff 45%, #eef8ff 100%)" p="md">
      <Stack w="100%" maw={460} gap="lg">
        <Stack align="center" gap="xs">
          <ThemeIcon radius="xl" size={64} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <TrendingUp size={30} />
          </ThemeIcon>
          <Title order={2}>MEV Dashboard</Title>
          <Text c="dimmed">登录以访问 MEV 交易数据</Text>
        </Stack>

        <Alert
          variant="light"
          color={connectionStatus === 'connected' ? 'green' : connectionStatus === 'disconnected' ? 'red' : 'blue'}
          title="服务连接状态"
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap={8}>
              {connectionStatus === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
              <Text size="sm">
                {connectionStatus === 'checking' && '检查连接中...'}
                {connectionStatus === 'connected' && 'API连接正常'}
                {connectionStatus === 'disconnected' && 'API连接失败'}
              </Text>
            </Group>
            <Button size="xs" variant="subtle" onClick={handleTestConnection} loading={connectionStatus === 'checking'}>
              重新测试
            </Button>
          </Group>
        </Alert>

        <Card shadow="md" radius="md" withBorder>
          <form onSubmit={handleLogin}>
            <Stack>
              <TextInput
                label="用户名"
                placeholder="请输入用户名"
                leftSection={<User size={16} />}
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="密码"
                placeholder="请输入密码"
                leftSection={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button type="submit" fullWidth loading={loading} disabled={connectionStatus === 'disconnected'}>
                {connectionStatus === 'disconnected' ? 'API连接失败，无法登录' : '登录'}
              </Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Center>
  );
};

export default LoginPage;
