import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io: SocketIOServer;
  private fastify: FastifyInstance;
  private clients: Map<string, any> = new Map();

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async initialize(): Promise<void> {
    // 优化的Socket.IO服务器配置 - 提高部署环境稳定性
    this.io = new SocketIOServer(this.fastify.server, {
      cors: {
        origin: true, // 允许所有来源
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io',
      transports: ['polling', 'websocket'], // 支持WebSocket和polling
      allowEIO3: true,
      pingTimeout: 60000,  // 增加到60秒，提高网络波动容忍度
      pingInterval: 25000, // 25秒心跳间隔
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6,
      // 添加连接限制和错误处理
      connectTimeout: 45000,
      // 部署环境优化
      serveClient: false, // 不提供客户端文件
      cookie: false       // 不使用cookie
    });

    // 连接事件处理
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      let user = null;
      let isAuthenticated = false;

      // 尝试验证JWT token
      try {
        const token = socket.handshake.auth?.token || 
                     socket.handshake.query?.token ||
                     socket.request.headers?.authorization?.replace('Bearer ', '');
        
        if (token) {
          // 验证JWT token
          const decoded: any = this.fastify.jwt.verify(token);
          user = decoded;
          isAuthenticated = true;
          logger.info(`Socket.IO认证用户连接: ${user?.username} (${user?.type}) [${clientId}]`);
        } else {
          logger.info(`Socket.IO未认证用户连接: [${clientId}]`);
        }
      } catch (jwtError: any) {
        logger.warn(`Socket.IO JWT验证失败: [${clientId}] - ${jwtError?.message || 'unknown error'}`);
      }
      
      const clientInfo = {
        socket,
        user,
        isAuthenticated,
        connectedAt: new Date(),
        lastActivity: new Date(),
        chains: new Set<string>()
      };
      
      this.clients.set(clientId, clientInfo);
      logger.info(`Socket.IO客户端连接: ${clientId} (认证: ${isAuthenticated}) (总连接数: ${this.clients.size})`);

      // 发送欢迎消息
      socket.emit('welcome', {
        message: 'Socket.IO连接成功',
        clientId: clientId,
        timestamp: Date.now(),
        server: 'MEV监控系统',
        authenticated: isAuthenticated,
        user: isAuthenticated && user ? { username: user.username, type: user.type } : null,
        transport: socket.conn.transport.name
      });

      // 处理断开连接
      socket.on('disconnect', (reason) => {
        logger.info(`Socket.IO客户端断开: ${clientId} - ${reason} (剩余连接数: ${this.clients.size - 1})`);
        this.clients.delete(clientId);
      });

      // 处理加入链房间 - 仅认证用户
      socket.on('join-chain', (chain: string) => {
        if (!isAuthenticated) {
          socket.emit('error', { message: '需要登录才能加入链房间' });
          return;
        }

        socket.join(`chain:${chain}`);
        clientInfo.chains.add(chain);
        clientInfo.lastActivity = new Date();
        logger.info(`客户端 ${clientId} (${user?.username}) 加入链房间: ${chain}`);
        
        socket.emit('joined-chain', {
          chain,
          message: `已加入 ${chain} 链房间`,
          timestamp: Date.now()
        });
      });

      // 处理离开链房间 - 仅认证用户
      socket.on('leave-chain', (chain: string) => {
        if (!isAuthenticated) {
          socket.emit('error', { message: '需要登录才能操作链房间' });
          return;
        }

        socket.leave(`chain:${chain}`);
        clientInfo.chains.delete(chain);
        clientInfo.lastActivity = new Date();
        logger.info(`客户端 ${clientId} (${user?.username}) 离开链房间: ${chain}`);
        
        socket.emit('left-chain', {
          chain,
          message: `已离开 ${chain} 链房间`,
          timestamp: Date.now()
        });
      });

      // 处理ping消息
      socket.on('ping', (data) => {
        clientInfo.lastActivity = new Date();
        logger.debug(`收到Socket.IO ping: ${clientId}`, data);
        
        socket.emit('pong', { 
          ...data, 
          serverTime: Date.now(),
          clientId: clientId,
          authenticated: isAuthenticated,
          transport: socket.conn.transport.name
        });
      });

      // 处理心跳
      socket.on('heartbeat', () => {
        clientInfo.lastActivity = new Date();
        socket.emit('heartbeat-ack', {
          timestamp: Date.now(),
          clientId: clientId,
          authenticated: isAuthenticated
        });
      });

      // 处理错误
      socket.on('error', (error) => {
        logger.error(`Socket.IO客户端错误 [${clientId}]:`, error);
      });

      // 监听传输升级
      socket.conn.on('upgrade', () => {
        logger.info(`Socket.IO传输升级: ${clientId} -> ${socket.conn.transport.name}`);
      });

      socket.conn.on('upgradeError', (error) => {
        logger.warn(`Socket.IO传输升级失败: ${clientId}`, error.message);
      });
    });

    // 监听引擎事件
    this.io.engine.on('connection_error', (err) => {
      logger.error(`Socket.IO引擎连接错误: ${err}`);
    });

    // 添加服务器级别的错误处理
    this.io.on('error', (error) => {
      logger.error(`Socket.IO服务器错误: ${error}`);
    });

    // 定期清理断开的连接
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5分钟清理一次

    logger.info(`Socket.IO服务初始化完成`);
    logger.info(`Socket.IO路径: /socket.io`);
    logger.info(`Socket.IO传输: polling + websocket (部署环境优化)`);
    logger.info(`CORS允许来源: 所有来源`);
    logger.info(`心跳间隔: 25秒, 超时: 60秒`);
  }

  // 广播新交易 - 仅发送给认证用户
  broadcastTrade(trade: any): void {
    try {
      const message = {
        type: 'new_trade',
        data: trade,
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('new_trade', message);
          client.socket.emit('trade_update', message);
        }
      });
      
      logger.info(`广播交易数据: ${trade.chain} - ${trade.hash?.slice(0, 10)}... (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播交易数据失败: ${error}`);
    }
  }

  // 广播新预警 - 仅发送给认证用户
  broadcastWarning(warning: any): void {
    try {
      // 将createdAt字段映射为create_at以匹配前端接口
      const mappedWarning = {
        ...warning,
        create_at: warning.createdAt.toISOString()
      };
      
      const message = {
        type: 'new_warning',
        data: mappedWarning,
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('new_warning', message);
          client.socket.emit('warning_update', message);
        }
      });
      
      logger.info(`广播预警数据: ${warning.chain} - ${warning.type} (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播预警数据失败: ${error}`);
    }
  }

  // 广播收益更新 - 仅发送给认证用户
  broadcastProfit(profit: any): void {
    try {
      const message = {
        type: 'profit_update',
        data: profit,
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('profit_update', message);
          client.socket.emit('profit_changed', message);
        }
      });
      
      logger.info(`广播收益数据: ${profit.chain} (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播收益数据失败: ${error}`);
    }
  }

  // 广播标签收益更新 - 仅发送给认证用户
  broadcastTagProfits(chain: string, tagProfits: any[]): void {
    try {
      const message = {
        type: 'tag_profits_update',
        data: { chain, tagProfits },
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('tag_profits_changed', message);
        }
      });
      
      logger.info(`广播标签收益数据: ${chain} - ${tagProfits.length}个标签 (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播标签收益数据失败: ${error}`);
    }
  }

  // 广播代币收益更新 - 仅发送给认证用户  
  broadcastTokenProfits(chain: string, tokenProfits: any[]): void {
    try {
      tokenProfits.sort((a, b) => b.totalProfit - a.totalProfit);
      tokenProfits = tokenProfits.slice(0, 100);
      
      const message = {
        type: 'token_profits_update',
        data: { chain, tokenProfits },
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('token_profits_changed', message);
        }
      });
      
      logger.info(`广播代币收益数据: ${chain} - ${tokenProfits.length}个代币 (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播代币收益数据失败: ${error}`);
    }
  }

  // 广播欢迎页统计数据更新 - 向所有用户发送（包括未登录）
  broadcastWelcomeStats(welcomeStats: any[]): void {
    try {
      const message = {
        type: 'welcome_stats_update',
        data: welcomeStats,
        timestamp: Date.now()
      };

      // 广播到所有客户端（包括未认证用户）
      this.io.emit('welcome_stats_changed', message);
      
      logger.info(`广播欢迎页统计数据: ${welcomeStats.length}个链 (所有连接: ${this.clients.size})`);
    } catch (error) {
      logger.error(`广播欢迎页统计数据失败: ${error}`);
    }
  }

  // 广播节点状态更新 - 仅发送给认证用户
  broadcastNodeStatus(nodeStatus: any): void {
    try {
      const message = {
        type: 'node_status_update',
        data: nodeStatus,
        timestamp: Date.now()
      };

      let authenticatedCount = 0;
      this.clients.forEach((client, clientId) => {
        if (client.isAuthenticated) {
          authenticatedCount++;
          client.socket.emit('node_status_update', message);
        }
      });
      
      logger.info(`广播节点状态数据: ${nodeStatus.summary?.total || 0}个节点 (认证用户: ${authenticatedCount})`);
    } catch (error) {
      logger.error(`广播节点状态数据失败: ${error}`);
    }
  }

  // 广播给所有客户端 - 可以指定是否仅发送给认证用户
  broadcast(event: string, data: any, authenticatedOnly: boolean = false): void {
    try {
      const message = {
        ...data,
        timestamp: Date.now()
      };

      if (authenticatedOnly) {
        let authenticatedCount = 0;
        this.clients.forEach((client, clientId) => {
          if (client.isAuthenticated) {
            authenticatedCount++;
            client.socket.emit(event, message);
          }
        });
        logger.info(`广播事件 ${event} 给认证用户 (认证用户: ${authenticatedCount})`);
      } else {
        this.io.emit(event, message);
        logger.info(`广播事件 ${event} 给所有客户端 (连接数: ${this.clients.size})`);
      }
    } catch (error) {
      logger.error(`广播事件失败 ${event}:`, error);
    }
  }

  // 获取连接数
  getConnectionCount(): number {
    return this.clients.size;
  }

  // 获取连接统计
  getConnectionStats(): {
    socketIO: number;
    websocket: number;
    total: number;
    authenticated: number;
    unauthenticated: number;
    clients: Array<{
      id: string;
      type: string;
      authenticated: boolean;
      user?: any;
      connectedAt: Date;
      lastActivity?: Date;
      chains?: string[];
      transport?: string;
    }>;
  } {
    const clients: Array<{
      id: string;
      type: string;
      authenticated: boolean;
      user?: any;
      connectedAt: Date;
      lastActivity?: Date;
      chains?: string[];
      transport?: string;
    }> = [];

    let authenticatedCount = 0;
    let unauthenticatedCount = 0;

    this.clients.forEach((client, id) => {
      if (client.isAuthenticated) {
        authenticatedCount++;
      } else {
        unauthenticatedCount++;
      }

      clients.push({
        id,
        type: 'Socket.IO',
        authenticated: client.isAuthenticated,
        user: client.user,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        chains: Array.from(client.chains || []),
        transport: client.socket?.conn?.transport?.name || 'unknown'
      });
    });

    return {
      socketIO: this.clients.size,
      websocket: 0, // 不再使用原生WebSocket
      total: this.clients.size,
      authenticated: authenticatedCount,
      unauthenticated: unauthenticatedCount,
      clients
    };
  }

  // 测试广播
  testBroadcast(): void {
    try {
      const testMessage = {
        message: 'Socket.IO测试消息',
        timestamp: Date.now(),
        server: 'MEV监控系统',
        connectedClients: this.clients.size
      };

      this.broadcast('test_message', testMessage);
      logger.info(`发送测试广播消息 (连接数: ${this.clients.size})`);
    } catch (error) {
      logger.error(`发送测试广播失败: ${error}`);
    }
  }

  // 向特定客户端发送消息
  sendToClient(clientId: string, event: string, data: any): boolean {
    try {
      const client = this.clients.get(clientId);
      if (client && client.socket && client.socket.connected) {
        client.socket.emit(event, {
          ...data,
          timestamp: Date.now()
        });
        client.lastActivity = new Date();
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`向客户端 ${clientId} 发送消息失败:`, error);
      return false;
    }
  }

  // 清理断开的连接
  cleanup(): void {
    try {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5分钟超时

      this.clients.forEach((client, id) => {
        if (!client.socket.connected || 
            (client.lastActivity && now - client.lastActivity.getTime() > timeout)) {
          logger.info(`清理超时Socket.IO连接: ${id}`);
          this.clients.delete(id);
        }
      });

      logger.info(`连接清理完成，当前连接数: ${this.clients.size}`);
    } catch (error) {
      logger.error(`清理连接失败: ${error}`);
    }
  }

  // 获取房间信息
  getRoomInfo(): { [room: string]: number } {
    try {
      const rooms: { [room: string]: number } = {};
      this.io.sockets.adapter.rooms.forEach((value, key) => {
        if (key.startsWith('chain:')) {
          rooms[key] = value.size;
        }
      });
      return rooms;
    } catch (error) {
      logger.error(`获取房间信息失败: ${error}`);
      return {};
    }
  }

  // 强制断开所有连接
  disconnectAll(): void {
    this.io.disconnectSockets();
    this.clients.clear();
    logger.info(`已断开所有Socket.IO连接`);
  }
}