import React, { useState, useEffect, useMemo,  useCallback } from 'react';
import { 
  Layout, 
  Card, 
  Button, 
  Row, 
  Col, 
  Typography, 
  Space, 
  Input,
  Select,
  DatePicker,
  Badge,
  Tag,
  Table,
  Modal,
  List,
  Drawer,
  message,
  Popconfirm,
  Checkbox,
  Alert
} from 'antd';
import { 
  LogOut, 
  Search, 
  AlertTriangle,
  Eye,
  Trash2,
  Bell,
  Wifi,
  WifiOff,
  Menu as MenuIcon,
  Filter,
  ArrowLeft,
  Server
} from 'lucide-react';
import { TradeInfo, SearchFilters, ProfitEvent, WarningInfo, TagProfitInfo, TokenProfitInfo, NodeStatusResponse } from '../types';
import { apiService } from '../services/api';
import { useChains } from '../hooks/useChains';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import ChainManager from './ChainManager';
import NodeStatusModal from './NodeStatusModal';
import { MobileTradeCard, SidebarContent, ProfitStatistics } from './TradingComponents';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { io, Socket } from 'socket.io-client';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const { 
    enabledChains, 
    getChainColor, 
    getChainDisplayName, 
    getExplorerUrl 
  } = useChains();
  
  const [selectedChain, setSelectedChain] = useState<string>('');
  const [trades, setTrades] = useState<TradeInfo[]>([]);
  const [searchResults, setSearchResults] = useState<TradeInfo[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [warnings, setWarnings] = useState<WarningInfo[]>([]);
  
  // 🔄 重构：按链存储数据，避免前端计算
  const [chainTagStats, setChainTagStats] = useState<{ [chain: string]: TagProfitInfo[] }>({});
  const [chainTokenStats, setChainTokenStats] = useState<{ [chain: string]: TokenProfitInfo[] }>({});
  const [chainProfits, setChainProfits] = useState<{ [chain: string]: ProfitEvent }>({});
  
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [chainManagerVisible, setChainManagerVisible] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: 'createdAt',
    order: 'desc',
    limit: 500
  });

  // 移动端状态
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // 模态框状态
  const [tradeDetailVisible, setTradeDetailVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeInfo | null>(null);
  const [warningDrawerVisible, setWarningDrawerVisible] = useState(false);
  const [warningDetailVisible, setWarningDetailVisible] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<WarningInfo | null>(null);

  // 批量删除预警相关状态
  const [selectedWarningIds, setSelectedWarningIds] = useState<number[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  // Socket.IO 连接
  const [socket, setSocket] = useState<Socket | null>(null);

  // 节点状态相关状态
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null);
  const [nodeStatusModalVisible, setNodeStatusModalVisible] = useState(false);
  const [nodeStatusLoading, setNodeStatusLoading] = useState(false);

  // 当前链的标签统计数据 - 直接使用按链分组的数据
  const currentChainTagStats = useMemo(() => {
    const chainStats = chainTagStats[selectedChain] || [];
    // 简单排序处理，避免复杂计算
    const sortedStats = [...chainStats].sort((a, b) => b.totalProfit - a.totalProfit);
    console.log('🔍 排序后的标签统计:', sortedStats);
    
    return sortedStats;
  }, [chainTagStats, selectedChain]);

  // 代币收益滚动容器ref - 使用滚动保持hook
  const tokenScrollRef = useScrollPreservation({ 
    dependencies: [chainTokenStats], 
    enabled: true
  });

  // 设置默认选中的链
  useEffect(() => {
    if (enabledChains.length > 0 && !selectedChain) {
      setSelectedChain(enabledChains[0].id);
    }
  }, [enabledChains, selectedChain]);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Socket.IO连接 - 简化版本
  useEffect(() => {
    let socketInstance: Socket | null = null;
    let reconnectTimer: number | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5; // 增加重连次数

    const connectSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setWsError('连接失败次数过多，请刷新页面重试');
        return;
      }

      try {

        
        // 获取JWT token用于认证
        const token = localStorage.getItem('token');
        
        // 根据环境动态获取WebSocket URL
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
        
        socketInstance = io(wsUrl, {
          path: '/socket.io',
          transports: ['polling', 'websocket'], // 支持WebSocket和polling
          timeout: 45000,  // 匹配后端的connectTimeout
          forceNew: true,
          reconnection: false, // 手动控制重连
          autoConnect: true,
          auth: {
            token: token // 传递JWT token用于WebSocket认证
          }
        });
        
        socketInstance.on('connect', () => {
          setWsConnected(true);
          setWsError(null);
          setSocket(socketInstance);
          reconnectAttempts = 0;
          
          // 加入当前选中的链房间
          if (selectedChain) {
            socketInstance?.emit('join-chain', selectedChain);
          }
          
          // 建立心跳检测
          const pingInterval = setInterval(() => {
            if (socketInstance && socketInstance.connected) {
              socketInstance.emit('ping', { timestamp: Date.now() });
            } else {
              clearInterval(pingInterval);
            }
          }, 30000); // 每30秒ping一次
        });
        
        socketInstance.on('disconnect', (reason) => {
          setWsConnected(false);
          setSocket(null);
          
          if (!isManualClose && reason !== 'io client disconnect') {
            reconnectAttempts++;
            // 优化重连延迟策略：1s, 2s, 5s, 10s, 15s
            const delays = [1000, 2000, 5000, 10000, 15000];
            const delay = delays[Math.min(reconnectAttempts - 1, delays.length - 1)];
            setWsError(`连接断开，${delay/1000}秒后重连 (${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimer = setTimeout(() => {
              connectSocket();
            }, delay);
          }
        });
        
        // 监听各种数据更新事件 - 只在非搜索模式下更新
        socketInstance.on('new_trade', (data) => {
          if (!isSearchMode) {
            const tradeData = data.data || data;
            if (tradeData) {
              setTrades(prev => {
                const exists = prev.some(t => t.hash === tradeData.hash);
                if (!exists) {
                  message.success(`新交易: ${tradeData.chain} - $${tradeData.income?.toFixed(4) || '0.0000'}`, 2);
                  return [tradeData, ...prev.slice(0, 499)];
                }
                return prev;
              });
            }
          }
        });

        socketInstance.on('trade_update', (data) => {
          if (!isSearchMode) {
            const tradeData = data.data || data;
            if (tradeData) {
              setTrades(prev => {
                const exists = prev.some(t => t.hash === tradeData.hash);
                if (!exists) {
                  return [tradeData, ...prev.slice(0, 499)];
                }
                return prev;
              });
            }
          }
        });

        socketInstance.on('new_warning', (data) => {
          const warningData = data.data || data;
          if (warningData) {
            setWarnings(prev => {
              // 检查是否已存在相同ID的警告
              const exists = prev.some(w => w.id === warningData.id);
              if (!exists) {
                message.warning(`新预警: ${warningData.chain} - ${warningData.type}`, 3);
                return [warningData, ...prev];
              }
              return prev;
            });
          }
        });

        socketInstance.on('warning_update', (data) => {
          const warningData = data.data || data;
          if (warningData) {
            setWarnings(prev => {
              // 检查是否已存在相同ID的警告
              const exists = prev.some(w => w.id === warningData.id);
              if (!exists) {
                return [warningData, ...prev];
              }
              return prev;
            });
          }
        });

        // 监听标签收益更新 - 优化：直接使用WebSocket推送的数据
        socketInstance.on('tag_profits_changed', async (data) => {
          console.log('🎯 收到标签收益更新事件:', data);
          const tagProfitsData = data.data || data;
          console.log('🎯 解析后的标签收益数据:', tagProfitsData);
          
          if (tagProfitsData && tagProfitsData.chain && Array.isArray(tagProfitsData.tagProfits)) {
            // ✅ 直接使用WebSocket推送的链数据
            setChainTagStats(prev => ({
              ...prev,
              [tagProfitsData.chain]: tagProfitsData.tagProfits
            }));
            console.log('📊 标签收益数据已通过WebSocket更新，数据量:', tagProfitsData.tagProfits.length);
          } else if (tagProfitsData && Array.isArray(tagProfitsData)) {
            // 兼容格式：如果是完整的标签数组，按链分组
            const tagStatsByChain: { [chain: string]: TagProfitInfo[] } = {};
            tagProfitsData.forEach(tag => {
              if (tag.chain) {
                if (!tagStatsByChain[tag.chain]) {
                  tagStatsByChain[tag.chain] = [];
                }
                tagStatsByChain[tag.chain].push(tag);
              }
            });
            setChainTagStats(tagStatsByChain);
            console.log('📊 标签收益数据已通过WebSocket更新，总数据量:', tagProfitsData.length);
          } else {
            console.warn('⚠️ 标签收益数据格式不正确，回退到API调用:', tagProfitsData);
            // 🔄 回退方案：重新调用API获取完整数据
            try {
              const updatedTagData = await apiService.getTagDailyProfit();
              console.log('🔄 通过API重新获取标签收益数据:', updatedTagData);
              if (updatedTagData && Array.isArray(updatedTagData)) {
                const tagStatsByChain: { [chain: string]: TagProfitInfo[] } = {};
                updatedTagData.forEach(tag => {
                  if (tag.chain) {
                    if (!tagStatsByChain[tag.chain]) {
                      tagStatsByChain[tag.chain] = [];
                    }
                    tagStatsByChain[tag.chain].push(tag);
                  }
                });
                setChainTagStats(tagStatsByChain);
              }
            } catch (error) {
              console.error('❌ API回退获取标签收益失败:', error);
            }
          }
        });

        // 监听代币收益更新 - 优化：直接使用WebSocket推送的数据
        socketInstance.on('token_profits_changed', (data) => {
          const tokenProfitsData = data.data || data;
          
          if (tokenProfitsData && tokenProfitsData.tokens) {
            // ✅ 直接使用WebSocket推送的完整代币数据
            setChainTokenStats(prev => ({
              ...prev,
              [selectedChain]: tokenProfitsData.tokens
            }));
            console.log('💰 代币收益数据已通过WebSocket更新');
          } else if (tokenProfitsData && tokenProfitsData.chain && tokenProfitsData.tokenProfits) {
            // 兼容旧格式：如果推送的是单个链的数据，则更新对应链的数据
            setChainTokenStats(prev => ({
              ...prev,
              [selectedChain]: tokenProfitsData.tokenProfits
            }));
            console.log(`💰 ${selectedChain} 链代币收益数据已更新`);
          }
        });

        socketInstance.on('profit_update', (data) => {
          const profitData = data.data || data;
          if (profitData && profitData.chain) {
            setChainProfits(prev => ({
              ...prev,
              [profitData.chain]: profitData
            }));
          }
        });

        socketInstance.on('profit_changed', (data) => {
          const profitData = data.data || data;
          if (profitData && profitData.chain) {
            setChainProfits(prev => ({
              ...prev,
              [profitData.chain]: profitData
            }));
          }
        });
        
        socketInstance.on('pong', (_) => {
          // 接收pong响应，连接正常
          console.log('🏓 收到pong响应，连接正常');
        });

        // 监听节点状态更新
        socketInstance.on('node_status_update', (data) => {
          const nodeStatusData = data.data || data;
          if (nodeStatusData) {
            setNodeStatus(nodeStatusData);
          }
        });
        
        socketInstance.on('error', (error) => {
          console.error('❌ Socket.IO错误:', error);
          if (error.message && error.message.includes('需要登录')) {
            setWsError('WebSocket认证失败，请重新登录');
          }
        });
        
        socketInstance.on('connect_error', (error) => {
          console.error('❌ Socket.IO连接错误:', error);
          setWsConnected(false);
          setSocket(null);
          
          // 根据错误类型设置不同的错误信息
          if (error.message.includes('timeout')) {
            setWsError('连接超时，请检查网络状态');
          } else if (error.message.includes('ECONNREFUSED')) {
            setWsError('服务器拒绝连接，请稍后再试');
          } else {
            setWsError(`连接错误: ${error.message}`);
          }
          
          // 连接失败也要尝试重连
          if (!isManualClose && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delays = [1000, 2000, 5000, 10000, 15000];
            const delay = delays[Math.min(reconnectAttempts - 1, delays.length - 1)];
            
            reconnectTimer = setTimeout(() => {
              connectSocket();
            }, delay);
          }
        });
        
      } catch (error: any) {
        console.error('❌ Socket.IO初始化失败:', error);
        setWsConnected(false);
        setWsError(`初始化失败: ${error.message}`);
      }
    };

    // 网络状态检测
    const handleOnline = () => {
      console.log('📡 网络连接恢复');
      if (!socketInstance || !socketInstance.connected) {
        reconnectAttempts = 0; // 重置重连次数
        connectSocket();
      }
    };
    
    const handleOffline = () => {
      console.log('📡 网络连接断开');
      setWsError('网络连接断开');
      setWsConnected(false);
    };
    
    // 监听网络状态变化
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 延迟连接
    const connectTimer = setTimeout(() => {
      console.log('🚀 开始建立Socket.IO连接...');
      connectSocket();
    }, 2000);

    return () => {
      isManualClose = true;
      clearTimeout(connectTimer);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socketInstance) {
        console.log('🔌 手动关闭Socket.IO连接');
        socketInstance.disconnect();
      }
      // 移除网络状态监听器
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedChain, isSearchMode]);

  // 当选中链变化时，加入新的房间
  useEffect(() => {
    if (socket && socket.connected && selectedChain) {

      socket.emit('join-chain', selectedChain);
    }
  }, [socket, selectedChain]);

  // 获取数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyData, profitData, tagProfitData, tokenData] = await Promise.all([
        apiService.getHistory(),
        apiService.getProfit(),
        apiService.getTagDailyProfit(),
        apiService.getTokenStats()
      ]);

      setTrades(historyData.trades || []);
      // 对警告数据进行去重处理
      const uniqueWarnings = (historyData.warnings || []).filter((warning: WarningInfo, index: number, self: WarningInfo[]) => 
        index === self.findIndex((w: WarningInfo) => w.id === warning.id)
      );
      setWarnings(uniqueWarnings);
      
      // 处理收益数据 - 按链分组
      if (profitData && Array.isArray(profitData)) {
        const profitsByChain: { [chain: string]: ProfitEvent } = {};
        profitData.forEach(profit => {
          if (profit.chain) {
            profitsByChain[profit.chain] = profit;
          }
        });
        setChainProfits(profitsByChain);
      }
      
      console.log('📊 初始标签收益数据:', tagProfitData);
      // 处理标签收益数据 - 按链分组
      if (tagProfitData && Array.isArray(tagProfitData)) {
        const tagStatsByChain: { [chain: string]: TagProfitInfo[] } = {};
        tagProfitData.forEach(tag => {
          if (tag.chain) {
            if (!tagStatsByChain[tag.chain]) {
              tagStatsByChain[tag.chain] = [];
            }
            tagStatsByChain[tag.chain].push(tag);
          }
        });
        setChainTagStats(tagStatsByChain);
      }
      setChainTokenStats(tokenData?.tokens || {});
      
    } catch (error) {
      console.error('❌ 获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取节点状态
  const fetchNodeStatus = async () => {
    try {
      setNodeStatusLoading(true);
      const data = await apiService.getNodeStatus();
      setNodeStatus(data);
    } catch (error) {
      console.error('❌ 获取节点状态失败:', error);
      message.error('获取节点状态失败');
    } finally {
      setNodeStatusLoading(false);
    }
  };

  // 搜索交易
  const searchTrades = useCallback(async () => {
    setLoading(true);
    try {
      // 如果用户没有选择时间，默认使用当天时间
      const searchFilters = {
        ...filters,
        start: filters.start || dayjs().format('YYYY-MM-DD'),
        end: filters.end || dayjs().format('YYYY-MM-DD')
      };
      
      const data = await apiService.searchTrades(searchFilters);
      setSearchResults(data);
      setIsSearchMode(true);
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 返回实时模式
  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchResults([]);
  }, []);

  useEffect(() => {
    fetchData();
    fetchNodeStatus(); // 初始获取节点状态
  }, []);

  useEffect(() => {
    setFilters(prev => ({ ...prev, chain: selectedChain }));
    // 切换链时退出搜索模式
    if (isSearchMode) {
      exitSearchMode();
    }
  }, [selectedChain]);

  // 当前链的收益数据
  const currentChainProfit = useMemo(() => {
    return chainProfits[selectedChain];
  }, [chainProfits, selectedChain]);

  // 显示的交易数据 - 根据模式选择
  const displayTrades = useMemo(() => {
    if (isSearchMode) {
      return searchResults;
    }
    return trades.filter(trade => trade.chain === selectedChain);
  }, [trades, searchResults, selectedChain, isSearchMode]);

  // 删除单个预警
  const handleDeleteWarning = async (id: number) => {
    try {
      await apiService.deleteWarning(id);
      setWarnings(prev => prev.filter(w => w.id !== id));
      // 从选中列表中移除
      setSelectedWarningIds(prev => prev.filter(wId => wId !== id));
      message.success('预警已删除');
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 批量删除预警
  const handleBatchDeleteWarnings = async () => {
    if (selectedWarningIds.length === 0) {
      message.warning('请选择要删除的预警');
      return;
    }

    setBatchDeleteLoading(true);
    try {
      // 并发删除所有选中的预警
      await Promise.all(
        selectedWarningIds.map(id => apiService.deleteWarning(id))
      );
      
      // 从列表中移除已删除的预警
      setWarnings(prev => prev.filter(w => !selectedWarningIds.includes(w.id)));
      setSelectedWarningIds([]);
      message.success(`成功删除 ${selectedWarningIds.length} 条预警`);
    } catch (error) {
      message.error('批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  // 处理预警选择
  const handleWarningSelect = (warningId: number, checked: boolean) => {
    if (checked) {
      setSelectedWarningIds(prev => [...prev, warningId]);
    } else {
      setSelectedWarningIds(prev => prev.filter(id => id !== warningId));
    }
  };

  // 全选/取消全选预警
  const handleSelectAllWarnings = (checked: boolean) => {
    if (checked) {
      setSelectedWarningIds(warnings.map(w => w.id));
    } else {
      setSelectedWarningIds([]);
    }
  };



  // 手动重连Socket.IO
  const handleReconnectSocket = useCallback(() => {
    console.log('🔄 手动重连Socket.IO...');
    window.location.reload();
  }, []);

  // 测试Socket.IO连接
  const handleTestSocket = useCallback(() => {
    if (socket && socket.connected) {
      console.log('🧪 测试Socket.IO连接...');
      socket.emit('ping', { test: true, timestamp: Date.now() });
      message.info('Socket.IO连接测试中...');
    } else {
      message.warning('Socket.IO未连接');
    }
  }, [socket]);

  // 处理交易哈希点击 - admin用户可查看详情
  const handleTradeHashClick = async (trade: TradeInfo) => {
    if (user?.type === 'admin') {
      try {
        // 通过API获取完整的交易详情，确保包含incTokens字段
        const response = await fetch(`/api/trade/${trade.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const fullTradeDetail = await response.json();
          setSelectedTrade({
            ...fullTradeDetail,
            // 确保时间字段正确
            created_at: fullTradeDetail.created_at || fullTradeDetail.createdAt || trade.created_at
          });
        } else {
          // 如果API调用失败，使用原始trade对象
          setSelectedTrade(trade);
        }
      } catch (error) {
        // 出错时使用原始trade对象
        setSelectedTrade(trade);
      }
      setTradeDetailVisible(true);
    }
  };

  // 交易卡片点击处理
  const handleTradeCardClick = React.useCallback((trade: TradeInfo) => {
    handleTradeHashClick(trade);
  }, []);

  // 桌面端交易表格列定义 - 禁用排序
  const tradeColumns: ColumnsType<TradeInfo> = [
    {
      title: '交易数',
      dataIndex: 'txCount',
      key: 'txCount',
      width: 80,
      sorter: false,
      render: (txCount: number) => (
        <Text style={{ fontWeight: 'bold' }}>{txCount || 0}</Text>
      )
    },
    {
      title: '交易类型',
      dataIndex: 'tags',
      key: 'type',
      width: 100,
      render: (tags: string[]) => (
        <Tag color="blue">{tags?.[0] || '未知'}</Tag>
      )
    },
    {
      title: '交易哈希',
      dataIndex: 'hash',
      key: 'hash',
      width: 120,
      render: (hash: string, record) => (
        <Text 
          code 
          style={{ 
            fontSize: 11,
            color: '#999',
            cursor: user?.type === 'admin' ? 'pointer' : 'default'
          }}
          onClick={() => handleTradeHashClick(record)}
        >
          {user?.type === 'admin' ? (
            <Text style={{ color: '#999', fontSize: 11 }}>
              {hash.slice(0, 10)}...{hash.slice(-8)}
            </Text>
          ) : (
            `${hash.slice(0, 10)}...${hash.slice(-8)}`
          )}
        </Text>
      )
    },
    {
      title: '构建者',
      dataIndex: 'builder',
      key: 'builder',
      width: 80,
      render: (builder: string) => (
        <Tag color="purple">{builder}</Tag>
      )
    },

    {
      title: '实际收入',
      dataIndex: 'income',
      key: 'income',
      width: 100,
      sorter: false,
      render: (income: number) => (
        <Text style={{ color: '#1890ff' }}>${income?.toFixed(4) || '0.0000'}</Text>
      )
    },
    {
      title: '贿赂',
      dataIndex: 'bribe',
      key: 'bribe',
      width: 100,
      sorter: false,
      render: (bribe: number) => (
        <Text style={{ color: '#faad14' }}>${bribe?.toFixed(4) || '0.0000'}</Text>
      )
    },
    {
      title: '比例',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 80,
      sorter: false,
      render: (ratio: number) => (
        <Text style={{ color: '#f5222d' }}>{ratio?.toFixed(2) || '0.00'}%</Text>
      )
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 120,
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.slice(1).map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },

  ];

  // 侧边栏操作处理
  const handleChainSelect = React.useCallback((chainId: string) => {
    setSelectedChain(chainId);
  }, []);

  const handleChainManagerOpen = React.useCallback(() => {
    setChainManagerVisible(true);
  }, []);

  const handleSidebarClose = React.useCallback(() => {
    setSidebarVisible(false);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
              <Header style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', borderBottom: '1px solid #f0f0f0', padding: '0 16px 0 16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', height: '100%' }}>
          <Space size={isMobile ? "small" : "middle"}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuIcon className="h-4 w-4" />}
                onClick={() => setSidebarVisible(true)}
              />
            )}
            <Title level={4} style={{ margin: 0, fontSize: isMobile ? 16 : 20 }}>MEV Dashboard</Title>
            <Space size="small">
              {wsConnected ? (
                <Wifi className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
              )}
              <Badge 
                status={wsConnected ? "success" : "error"} 
                text={
                  <Text style={{ 
                    fontSize: isMobile ? 10 : 12,
                    color: wsConnected ? '#52c41a' : '#ff4d4f'
                  }}>
                    {wsConnected ? '实时连接' : '连接断开'}
                  </Text>
                }
              />
              {wsError && !isMobile && (
                <Button 
                  type="link" 
                  size="small" 
                  onClick={handleReconnectSocket}
                  style={{ fontSize: 10, padding: '0 4px' }}
                >
                  重连
                </Button>
              )}
            </Space>
            
            {/* 节点状态统计 */}
            {!isMobile && nodeStatus && (
              <Button
                type="text"
                size="small"
                icon={<Server className="h-4 w-4" />}
                onClick={() => setNodeStatusModalVisible(true)}
              >
                <Space size="small">
                  <Text style={{ fontSize: 11, lineHeight: 1 }}>
                    节点 {nodeStatus.summary.online}/{nodeStatus.summary.total}
                  </Text>
                  <Badge 
                    status={nodeStatus.summary.offline > 0 ? "error" : "success"}
                    text={
                      <Text style={{ fontSize: 10, color: '#999' }}>
                        {nodeStatus.summary.offline > 0 ? '异常' : '正常'}
                      </Text>
                    }
                  />
                </Space>
              </Button>
            )}
          </Space>
          <Space size={isMobile ? "small" : "middle"}>
            <Text style={{ display: isMobile ? 'none' : 'inline' }}>欢迎, {user?.username}</Text>
            {!isMobile && user?.type === 'admin' && (
              <Badge count={warnings.length} size="small">
                <Button
                  icon={<Bell className="h-4 w-4" />}
                  onClick={() => setWarningDrawerVisible(true)}
                >
                  预警 ({warnings.length})
                </Button>
              </Badge>
            )}
            <Button
              danger
              icon={<LogOut className="h-3 w-3 md:h-4 md:w-4" />}
              size={isMobile ? 'small' : 'middle'}
              onClick={onLogout}
            >
              {isMobile ? '' : '退出'}
            </Button>
          </Space>
        </Space>
      </Header>

      <Layout>
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Sider width={320} style={{ backgroundColor: 'white', borderRight: '1px solid #f0f0f0' }}>
            <SidebarContent 
              enabledChains={enabledChains}
              selectedChain={selectedChain}
              onChainSelect={handleChainSelect}
              tokenStats={chainTokenStats[selectedChain] || []}
              tokenScrollRef={tokenScrollRef}
              tagStats={currentChainTagStats}
              getExplorerUrl={getExplorerUrl}
              isAdmin={user?.type === 'admin'}
              isMobile={isMobile}
              onChainManagerOpen={handleChainManagerOpen}
            />
          </Sider>
        )}

        {/* 移动端侧边栏抽屉 */}
        <Drawer
          title="菜单"
          placement="left"
          onClose={() => setSidebarVisible(false)}
          open={sidebarVisible}
          width={280}
        >
          <SidebarContent 
            enabledChains={enabledChains}
            selectedChain={selectedChain}
            onChainSelect={handleChainSelect}
            tokenStats={chainTokenStats[selectedChain] || []}
            tokenScrollRef={tokenScrollRef}
            tagStats={currentChainTagStats}
            getExplorerUrl={getExplorerUrl}
            isAdmin={user?.type === 'admin'}
            isMobile={isMobile}
            onChainManagerOpen={handleChainManagerOpen}
            onSidebarClose={handleSidebarClose}
          />
        </Drawer>

        <Content style={{ padding: isMobile ? 12 : 24, backgroundColor: '#f5f5f5' }}>
          {/* Socket.IO连接错误提示 */}
          {wsError && (
            <Alert
              type="warning"
              showIcon
              icon={<WifiOff className="h-4 w-4 text-orange-500" />}
              message={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text type="warning">Socket.IO: {wsError}</Text>
                  <Space>
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={handleTestSocket}
                    >
                      测试
                    </Button>
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={handleReconnectSocket}
                    >
                      重连
                    </Button>
                  </Space>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 搜索模式提示 */}
          {isSearchMode && (
            <Alert
              message={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text>搜索模式：显示 {searchResults.length} 条搜索结果，实时数据更新已暂停</Text>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<ArrowLeft className="h-4 w-4" />}
                    onClick={exitSearchMode}
                  >
                    返回实时模式
                  </Button>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 统计卡片 */}
          {currentChainProfit && (
            <ProfitStatistics 
              profitData={currentChainProfit}
              isMobile={isMobile}
            />
          )}

          {/* 搜索和过滤 */}
          <Card style={{ marginBottom: 16 }}>
            {isMobile ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="关键字搜索"
                    value={filters.keyword}
                    onChange={(e) => setFilters({...filters, keyword: e.target.value})}
                    prefix={<Search className="h-4 w-4" />}
                    size="small"
                  />
                  <Button
                    icon={<Filter className="h-4 w-4" />}
                    onClick={() => setFiltersVisible(!filtersVisible)}
                    size="small"
                  />
                </Space.Compact>
                
                {filtersVisible && (
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Input
                        placeholder="标签"
                        value={filters.tag}
                        onChange={(e) => setFilters({...filters, tag: e.target.value})}
                        size="small"
                      />
                    </Col>
                    <Col span={12}>
                      <Select
                        placeholder="排序字段"
                        value={filters.sort}
                        onChange={(value) => setFilters({...filters, sort: value})}
                        size="small"
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="createdAt">时间</Select.Option>
                        <Select.Option value="income">收益</Select.Option>
                        <Select.Option value="gross">毛利</Select.Option>
                        <Select.Option value="bribe">贿赂</Select.Option>
                        <Select.Option value="ratio">比例</Select.Option>
                        <Select.Option value="txCount">交易数</Select.Option>
                      </Select>
                    </Col>
                    <Col span={12}>
                      <Select
                        placeholder="排序"
                        value={filters.order}
                        onChange={(value) => setFilters({...filters, order: value})}
                        size="small"
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="desc">降序</Select.Option>
                        <Select.Option value="asc">升序</Select.Option>
                      </Select>
                    </Col>
                    <Col span={12}>
                      <Button 
                        type="primary" 
                        icon={<Search className="h-4 w-4" />}
                        onClick={searchTrades}
                        loading={loading}
                        size="small"
                        block
                      >
                        搜索
                      </Button>
                    </Col>
                  </Row>
                )}
              </Space>
            ) : (
              <Row gutter={[16, 16]} align="middle">
                <Col flex="200px">
                  <Input
                    placeholder="关键字搜索"
                    value={filters.keyword}
                    onChange={(e) => setFilters({...filters, keyword: e.target.value})}
                    prefix={<Search className="h-4 w-4" />}
                  />
                </Col>
                <Col flex="120px">
                  <Input
                    placeholder="标签"
                    value={filters.tag}
                    onChange={(e) => setFilters({...filters, tag: e.target.value})}
                  />
                </Col>
                <Col flex="120px">
                  <Select
                    placeholder="排序字段"
                    value={filters.sort}
                    onChange={(value) => setFilters({...filters, sort: value})}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="createdAt">时间</Select.Option>
                    <Select.Option value="income">收益</Select.Option>
                    <Select.Option value="gross">毛利</Select.Option>
                    <Select.Option value="bribe">贿赂</Select.Option>
                    <Select.Option value="ratio">比例</Select.Option>
                    <Select.Option value="txCount">交易数</Select.Option>
                  </Select>
                </Col>
                <Col flex="100px">
                  <Select
                    placeholder="排序"
                    value={filters.order}
                    onChange={(value) => setFilters({...filters, order: value})}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="desc">降序</Select.Option>
                    <Select.Option value="asc">升序</Select.Option>
                  </Select>
                </Col>
                <Col flex="200px">
                  <RangePicker 
                    size="small"
                    placeholder={['开始日期', '结束日期']}
                    onChange={(dates) => {
                      if (dates) {
                        setFilters({
                          ...filters,
                          start: dates[0]?.format('YYYY-MM-DD'),
                          end: dates[1]?.format('YYYY-MM-DD')
                        });
                      } else {
                        setFilters({
                          ...filters,
                          start: undefined,
                          end: undefined
                        });
                      }
                    }}
                  />
                </Col>
                <Col>
                  <Button 
                    type="primary" 
                    icon={<Search className="h-4 w-4" />}
                    onClick={searchTrades}
                    loading={loading}
                  >
                    搜索
                  </Button>
                </Col>
              </Row>
            )}
          </Card>

          {/* 交易列表 */}
          <Card>
            {isMobile ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'center' }}>
                  <Text type="secondary">
                    {isSearchMode ? `搜索结果: ${displayTrades.length} 条` : `共 ${displayTrades.length} 条交易记录`}
                  </Text>
                </Space>
                <Space direction="vertical" size="small" style={{ width: '100%', maxHeight: 384, overflowY: 'auto' }}>
                  {displayTrades.slice(0, 50).map((trade) => (
                    <MobileTradeCard 
                      key={trade.id} 
                      trade={trade} 
                      isAdmin={user?.type === 'admin'}
                      onTradeClick={handleTradeCardClick}
                    />
                  ))}
                  {displayTrades.length > 50 && (
                    <Space style={{ width: '100%', justifyContent: 'center', padding: '16px 0' }}>
                      <Text type="secondary">显示前50条记录</Text>
                    </Space>
                  )}
                </Space>
              </Space>
            ) : (
              <Table
                columns={tradeColumns}
                dataSource={displayTrades}
                rowKey="id"
                size="small"
                loading={loading}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    isSearchMode 
                      ? `搜索结果: ${range[0]}-${range[1]} 共 ${total} 条`
                      : `${range[0]}-${range[1]} 共 ${total} 条`,
                }}
                scroll={{ x: 800 }}
              />
            )}
          </Card>
        </Content>
      </Layout>

      {/* 链配置管理模态框 */}
      <ChainManager
        visible={chainManagerVisible}
        onClose={() => setChainManagerVisible(false)}
      />

      {/* 交易详情模态框 - 仅admin用户可见 */}
      {user?.type === 'admin' && (
        <Modal
          title="交易详情"
          open={tradeDetailVisible}
          onCancel={() => setTradeDetailVisible(false)}
          footer={null}
          width={isMobile ? '95%' : 800}
        >
          {selectedTrade && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>链: </Text>
                  <Tag style={{ backgroundColor: getChainColor(selectedTrade.chain) }}>
                    {getChainDisplayName(selectedTrade.chain)}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Text strong>构建者: </Text>
                  <Text>{selectedTrade.builder}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>交易数量: </Text>
                  <Text>{selectedTrade.txCount}</Text>
                </Col>

                <Col span={12}>
                  <Text strong>实际收入: </Text>
                  <Text style={{ color: '#1890ff' }}>${selectedTrade.income?.toFixed(4)}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>贿赂: </Text>
                  <Text style={{ color: '#faad14' }}>${selectedTrade.bribe?.toFixed(4)}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>比例: </Text>
                  <Text>{selectedTrade.ratio?.toFixed(2)}%</Text>
                </Col>
              </Row>
              
              <Space>
                <Text strong>交易哈希: </Text>
                <Text code style={{ fontSize: 11 }}>
                  <a 
                    href={getExplorerUrl(selectedTrade.chain, selectedTrade.hash)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#999', fontSize: 11 }}
                  >
                    {selectedTrade.hash}
                  </a>
                </Text>
              </Space>
              
              {selectedTrade.vicHashes && selectedTrade.vicHashes.length > 0 && (
                <Space direction="vertical" size="small">
                  <Text strong>受害者哈希: </Text>
                  <Space direction="vertical" size="small">
                    {selectedTrade.vicHashes.map((hash, index) => (
                      <Text key={index} code style={{ fontSize: 11 }}>
                        <a 
                          href={getExplorerUrl(selectedTrade.chain, hash)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#999', fontSize: 11 }}
                        >
                          {hash}
                        </a>
                      </Text>
                    ))}
                  </Space>
                </Space>
              )}
              
              {selectedTrade.tags && selectedTrade.tags.length > 0 && (
                <Space direction="vertical" size="small">
                  <Text strong>标签: </Text>
                  <Space wrap>
                    {selectedTrade.tags.map(tag => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                </Space>
              )}
              
              {selectedTrade.incTokens && selectedTrade.incTokens.length > 0 && (
                <Space direction="vertical" size="small">
                  <Text strong>涉及代币: </Text>
                  <Space wrap>
                    {selectedTrade.incTokens.map((token, index) => (
                      <Tag key={index} style={{ padding: '4px 8px' }}>
                        <Space>
                          <Text strong style={{ fontSize: 12 }}>{token.symbol}</Text>
                          <Text style={{ fontSize: 10, color: '#666' }}>
                            (<a 
                              href={getExplorerUrl(selectedTrade.chain, token.addr, 'address')} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#1890ff' }}
                            >
                              {token.addr.slice(0, 6)}...{token.addr.slice(-4)}
                            </a>)
                          </Text>
                        </Space>
                      </Tag>
                    ))}
                  </Space>
                </Space>
              )}
              
              <Space>
                <Text strong>创建时间: </Text>
                <Text>{dayjs(selectedTrade.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Space>
              
              {selectedTrade.extraInfo && (
                <Space direction="vertical" size="small">
                  <Text strong>套利路径: </Text>
                  <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                    <Paragraph style={{ 
                      fontSize: 12, 
                      fontFamily: 'monospace', 
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {selectedTrade.extraInfo}
                    </Paragraph>
                  </Card>
                </Space>
              )}
            </Space>
          )}
        </Modal>
      )}

      {/* 预警抽屉 - 仅桌面端admin用户可见 */}
      {!isMobile && user?.type === 'admin' && (
        <>
          <Drawer
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong>预警信息</Text>
                {selectedWarningIds.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已选择 {selectedWarningIds.length} 条
                  </Text>
                )}
              </Space>
            }
            placement="right"
            onClose={() => {
              setWarningDrawerVisible(false);
              setSelectedWarningIds([]);
            }}
            open={warningDrawerVisible}
            width={450}
            extra={
              <Space>
                {warnings.length > 0 && (
                  <Checkbox
                    indeterminate={selectedWarningIds.length > 0 && selectedWarningIds.length < warnings.length}
                    checked={selectedWarningIds.length === warnings.length && warnings.length > 0}
                    onChange={(e) => handleSelectAllWarnings(e.target.checked)}
                  >
                    全选
                  </Checkbox>
                )}
                {selectedWarningIds.length > 0 && (
                  <Popconfirm
                    title={`确定删除选中的 ${selectedWarningIds.length} 条预警吗？`}
                    onConfirm={handleBatchDeleteWarnings}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<Trash2 className="h-4 w-4" />}
                      loading={batchDeleteLoading}
                    >
                      批量删除 ({selectedWarningIds.length})
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            }
          >
            <List
              dataSource={warnings}
              rowKey="id"
              renderItem={(warning) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      icon={<Eye className="h-4 w-4" />}
                      onClick={() => {
                        setSelectedWarning(warning);
                        setWarningDetailVisible(true);
                      }}
                    >
                      查看
                    </Button>,
                    <Popconfirm
                      title="确定删除这条预警吗？"
                      onConfirm={() => handleDeleteWarning(warning.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<Trash2 className="h-4 w-4" />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <Space style={{ width: '100%' }}>
                    <Checkbox
                      checked={selectedWarningIds.includes(warning.id)}
                      onChange={(e) => handleWarningSelect(warning.id, e.target.checked)}
                    />
                    <List.Item.Meta
                      avatar={<AlertTriangle className="h-5 w-5 text-orange-500" />}
                      title={
                        <Space>
                          <Tag color="orange">{warning.type}</Tag>
                          <Tag style={{ backgroundColor: getChainColor(warning.chain) }}>
                            {getChainDisplayName(warning.chain)}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size="small">
                          <Text ellipsis style={{ fontSize: 12 }}>
                            {warning.msg.length > 20 ? `${warning.msg.slice(0, 20)}...` : warning.msg}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(warning.create_at).format('MM-DD HH:mm')}
                          </Text>
                        </Space>
                      }
                    />
                  </Space>
                </List.Item>
              )}
            />
          </Drawer>

          {/* 预警详情模态框 */}
          <Modal
            title="预警详情"
            open={warningDetailVisible}
            onCancel={() => setWarningDetailVisible(false)}
            width={isMobile ? '95%' : '66vw'}
            footer={[
              <Button key="close" onClick={() => setWarningDetailVisible(false)}>
                关闭
              </Button>,
              <Popconfirm
                key="delete"
                title="确定删除这条预警吗？"
                onConfirm={() => {
                  if (selectedWarning) {
                    handleDeleteWarning(selectedWarning.id);
                    setWarningDetailVisible(false);
                  }
                }}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<Trash2 className="h-4 w-4" />}>
                  删除预警
                </Button>
              </Popconfirm>
            ]}
          >
            {selectedWarning && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space>
                  <Text strong>预警类型: </Text>
                  <Tag color="orange">{selectedWarning.type}</Tag>
                </Space>
                <Space>
                  <Text strong>链: </Text>
                  <Tag style={{ backgroundColor: getChainColor(selectedWarning.chain) }}>
                    {getChainDisplayName(selectedWarning.chain)}
                  </Tag>
                </Space>
                <Space>
                  <Text strong>创建时间: </Text>
                  <Text>{dayjs(selectedWarning.create_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </Space>
                <Space direction="vertical" size="small">
                  <Text strong>预警内容: </Text>
                  <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                    <Paragraph style={{ 
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {selectedWarning.msg}
                    </Paragraph>
                  </Card>
                </Space>
              </Space>
            )}
          </Modal>
        </>
      )}

      {/* 节点状态详情弹窗 */}
      <NodeStatusModal
        visible={nodeStatusModalVisible}
        onClose={() => setNodeStatusModalVisible(false)}
        nodeStatus={nodeStatus}
        loading={nodeStatusLoading}
      />
    </Layout>
  );
};

export default Dashboard;