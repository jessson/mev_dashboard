import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { TypeormConnection } from '../src/config/database';
import { User, UserType } from '../src/entities/User';
import * as path from 'path';
import * as fs from 'fs';

class UserManager {
  private connection: any = null;
  private userRepository: any = null;

  async initialize() {
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(process.env.DATABASE_PATH || './data/mev.db');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`✅ 创建数据目录: ${dataDir}`);
      }

      // 初始化数据库连接
      if (!TypeormConnection.isInitialized) {
        await TypeormConnection.initialize();
      }
      this.connection = TypeormConnection;
      this.userRepository = this.connection.getRepository(User);
      console.log('✅ 数据库连接成功');

      // 检查表是否存在
      const queryRunner = this.connection.createQueryRunner();
      const tables = await queryRunner.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
      await queryRunner.release();

      if (tables.length === 0) {
        console.log('⚠️  用户表不存在，正在创建...');
        await this.connection.synchronize();
        console.log('✅ 数据库表创建完成');
      }

    } catch (error: any) {
      console.error('❌ 数据库连接失败:', error.message);
      throw error;
    }
  }

  async createUser(username: string, password: string, type: UserType = UserType.NORMAL) {
    try {
      // 检查用户是否已存在
      const existingUser = await this.userRepository.findOne({
        where: { username }
      });

      if (existingUser) {
        console.log(`⚠️  用户 ${username} 已存在`);
        return existingUser;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const user = this.userRepository.create({
        username,
        password: hashedPassword,
        type,
        isActive: true
      });

      const savedUser = await this.userRepository.save(user);
      console.log(`✅ 用户创建成功: ${username} (${type})`);
      return savedUser;
    } catch (error: any) {
      console.error(`❌ 创建用户失败: ${error.message}`);
      throw error;
    }
  }

  async listUsers() {
    try {
      const users = await this.userRepository.find({
        select: ['id', 'username', 'type', 'isActive', 'createdAt']
      });

      console.log('\n📋 用户列表:');
      console.log('ID\t用户名\t\t类型\t\t状态\t\t创建时间');
      console.log('─'.repeat(80));
      
      users.forEach((user: any) => {
        const status = user.isActive ? '激活' : '禁用';
        const createdAt = new Date(user.createdAt).toLocaleString('zh-CN');
        console.log(`${user.id}\t${user.username.padEnd(12)}\t${user.type.padEnd(8)}\t${status}\t\t${createdAt}`);
      });

      return users;
    } catch (error: any) {
      console.error(`❌ 获取用户列表失败: ${error.message}`);
      throw error;
    }
  }

  async deleteUser(username: string) {
    try {
      const result = await this.userRepository.delete({ username });
      
      if (result.affected > 0) {
        console.log(`✅ 用户删除成功: ${username}`);
        return true;
      } else {
        console.log(`⚠️  用户不存在: ${username}`);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ 删除用户失败: ${error.message}`);
      throw error;
    }
  }

  async updateUserStatus(username: string, isActive: boolean) {
    try {
      const result = await this.userRepository.update(
        { username },
        { isActive }
      );

      if (result.affected > 0) {
        const status = isActive ? '激活' : '禁用';
        console.log(`✅ 用户状态更新成功: ${username} -> ${status}`);
        return true;
      } else {
        console.log(`⚠️  用户不存在: ${username}`);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ 更新用户状态失败: ${error.message}`);
      throw error;
    }
  }

  async createTestUsers() {
    console.log('🔧 创建测试用户...');
    
    const testUsers = [
      { username: 'admin', password: 'admin123', type: UserType.ADMIN },
      { username: 'test_user', password: 'test123', type: UserType.NORMAL },
      { username: 'pusher', password: 'pusher123', type: UserType.ADMIN }, // 用于数据推送
      { username: 'guest', password: 'guest123', type: UserType.GUEST }
    ];

    for (const userData of testUsers) {
      await this.createUser(userData.username, userData.password, userData.type);
    }

    console.log('✅ 测试用户创建完成');
    
    // 显示创建的用户信息
    console.log('\n📝 测试用户信息:');
    console.log('用户名\t\t密码\t\t类型');
    console.log('─'.repeat(40));
    testUsers.forEach(user => {
      console.log(`${user.username.padEnd(12)}\t${user.password.padEnd(12)}\t${user.type}`);
    });
  }

  async testConnection() {
    try {
      console.log('🔍 测试数据库连接...');
      
      // 测试查询
      const count = await this.userRepository.count();
      console.log(`✅ 数据库连接正常，当前用户数量: ${count}`);
      
      // 测试表结构
      const queryRunner = this.connection.createQueryRunner();
      const tableInfo = await queryRunner.query("PRAGMA table_info(users)");
      await queryRunner.release();
      
      console.log('📊 用户表结构:');
      tableInfo.forEach((column: any) => {
        console.log(`  - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ 数据库连接测试失败:', error.message);
      return false;
    }
  }

  async fixPasswords() {
    try {
      console.log('🔧 修复用户密码格式...');
      
      const users = await this.userRepository.find();
      const defaultPasswords: { [key: string]: string } = {
        'admin': 'admin123',
        'test_user': 'test123',
        'pusher': 'pusher123',
        'guest': 'guest123'
      };

      let fixedCount = 0;
      for (const user of users) {
        const defaultPassword = defaultPasswords[user.username];
        if (defaultPassword) {
          // 检查密码是否已经是bcrypt格式
          const isBcryptHash = user.password.startsWith('$2');
          
          if (!isBcryptHash) {
            console.log(`🔄 重新加密密码: ${user.username}`);
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            user.password = hashedPassword;
            await this.userRepository.save(user);
            console.log(`✅ 密码已更新: ${user.username}`);
            fixedCount++;
          } else {
            console.log(`✅ 密码格式正确: ${user.username}`);
          }
        }
      }

      console.log(`✅ 密码修复完成，共修复 ${fixedCount} 个用户`);
      
    } catch (error: any) {
      console.error('❌ 修复密码失败:', error.message);
      throw error;
    }
  }

  async close() {
    if (this.connection && this.connection.isInitialized) {
      await this.connection.destroy();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const userManager = new UserManager();
  
  try {
    await userManager.initialize();

    switch (command) {
      case 'create':
        const username = args[1];
        const password = args[2];
        const typeStr = args[3] || 'normal';
        
        if (!username || !password) {
          console.log('❌ 用法: npm run user:create <用户名> <密码> [类型]');
          console.log('   类型: admin, normal, guest (默认: normal)');
          break;
        }
        
        // 转换类型字符串为枚举
        let type: UserType;
        switch (typeStr.toLowerCase()) {
          case 'admin':
            type = UserType.ADMIN;
            break;
          case 'guest':
            type = UserType.GUEST;
            break;
          default:
            type = UserType.NORMAL;
        }
        
        await userManager.createUser(username, password, type);
        break;

      case 'list':
        await userManager.listUsers();
        break;

      case 'delete':
        const deleteUsername = args[1];
        if (!deleteUsername) {
          console.log('❌ 用法: npm run user:delete <用户名>');
          break;
        }
        await userManager.deleteUser(deleteUsername);
        break;

      case 'enable':
        const enableUsername = args[1];
        if (!enableUsername) {
          console.log('❌ 用法: npm run user:enable <用户名>');
          break;
        }
        await userManager.updateUserStatus(enableUsername, true);
        break;

      case 'disable':
        const disableUsername = args[1];
        if (!disableUsername) {
          console.log('❌ 用法: npm run user:disable <用户名>');
          break;
        }
        await userManager.updateUserStatus(disableUsername, false);
        break;

      case 'init':
        await userManager.createTestUsers();
        break;

      case 'test':
        await userManager.testConnection();
        break;

      case 'fix':
        await userManager.fixPasswords();
        break;

      default:
        console.log('🎯 MEV用户管理工具');
        console.log('==================');
        console.log('');
        console.log('可用命令:');
        console.log('  npm run user:init                    - 创建测试用户');
        console.log('  npm run user:create <用户名> <密码> [类型] - 创建用户');
        console.log('  npm run user:list                    - 列出所有用户');
        console.log('  npm run user:delete <用户名>          - 删除用户');
        console.log('  npm run user:enable <用户名>          - 激活用户');
        console.log('  npm run user:disable <用户名>         - 禁用用户');
        console.log('  npm run user:test                    - 测试数据库连接');
        console.log('  npm run user:fix                     - 修复密码格式');
        console.log('');
        console.log('用户类型: admin, normal, guest');
        console.log('');
        console.log('示例:');
        console.log('  npm run user:create testuser pass123 admin');
        console.log('  npm run user:list');
        console.log('  npm run user:delete testuser');
        console.log('');
        console.log('故障排除:');
        console.log('  npm run user:test  # 测试数据库连接');
        console.log('  npm run user:fix   # 修复密码格式');
        break;
    }

  } catch (error: any) {
    console.error('❌ 操作失败:', error.message);
    console.log('\n💡 故障排除建议:');
    console.log('1. 检查数据库文件权限');
    console.log('2. 确保数据目录存在');
    console.log('3. 运行 npm run user:test 测试连接');
    console.log('4. 运行 npm run user:fix 修复密码');
    console.log('5. 检查 TypeScript 配置');
    process.exit(1);
  } finally {
    await userManager.close();
  }
}

// 检查是否直接运行
if (require.main === module) {
  main();
}

export { UserManager };