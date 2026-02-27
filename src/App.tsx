import { useEffect, useState } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import WelcomePage from './components/WelcomePage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { apiService } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState<'welcome' | 'login' | 'dashboard'>('welcome');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (typeof window !== 'undefined') {
          const hasPhantomConflict =
            window.location.href.includes('evmPhantom') ||
            document.querySelector('script[src*="evmPhantom"]') ||
            window.console?.error?.toString().includes('evmPhantom');

          if (hasPhantomConflict) {
            try {
              delete (window as any).ethereum;
              delete (window as any).phantom;
            } catch {
              // ignore
            }
          }
        }

        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            setCurrentView('dashboard');
          } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleShowLogin = () => {
    setCurrentView('login');
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    apiService.logout();
    setUser(null);
    setCurrentView('welcome');
    notifications.show({
      title: '退出成功',
      message: '已退出登录',
      color: 'green',
    });
  };

  if (loading) {
    return (
      <Center h="100vh" bg="linear-gradient(145deg, #eaf2ff 0%, #f5f7ff 40%, #f3f8ff 100%)">
        <Stack align="center" gap="xs">
          <Loader color="blue" type="dots" />
          <Text c="dimmed">正在初始化应用...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <div className="app-container">
      {currentView === 'welcome' && <WelcomePage onLogin={handleShowLogin} />}
      {currentView === 'login' && <LoginPage onLogin={handleLogin} />}
      {currentView === 'dashboard' && user && <Dashboard user={user} onLogout={handleLogout} />}
    </div>
  );
}

export default App;
