import React, { useState, useEffect } from 'react';
import { ConfigProvider, message } from 'antd';
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
        // 防止浏览器插件冲突
        if (typeof window !== 'undefined') {
          // 检查是否有插件冲突
          const hasPhantomConflict = window.location.href.includes('evmPhantom') || 
                                   document.querySelector('script[src*="evmPhantom"]') ||
                                   window.console?.error?.toString().includes('evmPhantom');
          
          if (hasPhantomConflict) {
            console.warn('⚠️  检测到浏览器插件冲突，尝试修复...');
            // 清理可能的插件冲突
            try {
              delete (window as any).ethereum;
              delete (window as any).phantom;
            } catch (e) {
              // 忽略清理错误
            }
          }
        }

        // 检查本地存储的登录状态
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        console.log('🔍 检查本地登录状态...');
        console.log('Token:', token ? '已设置' : '未设置');
        console.log('User:', savedUser ? '已设置' : '未设置');
        
        if (token && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            console.log('✅ 找到本地用户数据:', userData);
            
            // 可以在这里验证token是否仍然有效
            // const isValid = await apiService.verifyToken();
            
            setUser(userData);
            setCurrentView('dashboard');
          } catch (error) {
            console.error('❌ 解析用户数据失败:', error);
            // 清除无效的存储数据
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('❌ 应用初始化失败:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleShowLogin = () => {
    console.log('🔄 切换到登录页面');
    setCurrentView('login');
  };

  const handleLogin = (userData: any) => {
    console.log('✅ 登录成功，用户数据:', userData);
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    console.log('👋 用户退出登录');
    apiService.logout();
    setUser(null);
    setCurrentView('welcome');
    message.success('已退出登录');
  };

  // 显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-gray-600">正在初始化应用...</div>
          <div className="text-sm text-gray-500 mt-2">检查登录状态和插件兼容性</div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 8,
        },
      }}
    >
      <div className="app-container">
        {currentView === 'welcome' && (
          <WelcomePage onLogin={handleShowLogin} />
        )}
        {currentView === 'login' && (
          <LoginPage onLogin={handleLogin} />
        )}
        {currentView === 'dashboard' && user && (
          <Dashboard user={user} onLogout={handleLogout} />
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;