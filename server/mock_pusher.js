const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// 获取认证token
async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    return response.data.token;
  } catch (error) {
    console.error('获取认证token失败:', error.message);
    return null;
  }
}

// 获取启用的链配置
async function getEnabledChains() {
  try {
    const response = await axios.get(`${API_BASE_URL}/chains/enabled`);
    return response.data.map(chain => chain.id);
  } catch (error) {
    console.error('获取启用链配置失败:', error.message);
    // 如果获取失败，使用默认配置
    return ['BSC', 'ETH', 'SOL'];
  }
}

// 生成随机节点状态数据
function generateNodeStatus(chain, isOnline = true) {
  return {
    online: isOnline,
    cpuUsage: isOnline ? 20 + Math.random() * 60 : 0, // 20-80%
    memoryUsage: isOnline ? 40 + Math.random() * 40 : 0, // 40-80%
    blockHeight: Math.floor(Math.random() * 1000000),
    blockTime: isOnline ? 800 + Math.random() * 2000 : 0 // 800-2800ms
  };
}

// 推送节点状态数据
async function pushNodeStatus(chain, token) {
  try {
    // 随机决定节点是否在线 (90%在线率)
    const isOnline = Math.random() > 0.1;
    const nodeData = generateNodeStatus(chain, isOnline);
    
    const response = await axios.post(
      `${API_BASE_URL}/node/status/${chain}`,
      nodeData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    

    return true;
  } catch (error) {
    console.error(`❌ 节点状态推送失败 ${chain}:`, error.response?.data || error.message);
    return false;
  }
}

// 推送交易数据
async function pushTrade(token, enabledChains) {
  try {
    if (!enabledChains || enabledChains.length === 0) {
      return false;
    }
    
    const chain = enabledChains[Math.floor(Math.random() * enabledChains.length)];
    const tradeData = {
      chain: chain,
      builder: `Builder${Math.floor(Math.random() * 10)}`,
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      vicHashes: [`0x${Math.random().toString(16).substr(2, 64)}`],
      gross: Math.random() * 1000,
      bribe: Math.random() * 100,
      income: Math.random() * 50,
      txCount: Math.floor(Math.random() * 10) + 1,
      ratio: Math.random() * 100,
      extraInfo: 'Mock trade data',
      tags: ['mock', 'test']
    };

    const response = await axios.post(
      `${API_BASE_URL}/trade/push`,
      tradeData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );


    return true;
  } catch (error) {
    console.error('❌ 交易推送失败:', error.response?.data || error.message);
    return false;
  }
}

// 推送预警数据
async function pushWarning(token, enabledChains) {
  try {
    if (!enabledChains || enabledChains.length === 0) {
      return false;
    }
    
    const chain = enabledChains[Math.floor(Math.random() * enabledChains.length)];
    const warningTypes = ['高风险交易', '网络延迟', '余额不足', '节点异常'];
    const warningData = {
      type: warningTypes[Math.floor(Math.random() * warningTypes.length)],
      msg: `Mock warning for ${chain} - ${new Date().toLocaleString()}`,
      chain: chain
    };

    const response = await axios.post(
      `${API_BASE_URL}/warning`,
      warningData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );


    return true;
  } catch (error) {
    console.error('❌ 预警推送失败:', error.response?.data || error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 Mock Pusher 启动中...');
  
  // 获取认证token
  const token = await getAuthToken();
  if (!token) {
    process.exit(1);
  }
  
  // 获取启用的链配置
  const enabledChains = await getEnabledChains();
  
  console.log('✅ 认证成功，开始推送数据...');
  
  // 节点状态推送 - 每10秒推送一次
  setInterval(async () => {
    for (const chain of enabledChains) {
      await pushNodeStatus(chain, token);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒间隔
    }
  }, 10000);
  
  // 交易数据推送 - 每3秒推送一次
  setInterval(async () => {
    await pushTrade(token, enabledChains);
  }, 3000);
  
  // 预警数据推送 - 每30秒推送一次
  setInterval(async () => {
    if (Math.random() > 0.7) { // 30%几率推送预警
      await pushWarning(token, enabledChains);
    }
  }, 30000);
  
  // 每5分钟重新获取链配置以响应配置更改
  setInterval(async () => {
    const newEnabledChains = await getEnabledChains();
    if (JSON.stringify(enabledChains) !== JSON.stringify(newEnabledChains)) {
      enabledChains.length = 0;
      enabledChains.push(...newEnabledChains);
    }
  }, 5 * 60 * 1000);
  

}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 Mock Pusher 正在关闭...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Mock Pusher 正在关闭...');
  process.exit(0);
});

// 启动
main().catch(error => {
  console.error('❌ Mock Pusher 启动失败:', error);
  process.exit(1);
}); 