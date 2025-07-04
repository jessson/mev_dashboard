import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { TypeormConnection } from '../src/config/database';
import { User } from '../src/entities/User';

async function debugLogin() {
  try {
    console.log('🔍 登录问题诊断工具');
    console.log('='.repeat(50));

    // 初始化数据库连接
    if (!TypeormConnection.isInitialized) {
      await TypeormConnection.initialize();
    }
    console.log('✅ 数据库连接成功');

    const userRepository = TypeormConnection.getRepository(User);

    // 1. 检查用户表结构
    console.log('\n📊 检查用户表结构...');
    const queryRunner = TypeormConnection.createQueryRunner();
    const tableInfo = await queryRunner.query("PRAGMA table_info(users)");
    await queryRunner.release();
    
    console.log('用户表字段:');
    tableInfo.forEach((column: any) => {
      console.log(`  - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
    });

    // 2. 检查用户数据
    console.log('\n👥 检查用户数据...');
    const users = await userRepository.find();
    console.log(`总用户数: ${users.length}`);
    
    if (users.length === 0) {
      console.log('❌ 没有找到任何用户数据');
      return;
    }

    console.log('\n用户列表:');
    console.log('ID\t用户名\t\t类型\t\t状态\t\t密码哈希');
    console.log('─'.repeat(80));
    users.forEach(user => {
      const status = user.isActive ? '激活' : '禁用';
      const passwordPreview = user.password.substring(0, 20) + '...';
      console.log(`${user.id}\t${user.username.padEnd(12)}\t${user.type.padEnd(8)}\t${status}\t\t${passwordPreview}`);
    });

    // 3. 测试密码验证
    console.log('\n🔐 测试密码验证...');
    const testCredentials = [
      { username: 'admin', password: 'admin123' },
      { username: 'admin', password: 'admin' },
      { username: 'test_user', password: 'test123' },
      { username: 'pusher', password: 'pusher123' }
    ];

    for (const cred of testCredentials) {
      const user = await userRepository.findOne({
        where: { username: cred.username }
      });

      if (!user) {
        console.log(`❌ 用户不存在: ${cred.username}`);
        continue;
      }

      // 检查密码是否是bcrypt哈希
      const isBcryptHash = user.password.startsWith('$2');
      console.log(`\n用户: ${cred.username}`);
      console.log(`  密码格式: ${isBcryptHash ? 'bcrypt哈希' : '可能是明文或其他格式'}`);
      console.log(`  是否激活: ${user.isActive}`);

      if (isBcryptHash) {
        try {
          const isValid = await bcrypt.compare(cred.password, user.password);
          console.log(`  密码验证: ${isValid ? '✅ 正确' : '❌ 错误'}`);
        } catch (error) {
          console.log(`  密码验证: ❌ 验证失败 - ${error}`);
        }
      } else {
        console.log(`  密码验证: ⚠️  密码不是bcrypt格式，需要重新加密`);
      }
    }

    // 4. 检查API端点
    console.log('\n🌐 检查API端点...');
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        console.log('✅ 健康检查端点正常');
      } else {
        console.log(`❌ 健康检查失败: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ 无法连接到API服务器: ${error}`);
      console.log('💡 请确保后端服务器正在运行 (npm run dev)');
    }

    // 5. 测试登录API
    console.log('\n🔑 测试登录API...');
    for (const cred of testCredentials.slice(0, 2)) { // 只测试前两个
      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cred)
        });

        const result = await response.text();
        console.log(`\n登录测试: ${cred.username}/${cred.password}`);
        console.log(`  状态码: ${response.status}`);
        console.log(`  响应: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`);
      } catch (error) {
        console.log(`❌ 登录API测试失败: ${error}`);
      }
    }

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    if (TypeormConnection.isInitialized) {
      await TypeormConnection.destroy();
    }
  }
}

// 修复密码函数
async function fixPasswords() {
  try {
    console.log('🔧 修复用户密码...');

    if (!TypeormConnection.isInitialized) {
      await TypeormConnection.initialize();
    }

    const userRepository = TypeormConnection.getRepository(User);
    const users = await userRepository.find();

    const defaultPasswords: { [key: string]: string } = {
      'admin': 'admin123',
      'test_user': 'test123',
      'pusher': 'pusher123',
      'guest': 'guest123'
    };

    for (const user of users) {
      const defaultPassword = defaultPasswords[user.username];
      if (defaultPassword) {
        // 检查密码是否已经是bcrypt格式
        const isBcryptHash = user.password.startsWith('$2');
        
        if (!isBcryptHash) {
          console.log(`🔄 重新加密密码: ${user.username}`);
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          user.password = hashedPassword;
          await userRepository.save(user);
          console.log(`✅ 密码已更新: ${user.username}`);
        } else {
          console.log(`✅ 密码格式正确: ${user.username}`);
        }
      }
    }

    console.log('✅ 密码修复完成');

  } catch (error) {
    console.error('❌ 密码修复失败:', error);
  } finally {
    if (TypeormConnection.isInitialized) {
      await TypeormConnection.destroy();
    }
  }
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'fix') {
    await fixPasswords();
  } else {
    await debugLogin();
  }
}

if (require.main === module) {
  main();
}