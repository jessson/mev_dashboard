import 'reflect-metadata';
import WebSocket from 'ws';
import { faker } from '@faker-js/faker';

// 配置
const API_BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000/ws';
const PUSH_INTERVAL = 1000; // 增加到3秒推送一次，避免限流
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 5000; // 重试延迟5秒

// 默认登录凭据
const DEFAULT_CREDENTIALS = {
  username: 'pusher',
  password: 'pusher123'
};

interface Credentials {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    username: string;
    type: string;
  };
}

// Mock数据生成器
class MockDataGenerator {
  private chains = ['BSC'];
  private enabledChains: string[] = ['BSC']; // 默认启用链
  private builders = [
    'Flashbots', 'Eden', 'BloXroute', 'Manifold', 'Razor', 'Jito', 'Triton'
  ];
  private tags = [
    ['Arb', 'Backrun'], 
    ['Arb', 'Block'], 
    ['48Feed', 'Arb'], 
    ['Univ4', 'Block'], 
    ['Arb', 'Sandwich'],
    ['MEV', 'Frontrun']
  ];
  private warningTypes = [
    '高风险交易', '网络拥堵', '套利机会', '异常活动', '价格异常', '流动性不足'
  ];

  generateTrade() {
    const availableChains = this.enabledChains.length > 0 ? this.enabledChains : this.chains;
    const chain = faker.helpers.arrayElement(availableChains);
    const builder = faker.helpers.arrayElement(this.builders);
    const tags = faker.helpers.arrayElement(this.tags);
    const gross = parseFloat(faker.finance.amount({ min: 0.001, max: 1, dec: 4 }));
    const bribe = gross * faker.number.float({ min: 0.05, max: 0.3 });
    const income = gross - bribe;
    const ratio = (income / gross) * 100;

    // 生成incTokens字段
    const incTokens = this.generateIncTokens(chain);

    return {
      chain,
      builder,
      hash: '0x' + faker.string.hexadecimal({ length: 64, prefix: '' }),
      vicHashes: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => 
        '0x' + faker.string.hexadecimal({ length: 64, prefix: '' })
      ),
      gross,
      bribe,
      income,
      txCount: faker.number.int({ min: 0, max: 10000 }),
      ratio,
      extraInfo: this.generateExtraInfo(),
      tags,
      incTokens,
      created_at: new Date().toISOString()
    };
  }

  generateWarning() {
    const availableChains = this.enabledChains.length > 0 ? this.enabledChains : this.chains;
    const chain = faker.helpers.arrayElement(availableChains);
    const type = faker.helpers.arrayElement(this.warningTypes);
    
    const messages: Record<string, string> = {
      '高风险交易': `检测到异常大额交易，交易金额$${faker.finance.amount({ min: 10000, max: 100000 })}，建议立即检查。`,
      '网络拥堵': `${chain}网络当前Gas费用异常高涨，已达到${faker.number.int({ min: 100, max: 500 })} Gwei。`,
      '套利机会': `${chain}网络发现高收益套利机会，预计收益率${faker.number.int({ min: 5, max: 25 })}%。`,
      '异常活动': `检测到${chain}网络异常交易模式，可能存在机器人活动。`,
      '价格异常': `${chain}网络代币价格出现异常波动，涨幅超过${faker.number.int({ min: 20, max: 100 })}%。`,
      '流动性不足': `${chain}网络部分交易对流动性不足，可能影响大额交易执行。`
    };

    return {
      type,
      msg: messages[type],
      chain,
      create_at: new Date().toISOString()
    };
  }

  generateNodeStatus() {
    const chain = faker.helpers.arrayElement(this.chains);
    const isOnline = Math.random() > 0.1; // 90%在线率
    
    return {
      online: isOnline,
      cpuUsage: isOnline ? faker.number.float({ min: 20, max: 80, fractionDigits: 1 }) : 0,
      memoryUsage: isOnline ? faker.number.float({ min: 40, max: 85, fractionDigits: 1 }) : 0,
      blockHeight: faker.number.int({ min: 40000000, max: 50000000 }),
      blockTime: isOnline ? faker.number.int({ min: 800, max: 3000 }) : 0
    };
  }

  getRandomChain(): string {
    const availableChains = this.enabledChains.length > 0 ? this.enabledChains : this.chains;
    return faker.helpers.arrayElement(availableChains);
  }

  // 设置启用的链配置
  setEnabledChains(chains: string[]): void {
    this.enabledChains = chains.length > 0 ? chains : this.chains;
    console.log(`🔄 已更新启用链配置: ${this.enabledChains.join(', ')}`);
  }

  // 获取启用的链配置
  getEnabledChains(): string[] {
    return this.enabledChains;
  }

  private generateIncTokens(chain: string): { addr: string; symbol: string }[] {
    // 根据链生成对应的代币
    const tokensByChain: Record<string, any[]> = {
      BSC: [
        { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT' },
        { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB' },
        { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD' },
        { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' },
        { addr: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'WETH' }
      ],
      ETH: [
        { addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
        { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
        { addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI' },
        { address: '0xA0b86a33E6441e8f8c99A5C82f4d8e11A3A8B7D3', symbol: 'USDC' },
        { addr: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI' }
      ],
      SOL: [
        { addr: 'So11111111111111111111111111111111111111112', symbol: 'WSOL' },
        { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' }
      ]
    };

    const availableTokens = tokensByChain[chain] || tokensByChain.BSC;
    const tokenCount = faker.number.int({ min: 1, max: 3 });
    
    return faker.helpers.arrayElements(availableTokens, tokenCount);
  }

  private generateExtraInfo(): string {
    const steps = faker.number.int({ min: 2, max: 5 });
    const extraInfo: string[] = [];
    
    for (let i = 0; i < steps; i++) {
      const amount = faker.number.float({ min: 0.0001, max: 0.1, fractionDigits: 6 });
      const token1 = faker.helpers.arrayElement(['USDT', 'USDC', 'WBNB', 'WETH', 'DAI']);
      const token2 = faker.helpers.arrayElement(['USDT', 'USDC', 'WBNB', 'WETH', 'DAI']);
      const address = '0x' + faker.string.hexadecimal({ length: 6, prefix: '' });
      const fee = faker.number.int({ min: 20, max: 50 });
      
      extraInfo.push(`${amount}->${token1}->${address}-${fee}=${amount * 0.9}->${token2}\n`);
    }
    
    return extraInfo.join('->');
  }
}

// 认证API推送器
class AuthenticatedApiPusher {
  private credentials: Credentials;
  private token: string | null = null;
  private generator: MockDataGenerator;
  private retryCount = 0;
  private isRunning = false;

  constructor(credentials: Credentials = DEFAULT_CREDENTIALS) {
    this.credentials = credentials;
    this.generator = new MockDataGenerator();
  }

  async login(): Promise<boolean> {
    try {
      console.log(`🔐 正在登录用户: ${this.credentials.username}`);
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.credentials)
      });

      if (response.ok) {
        const data: LoginResponse = await response.json();
        this.token = data.token;
        console.log(`✅ 登录成功: ${data.user.username} (${data.user.type})`);
        this.retryCount = 0; // 重置重试计数
        return true;
      } else {
        const error = await response.text();
        console.log(`❌ 登录失败: ${response.status} - ${error}`);
        return false;
      }
    } catch (error: any) {
      console.log(`❌ 登录错误: ${error.message}`);
      return false;
    }
  }

  async makeAuthenticatedRequest(endpoint: string, method: string = 'GET', body: any = null): Promise<Response | null> {
    if (!this.token) {
      console.log('❌ 未登录，无法发送请求');
      return null;
    }

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      
      // 处理401错误（token过期）
      if (response.status === 401) {
        console.log('🔄 Token过期，重新登录...');
        const loginSuccess = await this.login();
        if (loginSuccess) {
          // 重试请求
          if (options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)) {
            (options.headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
          }
          return await fetch(`${API_BASE_URL}${endpoint}`, options);
        }
        return null;
      }

      // 处理429错误（限流）
      if (response.status === 429) {
        console.log('⚠️  触发限流，等待后重试...');
        await this.sleep(RETRY_DELAY);
        return response; // 返回响应让调用者处理
      }

      return response;
    } catch (error: any) {
      console.log(`❌ 请求错误: ${error.message}`);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async pushTrade(trade: any): Promise<boolean> {
    const response = await this.makeAuthenticatedRequest('/trade', 'POST', trade);
    
    if (response && response.ok) {
      console.log(`✅ 交易推送成功: ${trade.chain} - $${trade.income.toFixed(4)}`);
      this.retryCount = 0; // 重置重试计数
      return true;
    } else if (response && response.status === 429) {
      console.log(`⚠️  交易推送限流: ${trade.chain} - 将在下次重试`);
      return false;
    } else if (response && response.status === 400) {
      // 可能是重复交易，不算错误
      const errorText = await response.text();
      if (errorText.includes('已存在') || errorText.includes('UNIQUE')) {
        console.log(`⚠️  重复交易: ${trade.hash.slice(0, 10)}...`);
        return true;
      }
      console.log(`❌ 交易推送失败: ${response.status} - ${errorText}`);
      return false;
    } else {
      console.log(`❌ 交易推送失败: ${response ? response.status : '网络错误'}`);
      return false;
    }
  }

  async pushWarning(warning: any): Promise<boolean> {
    const response = await this.makeAuthenticatedRequest('/warning', 'POST', warning);
    
    if (response && response.ok) {
      console.log(`⚠️  预警推送成功: ${warning.chain} - ${warning.type}`);
      this.retryCount = 0; // 重置重试计数
      return true;
    } else if (response && response.status === 429) {
      console.log(`⚠️  预警推送限流: ${warning.chain} - 将在下次重试`);
      return false;
    } else {
      console.log(`❌ 预警推送失败: ${response ? response.status : '网络错误'}`);
      return false;
    }
  }

  async pushNodeStatus(nodeStatus: any, chain: string): Promise<boolean> {
    const response = await this.makeAuthenticatedRequest(`/node/status/${chain}`, 'POST', nodeStatus);
    
    if (response && response.ok) {
      console.log(`🖥️  节点状态推送成功: ${chain} - ${nodeStatus.online ? '在线' : '离线'}`);
      this.retryCount = 0; // 重置重试计数
      return true;
    } else if (response && response.status === 429) {
      console.log(`⚠️  节点状态推送限流: ${chain} - 将在下次重试`);
      return false;
    } else {
      console.log(`❌ 节点状态推送失败: ${response ? response.status : '网络错误'}`);
      return false;
    }
  }

  async start(): Promise<void> {
    console.log('🚀 认证Mock数据推送器启动...');
    console.log(`📡 目标API: ${API_BASE_URL}`);
    console.log(`⏱️  推送间隔: ${PUSH_INTERVAL}ms`);
    console.log(`🔄 最大重试次数: ${MAX_RETRIES}`);
    
    // 先登录
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ 登录失败，无法启动推送器');
      console.log('💡 请确保:');
      console.log('   1. 后端服务已启动');
      console.log('   2. 用户账户存在且密码正确');
      console.log('   3. 运行 npm run user:init 创建测试用户');
      return;
    }

    console.log('---');
    this.isRunning = true;

    // 开始推送数据
    const pushLoop = async () => {
      while (this.isRunning) {
        try {
          const rand = Math.random();
          let success = false;
          
          if (rand < 0.6) {
            // 60% 概率推送交易
            const trade = this.generator.generateTrade();
            success = await this.pushTrade(trade);
          } else if (rand < 0.8) {
            // 20% 概率推送预警
            const warning = this.generator.generateWarning();
            success = await this.pushWarning(warning);
          } else if (rand < 0.95) {
            // 15% 概率推送节点状态
            const nodeStatus = this.generator.generateNodeStatus();
            const chain = this.generator.getRandomChain();
            success = await this.pushNodeStatus(nodeStatus, chain);
          } else {
            // 5% 概率跳过，减少推送频率
            success = true;
          }

          if (!success) {
            this.retryCount++;
            if (this.retryCount >= MAX_RETRIES) {
              console.log(`❌ 连续失败 ${MAX_RETRIES} 次，暂停推送...`);
              await this.sleep(RETRY_DELAY * 2); // 更长的等待时间
              this.retryCount = 0;
            }
          }

          // 等待下次推送
          await this.sleep(PUSH_INTERVAL);
        } catch (error: any) {
          console.error(`❌ 推送循环错误: ${error.message}`);
          await this.sleep(RETRY_DELAY);
        }
      }
    };

    pushLoop();
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 推送器已停止');
  }
}

// WebSocket推送器（带认证）
class AuthenticatedWebSocketPusher {
  private credentials: Credentials;
  private token: string | null = null;
  private generator: MockDataGenerator;
  private ws: WebSocket | null = null;
  private connected = false;
  private isRunning = false;

  constructor(credentials: Credentials = DEFAULT_CREDENTIALS) {
    this.credentials = credentials;
    this.generator = new MockDataGenerator();
  }

  async login(): Promise<boolean> {
    try {
      console.log(`🔐 正在登录用户: ${this.credentials.username}`);
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.credentials)
      });

      if (response.ok) {
        const data: LoginResponse = await response.json();
        this.token = data.token;
        console.log(`✅ 登录成功: ${data.user.username} (${data.user.type})`);
        return true;
      } else {
        console.log(`❌ 登录失败: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.log(`❌ 登录错误: ${error.message}`);
      return false;
    }
  }

  connect(): void {
    try {
      const wsUrl = `${WS_URL}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('🔗 WebSocket连接成功');
        this.connected = true;
      });

      this.ws.on('close', () => {
        console.log('❌ WebSocket连接断开');
        this.connected = false;
        // 5秒后重连
        if (this.isRunning) {
          setTimeout(() => this.connect(), 5000);
        }
      });

      this.ws.on('error', (error) => {
        console.log('❌ WebSocket错误:', error.message);
        this.connected = false;
      });

    } catch (error: any) {
      console.log('❌ WebSocket连接失败:', error.message);
    }
  }

  send(type: string, data: any): boolean {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }

  async start(): Promise<void> {
    console.log('🚀 认证WebSocket Mock数据推送器启动...');
    console.log(`📡 目标WebSocket: ${WS_URL}`);
    console.log(`⏱️  推送间隔: ${PUSH_INTERVAL}ms`);
    
    // 先登录
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ 登录失败，无法启动推送器');
      return;
    }

    console.log('---');
    this.isRunning = true;

    // 连接WebSocket
    this.connect();

    // 开始推送数据
    const pushLoop = async () => {
      while (this.isRunning) {
        if (!this.connected) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const rand = Math.random();
        
        if (rand < 0.6) {
          // 60% 概率推送交易
          const trade = this.generator.generateTrade();
          if (this.send('trade', trade)) {
            console.log(`✅ 交易推送: ${trade.chain} - $${trade.income.toFixed(4)}`);
          }
        } else if (rand < 0.8) {
          // 20% 概率推送预警
          const warning = this.generator.generateWarning();
          if (this.send('warning', warning)) {
            console.log(`⚠️  预警推送: ${warning.chain} - ${warning.type}`);
          }
        } else if (rand < 0.95) {
          // 15% 概率推送节点状态
          const nodeStatus = this.generator.generateNodeStatus();
          const chain = this.generator.getRandomChain();
          if (this.send('node_status', { chain, ...nodeStatus })) {
            console.log(`🖥️  节点状态推送: ${chain} - ${nodeStatus.online ? '在线' : '离线'}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, PUSH_INTERVAL));
      }
    };

    pushLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
    }
    console.log('🛑 WebSocket推送器已停止');
  }
}

// 主程序
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0] || 'api';
  const username = args[1] || DEFAULT_CREDENTIALS.username;
  const password = args[2] || DEFAULT_CREDENTIALS.password;

  const credentials: Credentials = { username, password };

  console.log('🎯 MEV认证Mock数据推送器');
  console.log('==========================');
  console.log(`👤 使用账户: ${credentials.username}`);
  console.log(`⏱️  推送间隔: ${PUSH_INTERVAL}ms (${PUSH_INTERVAL/1000}秒)`);
  console.log('');

  let pusher: AuthenticatedApiPusher | AuthenticatedWebSocketPusher;

  if (mode === 'ws' || mode === 'websocket') {
    pusher = new AuthenticatedWebSocketPusher(credentials);
  } else {
    pusher = new AuthenticatedApiPusher(credentials);
  }

  await pusher.start();

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n👋 推送器正在关闭...');
    pusher.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 推送器正在关闭...');
    pusher.stop();
    process.exit(0);
  });
}

// 检查是否直接运行
if (require.main === module) {
  main();
}

export { AuthenticatedApiPusher, AuthenticatedWebSocketPusher };