# MEV Dashboard

一个基于 `React + Vite + Mantine + Fastify + SQLite` 的 MEV 监控系统。

当前工程已经重构为标准 dashboard 结构：

- 前端使用 `React Router + TanStack Query + Mantine AppShell`
- 后端使用 `Fastify + Socket.IO + TypeORM`
- 生产部署使用项目自带的 `Node HTTPS 网关 + API 服务` 双进程模式

## 目录结构

```text
mev_dashboard/
├── src/                      # 前端
│   ├── components/           # 复用组件
│   ├── context/              # 认证与控制台数据上下文
│   ├── hooks/                # 前端 hooks
│   ├── layouts/              # Dashboard 布局壳
│   ├── pages/                # overview / trades / warnings / chains / nodes
│   ├── services/             # 前端 API 服务
│   └── types/                # 前端类型
├── server/                   # 后端
│   ├── src/config/           # Fastify / DB / route 注册
│   ├── src/entities/         # TypeORM 实体
│   ├── src/routes/           # API 路由
│   ├── src/services/         # 业务服务与 Socket.IO
│   ├── src/utils/            # 后端工具与安全逻辑
│   └── scripts/              # 用户、日志、数据相关脚本
├── scripts/deploy.sh         # 一键部署准备脚本（安装/构建/写入 .env）
├── scripts/start.sh          # 生产启动脚本（PM2 拉起 mev-api / mev-web）
├── scripts/gateway.mjs       # HTTPS 网关，托管前端并反代 /api 与 /socket.io
├── scripts/firewall-ufw.sh   # UFW 规则脚本
└── DEPLOYMENT.md             # 生产部署说明
```

## 功能

- 登录认证
- 欢迎页实时统计
- Dashboard 总览
- 交易实时流与历史搜索
- 预警管理
- 链配置管理
- 节点状态监控
- Socket.IO 实时推送

## 本地开发

### 环境要求

- Node.js 18+
- npm

### 1. 安装依赖

```bash
npm install
cd server && npm install
```

### 2. 启动后端

```bash
cd server
npm run dev
```

默认后端地址：

- `http://127.0.0.1:3000`

### 3. 启动前端

```bash
npm run dev
```

默认前端地址：

- `http://127.0.0.1:5173`

开发环境下前端会直接请求 `http://localhost:3000`。

## 生产运行方式

当前工程只有一套正式维护的生产方案：

- `scripts/deploy.sh` 负责安装系统依赖、Node 依赖、构建产物、发布前端并写入 `.env`
- `scripts/start.sh` 负责启动 `mev-api` 和 `mev-web`
- `mev-web` 使用 Cloudflare Origin Certificate 监听 `8443`
- `mev-web` 托管前端静态文件，并反代：
  - `/api/*`
  - `/socket.io/*`
- `mev-api` 监听 `0.0.0.0:3000`
- `ufw` 控制 `3000` 的外部白名单访问
- 在 Debian/Ubuntu 系统上，部署脚本会自动安装系统依赖，包括 `sqlite3`、`libsqlite3-dev`、编译工具链、`ufw`，以及缺失时的 `Node.js 20 + npm`

详细步骤见 [DEPLOYMENT.md](/Users/luffy/project/mev_dashboard/DEPLOYMENT.md)。

## 常用脚本

### 前端

```bash
npm run dev
npm run build
npm run preview
```

### 后端

```bash
cd server
npm run dev
npm run build
npm start
```

### 生产部署

```bash
./scripts/deploy.sh
./scripts/start.sh
```

### 用户管理

后端不会自动创建默认管理员。需要手动创建用户。

```bash
cd server
npx tsx scripts/user-manager.ts create admin your-password admin
```

常用命令：

```bash
cd server
npx tsx scripts/user-manager.ts list
npx tsx scripts/user-manager.ts create <username> <password> [admin|normal|guest]
npx tsx scripts/user-manager.ts enable <username>
npx tsx scripts/user-manager.ts disable <username>
npx tsx scripts/user-manager.ts delete <username>
```

## 关键接口

### 公开接口

- `GET /api/health`
- `GET /api/welcome`
- `POST /api/login`

### 需要登录的主要接口

- `GET /api/history`
- `GET /api/trade/search`
- `GET /api/profit`
- `GET /api/tag/daily-profit`
- `GET /api/token/stats`
- `GET /api/node/status`

### 需要写权限角色的接口

默认只允许 `admin`，可通过 `WRITE_API_ALLOWED_ROLES` 覆盖。

- `POST /api/trade`
- `POST /api/warning`
- `POST /api/node/status/:chain`
- `POST /api/node/offline/:chain`

## 环境变量

### 前端构建相关

- `VITE_API_BASE_URL`
- `VITE_API_SAME_ORIGIN`

生产部署脚本默认使用：

```bash
VITE_API_SAME_ORIGIN=1
```

### 后端相关

- `PORT`
- `HOST`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `WRITE_API_ALLOWED_ROLES`
- `SYNCHRONIZE_DB`
- `DATABASE_PATH`
- `LOG_LEVEL`

### HTTPS 网关相关

- `FRONTEND_DIST_DIR`
- `WEB_HOST`
- `WEB_PORT`
- `SSL_CERT_PATH`
- `SSL_KEY_PATH`

生产部署时会自动写入：

- 根目录 `.env`
- 后端 `server/.env`

## 验证

执行 `./scripts/deploy.sh` 后，服务不会自动启动；继续执行 `./scripts/start.sh` 后，可检查：

- 前端入口：`https://your-domain:8443`
- API 健康检查：`http://your-server:3000/api/health`
- 网关健康检查：`https://your-domain:8443/api/health`

## 免责声明

本项目仅用于学习、研究和内部监控场景。请在理解链上风险、接口权限和部署暴露面的前提下使用。
