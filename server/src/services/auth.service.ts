import { TypeormConnection } from '../config/database';
import { User, UserType } from '../entities/User';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { logger } from '../utils/logger';

export class AuthService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = TypeormConnection.getRepository(User);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { username, isActive: true }
      });

      if (!user) {
        logger.warn(`用户不存在或已禁用: ${username}`);
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`密码错误: ${username}`);
        return null;
      }

      logger.info(`用户登录成功: ${username}`);
      return user;
    } catch (error) {
      logger.error(`验证用户失败: ${error}`);
      return null;
    }
  }

  async createUser(username: string, password: string, type: UserType = UserType.NORMAL): Promise<User> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { username }
      });

      if (existingUser) {
        throw new Error('用户名已存在');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = this.userRepository.create({
        username,
        password: hashedPassword,
        type,
        isActive: true
      });

      const savedUser = await this.userRepository.save(user);
      logger.info(`创建用户成功: ${username} (${type})`);
      return savedUser;
    } catch (error) {
      logger.error(`创建用户失败: ${username}`, error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      return await this.userRepository.findOne({
        where: { id, isActive: true }
      });
    } catch (error) {
      logger.error(`获取用户失败: ${error}`);
      return null;
    }
  }

  async initializeDefaultUsers(): Promise<void> {
    try {
      // 检查数据库连接
      if (!TypeormConnection.isInitialized) {
        logger.warn(`数据库连接未初始化，跳过用户初始化`);
        return;
      }

      // 检查是否已有用户
      const userCount = await this.userRepository.count();
      if (userCount > 0) {
        logger.info(`数据库中已有 ${userCount} 个用户，跳过初始化`);
        return;
      }

    } catch (error) {
      logger.error(`初始化默认用户失败: ${error}`);
    }
  }

  async listUsers(): Promise<User[]> {
    try {
      return await this.userRepository.find({
        select: ['id', 'username', 'type', 'isActive', 'createdAt']
      });
    } catch (error) {
      logger.error(`获取用户列表失败: ${error}`);
      return [];
    }
  }
}