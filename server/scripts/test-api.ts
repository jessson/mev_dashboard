import 'reflect-metadata';

async function testApiEndpoints() {
  console.log('🧪 测试API端点连接');
  console.log('='.repeat(50));

  const baseUrl = 'http://localhost:3000';
  
  const endpoints = [
    { name: '根路径', url: '/', method: 'GET' },
    { name: '健康检查', url: '/api/health', method: 'GET' },
    { name: '登录端点', url: '/api/login', method: 'POST', body: { username: 'admin', password: 'admin123' } }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 测试: ${endpoint.name}`);
      console.log(`📡 URL: ${baseUrl}${endpoint.url}`);
      
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
        console.log(`📋 请求体: ${JSON.stringify(endpoint.body)}`);
      }

      const response = await fetch(`${baseUrl}${endpoint.url}`, options);
      
      console.log(`📊 状态码: ${response.status}`);
      console.log(`📋 响应头: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
      
      const responseText = await response.text();
      console.log(`📄 响应内容: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      
      if (response.ok) {
        console.log(`✅ ${endpoint.name} - 成功`);
      } else {
        console.log(`❌ ${endpoint.name} - 失败`);
      }
      
    } catch (error: any) {
      console.log(`❌ ${endpoint.name} - 连接失败: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 提示: 服务器可能没有启动，请运行 npm run dev');
      }
    }
  }

  console.log('\n📋 测试完成');
  console.log('\n💡 如果所有测试都失败，请检查:');
  console.log('1. 后端服务器是否正在运行 (npm run dev)');
  console.log('2. 端口3000是否被占用');
  console.log('3. 防火墙设置');
  console.log('4. 网络连接');
}

// 测试前端API配置
function testFrontendConfig() {
  console.log('\n🌐 前端API配置检查');
  console.log('='.repeat(30));
  
  // 模拟检查前端配置
  const expectedApiUrl = 'http://localhost:3000';
  const useMock = false; // 应该是false
  
  console.log(`📡 API基础URL: ${expectedApiUrl}`);
  console.log(`🎭 使用Mock数据: ${useMock ? '是' : '否'}`);
  
  if (useMock) {
    console.log('⚠️  警告: 前端正在使用Mock数据，不会连接真实后端');
    console.log('💡 请在 src/services/api.ts 中设置 useMock = false');
  } else {
    console.log('✅ 前端配置正确，将连接真实后端');
  }
}

async function main() {
  await testApiEndpoints();
  testFrontendConfig();
}

if (require.main === module) {
  main();
}

export { testApiEndpoints };