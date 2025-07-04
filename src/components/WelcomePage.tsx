import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Statistic, Button, Row, Col, Typography, Space, Spin, message } from 'antd';
import { TrendingUp, Coins, ArrowRight } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiService } from '../services/api';
import { useChains } from '../hooks/useChains';
import { WelcomeStats } from '../types';

const { Title, Paragraph } = Typography;

interface WelcomePageProps {
  onLogin: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onLogin }) => {
  const { getChainColor, getChainDisplayName } = useChains();
  const [stats, setStats] = useState<WelcomeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // 获取统计数据 - 仅用于初始加载
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getWelcomeStats();
      setStats(data);
      console.log('📊 欢迎页面初始统计数据加载:', data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 缓存渲染的统计卡片，避免不必要的重新渲染
  const renderedStats = useMemo(() => 
    stats.map((stat) => (
      <Col xs={24} md={8} key={stat.chain}>
        <Card 
          className="shadow-xl border-0 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
          style={{ 
            background: `linear-gradient(135deg, ${getChainColor(stat.chain)}10, ${getChainColor(stat.chain)}05)`,
            borderLeft: `4px solid ${getChainColor(stat.chain)}`
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="px-3 py-1 rounded-lg text-lg font-bold" style={{ 
              backgroundColor: `${getChainColor(stat.chain)}20`,
              color: getChainColor(stat.chain)
            }}>
              {getChainDisplayName(stat.chain)}
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          
          <Space direction="vertical" size="large" className="w-full">
            <Statistic
              title="总收益"
              value={stat.income}
              precision={4}
              prefix="$"
              valueStyle={{ color: '#1f2937', fontSize: '1.5rem', fontWeight: 'bold' }}
            />
            
            <Statistic
              title="交易数量"
              value={stat.txCount}
              valueStyle={{ color: '#374151', fontSize: '1.2rem' }}
            />
            
            <Statistic
              title="平均收益"
              value={stat.txCount > 0 ? stat.income / stat.txCount : 0}
              precision={4}
              prefix="$"
              valueStyle={{ color: '#374151', fontSize: '1rem' }}
            />
          </Space>
        </Card>
      </Col>
    )), [stats]
  );

  useEffect(() => {
    // 初始加载数据
    fetchStats();

    // 建立WebSocket连接
    const connectSocket = () => {
      try {
        const getWebSocketUrl = (): string => {
          // 优先使用环境变量
          if (import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL;
          }
          
          // 开发环境
          if (import.meta.env.DEV) {
            return 'http://localhost:3000';
          }
          
          // 生产环境：使用当前域名+端口3000
          const { protocol, hostname } = window.location;
          return `${protocol}//${hostname}:3000`;
        };
        
        const wsUrl = getWebSocketUrl();
        
        console.log('🔗 欢迎页面连接WebSocket:', wsUrl);
        
        const socketInstance = io(wsUrl, {
          transports: ['polling'], // 优先使用polling，兼容性更好
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
          query: {
            page: 'welcome',
            _t: Date.now()
          }
        });

        socketInstance.on('connect', () => {
          console.log('✅ 欢迎页面WebSocket连接成功');
          setSocket(socketInstance);
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('❌ 欢迎页面WebSocket断开连接:', reason);
          setSocket(null);
        });

        socketInstance.on('connect_error', (error) => {
          console.error('❌ 欢迎页面WebSocket连接错误:', error);
        });

        // 监听欢迎页统计数据更新 - 直接使用推送数据
        socketInstance.on('welcome_stats_changed', (data) => {
          const welcomeStatsData = data.data || data;
          if (Array.isArray(welcomeStatsData)) {
            setStats(welcomeStatsData);
          }
        });

        return socketInstance;
      } catch (error) {
        console.error('❌ WebSocket连接失败:', error);
        return null;
      }
    };

    const socketInstance = connectSocket();

             // 定时刷新（备用方案） - 仅在WebSocket断开时使用
         const refreshInterval = setInterval(() => {
           if (!socketInstance || !socketInstance.connected) {
             console.log('🔄 欢迎页面定时刷新统计数据 (WebSocket断开)');
             fetchStats();
           }
         }, 30000); // 30秒刷新一次

    // 清理函数
    return () => {
      if (socketInstance) {
        console.log('🧹 清理欢迎页面WebSocket连接');
        socketInstance.disconnect();
      }
      clearInterval(refreshInterval);
    };
  }, [fetchStats]);

  if (loading && stats.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* 顶部导航栏 */}
      <div className="w-full px-6 py-4">
        <div className="flex justify-between items-center">
          {/* WebSocket连接状态指示器 */}
          <div className="flex items-center space-x-2">
            <div 
              className={`w-3 h-3 rounded-full ${
                socket?.connected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={
                socket?.connected ? 'WebSocket已连接 - 实时数据推送' : 'WebSocket未连接 - 可能无法实时更新'
              }
            />
            <span className="text-sm text-gray-600">
              {socket?.connected ? '实时数据推送' : '离线模式'}
            </span>
          </div>
          
          <Button
            type="primary"
            size="large"
            onClick={onLogin}
            className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 hover:from-blue-700 hover:to-purple-700 shadow-lg"
            icon={<ArrowRight className="h-5 w-5" />}
            iconPosition="end"
          >
            登录控制台
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Coins className="h-10 w-10 text-white" />
            </div>
          </div>
          <Title level={1} className="!text-5xl !mb-8">
            MEV 交易
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> 监控平台</span>
          </Title>
        </div>

        {/* Chain Performance */}
        <div className="text-center mb-12">
          <Title level={2} className="!text-3xl !mb-4">链上表现</Title>
          <Paragraph className="!text-lg text-gray-600">各区块链网络的MEV收益统计</Paragraph>
        </div>



        <Row gutter={[24, 24]} className="mb-16">
          {renderedStats}
        </Row>

        {/* 无数据提示 */}
        {!loading && stats.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">暂无交易数据</div>
            <Button onClick={fetchStats} type="primary" ghost>
              刷新数据
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomePage;