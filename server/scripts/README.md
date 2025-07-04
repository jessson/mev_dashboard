# MEV系统测试脚本

这个目录包含了MEV监控系统的测试和管理脚本。

## 📋 脚本列表

### 1. 用户管理脚本 (`user-manager.ts`)
用于管理系统用户账户的创建、删除和状态管理。

### 2. 认证数据推送脚本 (`auth-pusher.ts`)
带认证功能的Mock数据推送器，用于测试系统功能。

### 3. 简单数据推送脚本 (`mock-pusher.ts`)
不带认证的Mock数据推送器，用于基础测试。

### 4. 数据库迁移脚本 (`migrate-database.ts`)
用于将原始后端的数据库信息迁移到重构后的数据库。

## 🚀 快速开始

### 第一步：创建测试用户
```bash
cd server
npm run user:init
```

这会创建以下测试用户：
- `admin` / `admin123` (管理员)
- `test_user` / `test123` (普通用户)
- `pusher` / `pusher123` (推送专用账户)
- `guest` / `guest123` (访客)

### 第二步：启动后端服务
```bash
npm run dev
```

### 第三步：启动数据推送
```bash
# 认证模式推送（推荐）
npm run mock:push

# WebSocket认证模式推送
npm run mock:push:ws

# 简单模式推送（无认证）
npm run mock:push:simple

# 简单WebSocket模式推送
npm run mock:push:simple:ws
```

## 📖 详细使用说明

### 用户管理命令

#### 初始化测试用户
```bash
npm run user:init
```

#### 创建新用户
```bash
npm run user:create <用户名> <密码> [类型]
```
示例：
```bash
npm run user:create newuser pass123 admin
```

#### 列出所有用户
```bash
npm run user:list
```

#### 删除用户
```bash
npm run user:delete <用户名>
```

#### 激活/禁用用户
```bash
npm run user:enable <用户名>
npm run user:disable <用户名>
```

### 数据推送命令

#### 使用默认账户推送（认证模式）
```bash
# API模式（推荐）
npm run mock:push

# WebSocket模式
npm run mock:push:ws
```

#### 使用自定义账户推送（认证模式）
```bash
# API模式
npx tsx scripts/auth-pusher.ts api <用户名> <密码>

# WebSocket模式
npx tsx scripts/auth-pusher.ts ws <用户名> <密码>
```

#### 简单推送（无认证）
```bash
# API模式
npm run mock:push:simple

# WebSocket模式
npm run mock:push:simple:ws
```

### 数据库迁移命令

#### 分析原数据库结构
```bash
npm run migrate:analyze <原数据库路径>
```
示例：
```bash
npm run migrate:analyze ./old_data/mev.db
```

#### 执行数据迁移
```bash
npm run migrate:run <原数据库路径>
```
示例：
```bash
npm run migrate:run ./old_data/mev.db
```

#### 生成迁移报告
```bash
npm run migrate:report
```

#### 使用完整路径的迁移命令
```bash
# 分析原数据库
npx tsx scripts/migrate-database.ts analyze ./path/to/old/database.db

# 执行迁移
npx tsx scripts/migrate-database.ts migrate ./path/to/old/database.db

# 生成报告
npx tsx scripts/migrate-database.ts report
```

## 🔧 配置说明

### 用户类型
- `admin`: 管理员，拥有所有权限
- `normal`: 普通用户，基本查看权限
- `guest`: 访客，受限权限

### 推送配置
在脚本中可以修改：
- `PUSH_INTERVAL`: 推送间隔（默认2秒）
- `API_BASE_URL`: 后端API地址
- `WS_URL`: WebSocket地址
- `DEFAULT_CREDENTIALS`: 默认登录凭据

### 迁移配置
- 支持自动检测原数据库表结构
- 智能处理字段映射和数据转换
- 支持增量迁移（跳过已存在记录）
- 提供详细的迁移报告

## 📊 数据类型

### 交易数据 (70%概率)
- 链信息：BSC, ETH, SOL
- 构建者：Flashbots, Eden, BloXroute等
- 收益数据：gross, bribe, income, ratio
- 标签：Arb, Backrun, Block等

### 预警数据 (20%概率)
- 高风险交易
- 网络拥堵
- 套利机会
- 异常活动
- 价格异常
- 流动性不足

### 收益数据 (10%概率)
- 今日收益统计
- 交易数量统计
- 按链分类数据

## 🔍 故障排除

### 推送失败
1. 检查后端服务是否启动
2. 确认用户账户存在且密码正确（认证模式）
3. 检查网络连接
4. 查看后端日志

### 登录失败（认证模式）
1. 运行 `npm run user:list` 检查用户是否存在
2. 确认用户状态为激活
3. 检查密码是否正确
4. 重新创建用户账户

### 数据库迁移失败
1. 确保原数据库文件存在且可读
2. 检查新数据库连接是否正常
3. 确认表结构已创建（运行 `npm run user:init`）
4. 检查磁盘空间是否充足
5. 查看详细错误信息

### TypeScript编译错误
1. 确保安装了所有依赖：`npm install`
2. 检查TypeScript版本兼容性
3. 清理并重新安装：`rm -rf node_modules && npm install`

## 📝 输出示例

### 用户管理输出
```
✅ 数据库连接成功
✅ 用户创建成功: admin (admin)
✅ 用户创建成功: pusher (admin)
✅ 测试用户创建完成
```

### 认证数据推送输出
```
🎯 MEV认证Mock数据推送器
==========================
👤 使用账户: pusher

🔐 正在登录用户: pusher
✅ 登录成功: pusher (admin)
🚀 认证Mock数据推送器启动...
📡 目标API: http://localhost:3000/api
⏱️  推送间隔: 2000ms
---
✅ 交易推送成功: BSC - $0.0797
⚠️  预警推送成功: ETH - 网络拥堵
✅ 交易推送成功: SOL - $0.0234
```

### 数据库迁移输出
```
🎯 MEV数据库迁移工具
====================
🚀 开始数据库迁移...
📂 原数据库: ./old_data/mev.db
📂 新数据库: ./data/mev.db
==================================================
✅ 原数据库连接成功
✅ 新数据库连接成功

🔄 开始迁移用户数据...
📊 找到 4 个用户记录
✅ 用户迁移成功: admin (admin)
✅ 用户迁移成功: test_user (normal)
✅ 用户迁移完成: 成功 4, 跳过 0

🔄 开始迁移交易数据...
📊 找到 1256 个交易记录
📈 已迁移 100 个交易记录...
📈 已迁移 200 个交易记录...
...
✅ 交易迁移完成: 成功 1256, 跳过 0

📊 生成迁移报告...
📈 新数据库统计:
==============================
👥 用户数量: 4
💰 交易数量: 1256
⚠️  预警数量: 23
📊 收益记录: 45
🏆 Top信息: 3
🏷️  标签收益: 67
📅 最新交易时间: 2025-01-21 21:14:19

🔗 链分布:
  BSC: 678 笔交易
  ETH: 345 笔交易
  SOL: 233 笔交易

🎉 数据库迁移完成！
```

## 🔒 安全注意事项

1. **测试环境专用**：这些脚本仅用于开发和测试环境
2. **密码安全**：生产环境请使用强密码
3. **权限控制**：合理分配用户权限
4. **数据备份**：迁移前务必备份原数据库
5. **数据清理**：定期清理测试数据

## 🆘 获取帮助

如果遇到问题，可以：
1. 查看后端服务日志
2. 检查数据库状态
3. 验证网络连接
4. 重新初始化测试环境
5. 使用分析命令检查原数据库结构

## 🔄 脚本对比

| 脚本 | 认证 | 用途 | 推荐场景 |
|------|------|------|----------|
| `auth-pusher.ts` | ✅ | 完整功能测试 | 生产环境模拟 |
| `mock-pusher.ts` | ❌ | 基础功能测试 | 开发调试 |
| `user-manager.ts` | N/A | 用户管理 | 账户维护 |
| `migrate-database.ts` | N/A | 数据迁移 | 系统升级 |

## 📋 迁移注意事项

### 迁移前准备
1. **备份原数据库**：`cp old_mev.db old_mev.db.backup`
2. **确认新数据库表结构**：运行 `npm run user:init`
3. **检查磁盘空间**：确保有足够空间存储迁移数据
4. **停止相关服务**：避免数据冲突

### 迁移过程
1. **先分析**：使用 `analyze` 命令了解原数据库结构
2. **小批量测试**：可以修改脚本限制迁移数量进行测试
3. **监控进度**：观察迁移过程中的输出信息
4. **处理错误**：记录并处理迁移过程中的错误

### 迁移后验证
1. **检查数据完整性**：使用 `report` 命令生成统计报告
2. **功能测试**：启动系统进行基本功能测试
3. **性能测试**：检查迁移后的系统性能
4. **数据一致性**：对比关键数据的一致性

# PM2日志管理脚本

本目录包含了完整的PM2日志轮转和管理脚本。

## 📁 脚本文件

- `setup-logrotate.sh` - PM2 logrotate安装配置脚本
- `manage-logs.sh` - 日志管理维护脚本

## 🚀 快速开始

### 1. 设置脚本权限

```bash
chmod +x server/scripts/*.sh
```

### 2. 安装配置logrotate

```bash
./server/scripts/setup-logrotate.sh
```

脚本会引导你选择环境配置：
- **开发环境**: 5M文件，保留7天，无压缩
- **测试环境**: 10M文件，保留14天，压缩
- **生产环境**: 50M文件，保留30天，压缩
- **高负载环境**: 100M文件，保留60天，压缩
- **自定义配置**: 自定义所有参数

### 3. 管理日志文件

```bash
# 查看帮助
./server/scripts/manage-logs.sh help

# 查看日志状态
./server/scripts/manage-logs.sh status

# 查看日志大小
./server/scripts/manage-logs.sh size

# 强制轮转日志
./server/scripts/manage-logs.sh rotate

# 清空日志
./server/scripts/manage-logs.sh clean

# 实时监控
./server/scripts/manage-logs.sh monitor
```

## 📋 详细功能

### setup-logrotate.sh

**功能:**
- ✅ 自动检查PM2安装状态
- ✅ 安装pm2-logrotate模块
- ✅ 提供5种预设配置环境
- ✅ 支持完全自定义配置
- ✅ 自动验证安装结果
- ✅ 创建必要的日志目录
- ✅ 重启相关PM2进程

**配置选项:**
- 单个日志文件最大大小
- 历史日志保留数量
- 是否压缩旧日志文件
- 日志轮转时间（cron格式）
- 日志文件命名格式

### manage-logs.sh

**功能:**

| 命令 | 功能 | 说明 |
|------|------|------|
| `status` | 显示状态 | PM2进程、logrotate模块、日志文件状态 |
| `size` | 显示大小 | 日志目录和文件大小统计 |
| `config` | 显示配置 | 当前logrotate配置参数 |
| `rotate` | 强制轮转 | 立即执行日志轮转 |
| `clean` | 清空日志 | 清空所有当前日志文件 |
| `archive` | 手动归档 | 压缩归档现有日志 |
| `monitor` | 实时监控 | 实时显示日志大小变化 |
| `backup` | 备份日志 | 创建日志文件备份 |
| `restore` | 恢复备份 | 从备份恢复日志文件 |

## 🔧 手动配置

如果需要手动配置，可以使用以下命令：

```bash
# 安装模块
pm2 install pm2-logrotate

# 配置参数
pm2 set pm2-logrotate:max_size 50M           # 最大文件大小
pm2 set pm2-logrotate:retain 30              # 保留文件数量
pm2 set pm2-logrotate:compress true          # 压缩旧文件
pm2 set pm2-logrotate:rotateInterval '0 2 * * *'  # 轮转时间
pm2 set pm2-logrotate:dateFormat 'YYYY-MM-DD_HH-mm-ss'  # 时间格式

# 查看配置
pm2 conf pm2-logrotate

# 重启应用
pm2 restart mev-server
```

## 📊 监控命令

```bash
# 查看日志
pm2 logs mev-server

# 查看最后100行
pm2 logs mev-server --lines 100

# 实时查看错误日志
pm2 logs mev-server --err

# 清空所有日志
pm2 flush

# 重新加载日志
pm2 reloadLogs

# 强制轮转
pm2 trigger pm2-logrotate rotate
```

## 📁 日志文件位置

```
server/logs/
├── err.log         # 错误日志
├── out.log         # 输出日志
├── combined.log    # 合并日志
└── archive/        # 归档目录
    └── 20231201_120000/
        ├── err.log.gz
        ├── out.log.gz
        └── combined.log.gz
```

## 🚨 故障排除

### 问题1: pm2-logrotate安装失败
```bash
# 清理PM2模块缓存
pm2 kill
pm2 uninstall pm2-logrotate
pm2 install pm2-logrotate
```

### 问题2: 日志轮转不工作
```bash
# 检查模块状态
pm2 list | grep logrotate

# 检查配置
pm2 conf pm2-logrotate

# 手动触发轮转
pm2 trigger pm2-logrotate rotate
```

### 问题3: 日志文件过大
```bash
# 立即清空
pm2 flush

# 或手动归档
./server/scripts/manage-logs.sh archive
```

## 🔄 定期维护

建议设置定期维护计划：

```bash
# 添加到crontab
# 每天检查日志大小
0 9 * * * cd /path/to/project && ./server/scripts/manage-logs.sh size

# 每周备份日志
0 2 * * 0 cd /path/to/project && ./server/scripts/manage-logs.sh backup

# 每月清理旧备份
0 3 1 * * find /path/to/project/backups/logs -name "*.tar.gz" -mtime +90 -delete
```

## 📞 支持

如果遇到问题，请检查：
1. PM2是否正确安装
2. Node.js版本是否兼容
3. 脚本是否有执行权限
4. 日志目录是否有写权限

更多信息请参考: [PM2官方文档](https://pm2.keymetrics.io/)