# MEV Dashboard - MEV交易监控系统

一个基于React + TypeScript + Fastify的MEV交易监控与分析系统，提供实时交易监控、收益分析、预警管理等功能。

## 📁 项目架构

```
jojo/
├── src/                          # 前端源代码
│   ├── components/               # React组件
│   │   ├── Dashboard.tsx         # 主仪表板
│   │   ├── LoginPage.tsx         # 登录页面
│   │   ├── WelcomePage.tsx       # 欢迎页面
│   │   ├── ChainManager.tsx      # 链管理组件
│   │   ├── NodeStatusModal.tsx   # 节点状态弹窗
│   │   └── TradingComponents/    # 交易相关组件
│   ├── services/                 # API服务
│   ├── hooks/                    # 自定义Hook
│   ├── types/                    # 类型定义
│   └── App.tsx                   # 主应用
├── server/                       # 后端源代码
│   ├── src/
│   │   ├── index.ts             # 服务器入口
│   │   ├── entities/            # 数据库实体
│   │   │   ├── TradeInfo.ts     # 交易信息实体
│   │   │   ├── ChainConfig.ts   # 链配置实体
│   │   │   └── User.ts          # 用户实体
│   │   ├── routes/              # 路由定义
│   │   │   ├── trade.routes.ts  # 交易路由
│   │   │   ├── auth.routes.ts   # 认证路由
│   │   │   ├── chain.routes.ts  # 链管理路由
│   │   │   ├── warning.routes.ts # 预警路由
│   │   │   ├── profit.routes.ts # 收益路由
│   │   │   ├── token.routes.ts  # 代币路由
│   │   │   ├── tag.routes.ts    # 标签路由
│   │   │   └── node.routes.ts   # 节点路由
│   │   ├── services/            # 业务逻辑服务
│   │   │   ├── cache.service.ts # 缓存服务
│   │   │   ├── scheduler.service.ts # 调度服务
│   │   │   ├── websocket.service.ts # WebSocket服务
│   │   │   ├── trade.service.ts # 交易服务
│   │   │   ├── auth.service.ts  # 认证服务
│   │   │   ├── profit.service.ts # 收益服务
│   │   │   ├── token-profit.service.ts # 代币收益服务
│   │   │   ├── warning.service.ts # 预警服务
│   │   │   ├── tag.service.ts   # 标签服务
│   │   │   └── node.service.ts  # 节点服务
│   │   ├── config/              # 配置文件
│   │   ├── types/               # 类型定义
│   │   └── utils/               # 工具函数
│   ├── scripts/                 # 管理脚本
│   │   ├── user-manager.ts      # 用户管理脚本
│   │   ├── trade-manager.ts     # 交易管理脚本
│   │   └── migrate-database.ts  # 数据库迁移脚本
│   ├── data/                    # 数据文件
│   │   ├── chains.json          # 链配置
│   │   └── database.sqlite      # SQLite数据库
│   └── dist/                    # 编译输出
└── package.json                 # 项目配置
```

## 🚀 功能说明

### 🔐 用户认证
- 基于JWT的用户认证系统
- 支持admin和普通用户两种角色
- 密码加密存储

### 📊 交易监控
- **实时交易监控**：WebSocket实时推送交易数据
- **交易搜索**：支持多条件搜索历史交易
- **交易详情**：查看完整交易信息，包括套利路径、代币信息等
- **多链支持**：支持多个区块链网络的交易监控

### 💰 收益分析
- **实时收益统计**：按链统计每日收益
- **标签收益分析**：按交易标签分析收益分布
- **代币收益跟踪**：追踪各代币的收益情况
- **收益图表**：可视化收益趋势

### ⚠️ 预警系统
- **实时预警**：监控异常交易和系统状态
- **预警管理**：支持查看、删除、批量管理预警
- **分类预警**：按类型和链进行预警分类

### 🔧 系统管理
- **链管理**：动态配置支持的区块链网络
- **节点监控**：实时监控各链节点状态
- **性能监控**：CPU、内存、网络状态监控
- **数据清理**：自动清理过期数据

### 📱 移动端适配
- 响应式设计，支持移动端访问
- 移动端专用交易卡片布局
- 触摸友好的交互设计

## 🛠️ 部署说明

### 环境要求
- Node.js 18+
- SQLite3
- PM2 (可选，用于生产环境)

### 快速部署

1. **克隆项目**
```bash
git clone <repository-url>
cd mev_dashboard
```

2. **安装依赖**
```bash
# 前端依赖
npm install

# 后端依赖
cd server
npm install
```

3. **配置环境变量**
```bash
# 前端配置 (.env.local)
VITE_API_BASE_URL=http://localhost:3000

# 后端配置 (server/.env)
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secret-key
```

4. **初始化数据库**
```bash
cd server
npm run user:init
npm run user:create
```

5. **构建项目**
```bash
# 构建前端
npm run build

# 构建后端
cd server
npm run build
```

6. **启动服务**
```bash
# 启动后端
cd server
npm start

# 前端已构建到dist目录，配置Web服务器托管
```

### 生产环境部署

#### 使用PM2部署
```bash
cd server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/jojo/dist;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket代理
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📡 后端POST API说明

### 认证相关

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

### 交易数据推送

#### 创建交易记录
```http
POST /api/trade
Authorization: Bearer <token>
Content-Type: application/json

{
  "chain": "string",           // 链名称 (必填)
  "builder": "string",         // 构建者 (必填)
  "hash": "string",            // 交易哈希 (必填)
  "vicHashes": ["string"],     // 受害者交易哈希 (可选)
  "gross": 0.0,                // 总收益 (可选)
  "bribe": 0.0,                // 贿赂金额 (可选)
  "income": 0.0,               // 净收益 (可选)
  "txCount": 0,                // 交易数量 (可选)
  "ratio": 0.0,                // 收益率 (可选)
  "extraInfo": "string",       // 额外信息 (可选)
  "tags": ["string"],          // 标签列表 (可选)
  "incTokens": [{              // 收益代币列表 (可选)
    "addr": "string",          // 代币地址 (addr或address二选一)
    "address": "string",       // 代币地址 (addr或address二选一)  
    "symbol": "string"         // 代币符号 (必填)
  }]
}
```

#### 创建预警
```http
POST /api/warning
Authorization: Bearer <token>
Content-Type: application/json

{
  "chain": "string",           // 链名称 (必填)
  "type": "string",            // 预警类型 (必填)
  "msg": "string"              // 预警消息 (必填)
}
```

### 节点状态上报

#### 上报节点状态
```http
POST /api/node/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "chain": "string",           // 链名称 (必填)
  "online": true,              // 在线状态 (必填)
  "cpuUsage": 0.0
  "memoryUsage": 0.0,
  "blockTime": 0.0   // 这里指的是 blockDiffTime
}
```

### 链配置管理

#### 添加链配置
```http
POST /api/chain/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "string",              // 链ID (必填)
  "name": "string",            // 链名称 (必填)
  "displayName": "string",     // 显示名称 (必填)
  "symbol": "string",          // 代币符号 (必填)
  "color": "#000000",          // 主题色 (必填)
  "explorerUrl": {             // 区块浏览器URL (必填)
    "tx": "string",
    "address": "string"
  },
  "enabled": true,             // 是否启用 (可选)
  "order": 0                   // 显示顺序 (可选)
}
```

### 响应格式

#### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

#### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": 400
}
```

### 认证方式

所有需要认证的接口都需要在请求头中包含JWT Token：
```http
Authorization: Bearer <your-jwt-token>
```

### 限流说明

- 登录接口：每分钟最多10次请求
- 交易推送：每分钟最多2000次请求
- 查询接口：每分钟最多1000次请求
- 其他接口：每分钟最多100次请求

## 🔧 管理脚本

### 用户管理
```bash
# 初始化用户表
npm run user:init

# 创建用户
npm run user:create

# 列出用户
npm run user:list

# 删除用户
npm run user:delete

# 启用/禁用用户
npm run user:enable
npm run user:disable
```

### 交易管理
```bash
# 交易数据管理
npx tsx server/scripts/trade-manager.ts [command] [options]

# 示例：查询交易
npx tsx server/scripts/trade-manager.ts query --chain ethereum --limit 10

# 示例：删除交易
npx tsx server/scripts/trade-manager.ts delete --id 123 --dry-run
```

### 数据库管理
```bash
# 数据库迁移
npm run migrate:analyze
npm run migrate:run
npm run migrate:report
```

## ⚠️ 免责声明

### 使用声明
本软件全由AI生成
本软件仅供学习和研究目的使用，不得用于任何商业用途或违法活动。

### 风险提示
1. **投资风险**：MEV交易涉及复杂的区块链技术和市场风险，用户应充分了解相关风险。
2. **技术风险**：本系统可能存在技术缺陷或安全漏洞，使用前请充分测试。
3. **数据准确性**：系统提供的数据仅供参考，不保证数据的准确性和完整性。

### 责任限制
1. 本软件按"现状"提供，不提供任何形式的担保。
2. 作者不承担因使用本软件而产生的任何直接或间接损失。
3. 用户应自行承担使用本软件的风险和责任。

### 法律合规
1. 用户应遵守所在地区的法律法规。
2. 禁止将本软件用于任何违法或不当活动。
3. 如发现违法使用，作者保留追究法律责任的权利。

### 版权说明
本项目采用MIT许可证，允许在遵循许可证条款的前提下自由使用、修改和分发。

---

**注意**：使用本软件即表示您已阅读并同意上述免责声明。如不同意，请勿使用本软件。

*最后更新：2024年*
