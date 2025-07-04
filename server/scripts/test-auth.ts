#!/usr/bin/env tsx

// Node.js 18+ 内置 fetch

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  expected: 'public' | 'protected';
  actual: 'accessible' | 'blocked' | 'error';
  status: number;
  message?: string;
}

async function testEndpoint(
  endpoint: string, 
  expected: 'public' | 'protected',
  token?: string
): Promise<TestResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers
    });

    const actual = response.status === 401 ? 'blocked' : 'accessible';
    
    return {
      endpoint,
      expected,
      actual,
      status: response.status,
      message: response.status === 401 ? '未授权访问' : response.statusText
    };
  } catch (error: any) {
    return {
      endpoint,
      expected,
      actual: 'error',
      status: 0,
      message: error.message
    };
  }
}

async function runTests() {
  console.log('🔐 权限控制测试开始...\n');

  // 应该公开访问的端点
  const publicEndpoints = [
    '/api/welcome'
  ];

  // 应该需要认证的端点
  const protectedEndpoints = [
    '/api/trade/search',
    '/api/history',
    '/api/profit',
    '/api/warnings',
    '/api/top',
    '/api/chains',
    '/api/token/stats',
    '/api/tag/daily-profit'
  ];

  const results: TestResult[] = [];

  console.log('📂 测试公开端点（无需认证）：');
  for (const endpoint of publicEndpoints) {
    const result = await testEndpoint(endpoint, 'public');
    results.push(result);
    
    const status = result.actual === 'accessible' ? '✅' : '❌';
    console.log(`${status} ${endpoint} - ${result.status} (${result.actual})`);
  }

  console.log('\n🔒 测试受保护端点（需要认证）：');
  for (const endpoint of protectedEndpoints) {
    const result = await testEndpoint(endpoint, 'protected');
    results.push(result);
    
    const status = result.actual === 'blocked' ? '✅' : '❌';
    console.log(`${status} ${endpoint} - ${result.status} (${result.actual})`);
  }

  // 汇总结果
  console.log('\n📊 测试结果汇总：');
  const passed = results.filter(r => 
    (r.expected === 'public' && r.actual === 'accessible') ||
    (r.expected === 'protected' && r.actual === 'blocked')
  ).length;
  
  const failed = results.length - passed;
  
  console.log(`✅ 通过: ${passed}/${results.length}`);
  console.log(`❌ 失败: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ 失败的测试：');
    results
      .filter(r => 
        !((r.expected === 'public' && r.actual === 'accessible') ||
          (r.expected === 'protected' && r.actual === 'blocked'))
      )
      .forEach(r => {
        console.log(`   ${r.endpoint}: 期望 ${r.expected}, 实际 ${r.actual} (${r.status})`);
      });
  }

  console.log('\n🎯 权限控制测试完成！');
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！权限控制配置正确。');
  } else {
    console.log('⚠️  有测试失败，请检查权限配置。');
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests }; 