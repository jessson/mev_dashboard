const http = require('http');
const https = require('https');
const url = require('url');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// 配置dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 简化的Profit测试脚本
 * 通过API调用而不是直接访问数据库来测试profit数据
 */
class SimpleProfitTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.token = null;
  }

  /**
   * 获取认证token
   */
  async getAuthToken() {
    if (this.token) return this.token;

    try {
      // 优先从命令行参数获取
      const args = process.argv.slice(2);
      const tokenArg = args.find(arg => arg.startsWith('--token='));
      if (tokenArg) {
        this.token = tokenArg.split('=')[1];
        console.log('✅ 从命令行参数获取token');
        return this.token;
      }

      // 其次从环境变量获取
      if (process.env.TEST_TOKEN) {
        this.token = process.env.TEST_TOKEN;
        console.log('✅ 从环境变量获取token');
        return this.token;
      }

      // 如果都没有，尝试简单的测试登录
      console.log('⚠️  未找到认证token，尝试测试用户登录...');
      try {
        const loginResult = await this.testLogin();
        if (loginResult && loginResult.token) {
          this.token = loginResult.token;
          console.log('✅ 测试登录成功');
          return this.token;
        }
      } catch (loginError) {
        console.log('❌ 测试登录失败:', loginError.message);
      }

      console.log('⚠️  请手动设置认证token：');
      console.log('方法1: 使用命令行参数: node test-profit.js --token=your-token-here');
      console.log('方法2: 设置环境变量: TEST_TOKEN=your-token-here node test-profit.js');
      console.log('方法3: 在浏览器登录后，从localStorage中获取token');
      
      // 使用占位符token继续执行（可能会失败）
      this.token = 'placeholder-token';
      return this.token;
    } catch (error) {
      console.error('获取认证token失败:', error);
      throw error;
    }
  }

  /**
   * 尝试测试用户登录
   */
  async testLogin() {
    const testUsers = [
      { username: 'test', password: 'test123' },
      { username: 'admin', password: 'admin123' }
    ];

    for (const user of testUsers) {
      try {
        console.log(`尝试登录: ${user.username}`);
        const result = await this.httpRequest(`${this.baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
        
        if (result && result.token) {
          console.log(`✅ 用户 ${user.username} 登录成功`);
          return result;
        }
      } catch (error) {
        console.log(`❌ 用户 ${user.username} 登录失败: ${error.message}`);
      }
    }
    
    throw new Error('所有测试用户登录都失败');
  }

  /**
   * 发送HTTP请求（使用Node.js内置模块）
   */
  httpRequest(urlString, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(urlString);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = lib.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`解析JSON失败: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * 发送API请求
   */
  async apiRequest(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const requestOptions = {
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    if (options.body) {
      requestOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }
    
    try {
      return await this.httpRequest(`${this.baseUrl}${endpoint}`, requestOptions);
    } catch (error) {
      console.error(`API请求失败 [${endpoint}]:`, error.message);
      throw error;
    }
  }

  /**
   * 显示时间段信息
   */
  showTimeRangeInfo() {
    const now = dayjs();
    
    console.log('\n=== 时间段定义 ===');
    console.log(`当前时间: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`今天: ${now.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`昨天: ${now.clone().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`本周: ${now.clone().startOf('week').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('week').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`上周: ${now.clone().subtract(1, 'week').startOf('week').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'week').endOf('week').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`本月: ${now.clone().startOf('month').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().endOf('month').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`上月: ${now.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm:ss')} ~ ${now.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD HH:mm:ss')}`);
    console.log('\n注意: 周的开始是周日(0)，周一是1，以此类推');
  }

  /**
   * 格式化profit数据显示
   */
  formatProfitData(period, data) {
    return `${period}: $${data.income.toFixed(4)} (${data.txCount}笔) | gross: $${data.gross.toFixed(4)}`;
  }

  /**
   * 测试profit数据
   */
  async testProfitData() {
    console.log('\n🧪 开始Profit数据测试...\n');
    
    // 显示时间段信息
    this.showTimeRangeInfo();

    try {
      // 获取profit数据
      console.log('\n📊 获取系统profit数据...');
      const profitData = await this.apiRequest('/profit');
      
      console.log(`\n=== 系统Profit数据 ===`);
      console.log(`共${profitData.length}个链的数据`);

      for (const chainProfit of profitData) {
        console.log(`\n🔍 链: ${chainProfit.chain}`);
        console.log('='.repeat(60));
        
        console.log(this.formatProfitData('📅 今天', chainProfit.today));
        console.log(this.formatProfitData('📅 昨天', chainProfit.yesterday));
        console.log(this.formatProfitData('📅 本周', chainProfit.thisWeek));
        console.log(this.formatProfitData('📅 上周', chainProfit.lastWeek));
        console.log(this.formatProfitData('📅 本月', chainProfit.thisMonth));
        console.log(this.formatProfitData('📅 上月', chainProfit.lastMonth));
        
        // 数据验证
        this.validateChainProfitData(chainProfit);
      }

      // 获取welcome数据对比
      console.log('\n📊 获取welcome数据对比...');
      const welcomeData = await this.apiRequest('/welcome');
      
      console.log(`\n=== Welcome数据对比 ===`);
      for (const welcome of welcomeData) {
        const chainProfit = profitData.find(p => p.chain === welcome.chain);
        if (chainProfit) {
          console.log(`\n🔍 链: ${welcome.chain}`);
          console.log(`Welcome总收益: $${welcome.income.toFixed(4)} (${welcome.txCount}笔)`);
          console.log(`Profit今日: $${chainProfit.today.income.toFixed(4)} (${chainProfit.today.txCount}笔)`);
          
          const isWelcomeGreater = welcome.income > chainProfit.today.income;
          console.log(`${isWelcomeGreater ? '✅' : '❌'} Welcome数据${isWelcomeGreater ? '大于' : '小于等于'}今日profit数据`);
        }
      }

    } catch (error) {
      console.error('❌ 测试过程中出现错误:', error);
    }
  }

  /**
   * 验证单个链的profit数据
   */
  validateChainProfitData(chainProfit) {
    console.log('\n📊 数据验证:');
    
    // 检查数据合理性
    const periods = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'];
    const issues = [];
    
    periods.forEach(period => {
      const data = chainProfit[period];
      if (data.income < 0) {
        issues.push(`${period}收益为负数: $${data.income.toFixed(4)}`);
      }
      if (data.txCount < 0) {
        issues.push(`${period}交易数为负数: ${data.txCount}`);
      }
      if (data.income > 0 && data.txCount === 0) {
        issues.push(`${period}有收益但交易数为0`);
      }
    });
    
    if (issues.length > 0) {
      console.log('❌ 发现数据异常:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('✅ 基础数据验证通过');
    }
    
    // 时间逻辑验证
    const today = chainProfit.today;
    const thisWeek = chainProfit.thisWeek;
    const thisMonth = chainProfit.thisMonth;
    
    if (today.income > thisWeek.income && thisWeek.income > 0) {
      console.log(`⚠️  今日收益($${today.income.toFixed(4)})大于本周收益($${thisWeek.income.toFixed(4)})`);
    }
    
    if (today.income > thisMonth.income && thisMonth.income > 0) {
      console.log(`⚠️  今日收益($${today.income.toFixed(4)})大于本月收益($${thisMonth.income.toFixed(4)})`);
    }
  }

  /**
   * 测试profit趋势数据
   */
  async testProfitTrend(chain = 'ETH', days = 7) {
    console.log(`\n📈 测试${chain}链最近${days}天的收益趋势...\n`);
    
    try {
      const trendData = await this.apiRequest(`/profit/trend/${chain}?days=${days}`);
      
      console.log(`=== ${chain}链收益趋势 ===`);
      console.log(`共${trendData.length}天的数据`);
      
      trendData.forEach((day, index) => {
        const date = dayjs(day.date);
        const isToday = date.isSame(dayjs(), 'day');
        const isYesterday = date.isSame(dayjs().subtract(1, 'day'), 'day');
        
        let label = day.date;
        if (isToday) label += ' (今天)';
        if (isYesterday) label += ' (昨天)';
        
        console.log(`${label}: $${day.income.toFixed(4)} (${day.txCount}笔) | gross: $${day.gross.toFixed(4)}`);
      });

      // 趋势分析
      if (trendData.length >= 2) {
        const latest = trendData[trendData.length - 1];
        const previous = trendData[trendData.length - 2];
        
        const incomeChange = latest.income - previous.income;
        const txCountChange = latest.txCount - previous.txCount;
        
        console.log(`\n📊 趋势分析:`);
        console.log(`收益变化: ${incomeChange >= 0 ? '+' : ''}$${incomeChange.toFixed(4)}`);
        console.log(`交易数变化: ${txCountChange >= 0 ? '+' : ''}${txCountChange}笔`);
      }
      
    } catch (error) {
      console.error(`❌ 获取${chain}链趋势数据失败:`, error);
    }
  }

  /**
   * 手动触发profit重新计算
   */
  async triggerProfitRecalculation() {
    console.log('\n🔄 手动触发profit重新计算...');
    
    try {
      const result = await this.apiRequest('/profit/calculate', {
        method: 'POST'
      });
      
      console.log('✅ Profit重新计算完成:', result);
      
      // 等待几秒后重新获取数据
      console.log('⏳ 等待3秒后重新获取数据...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newProfitData = await this.apiRequest('/profit');
      console.log(`📊 重新计算后的数据: ${newProfitData.length}个链`);
      
      return newProfitData;
      
    } catch (error) {
      console.error('❌ 触发profit重新计算失败:', error);
      throw error;
    }
  }
}

// 主函数
async function main() {
  const tester = new SimpleProfitTester();
  
  try {
    // 基本profit数据测试
    await tester.testProfitData();
    
    // 测试profit趋势
    await tester.testProfitTrend('ETH', 7);
    await tester.testProfitTrend('BSC', 7);
    
    // 手动触发重新计算（需要管理员权限）
    try {
      await tester.triggerProfitRecalculation();
    } catch (error) {
      console.log('⚠️  触发重新计算失败（可能需要管理员权限）:', error.message);
    }
    
    console.log('\n✅ 测试完成!');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  // 检查Node.js版本
  const nodeVersion = process.version;
  console.log(`Node.js版本: ${nodeVersion}`);
  
  // 检查是否安装了必要的依赖
  try {
    require('dayjs');
    console.log('✅ dayjs已安装');
  } catch (error) {
    console.error('❌ 请先在项目根目录安装dayjs: npm install dayjs');
    console.error('或者在server目录安装: cd server && npm install');
    process.exit(1);
  }
  
  console.log('\n🚀 启动Profit测试脚本...');
  console.log('注意: 请确保后端服务运行在localhost:3000');
  console.log('注意: 可以通过以下方式提供认证token:');
  console.log('  - 命令行参数: node test-profit.js --token=your-token');
  console.log('  - 环境变量: TEST_TOKEN=your-token node test-profit.js');
  console.log('  - 或脚本会尝试自动登录测试用户');
  
  main().catch(console.error);
}

module.exports = { SimpleProfitTester }; 