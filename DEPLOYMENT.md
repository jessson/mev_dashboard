# 部署说明

本文档只描述当前仓库实际使用的部署方式。

## 当前部署拓扑

生产环境使用两个 Node 进程：

1. `mev-api`
   - 运行后端 Fastify 服务
   - 默认监听 `0.0.0.0:3000`
   - 允许外部访问，但依赖 `ufw` 规则限制来源 IP

2. `mev-web`
   - 运行 [gateway.mjs](/Users/luffy/project/mev_dashboard/scripts/gateway.mjs)
   - 使用 Cloudflare Origin Certificate 提供 HTTPS
   - 默认监听 `8443`
   - 托管前端静态文件
   - 反代：
     - `/api/*`
     - `/socket.io/*`

## 脚本职责

当前工程拆分为两个正式脚本：

- [deploy.sh](/Users/luffy/project/mev_dashboard/scripts/deploy.sh)
  - 安装系统依赖
  - 安装 Node.js 20 与 npm（仅 Debian/Ubuntu 且本机缺失时）
  - 安装前后端 npm 依赖
  - 安装 pm2（若缺失）
  - 构建前后端
  - 发布前端静态文件
  - 写入运行配置到 `.env`
  - 配置 `ufw`
  - 不启动服务

- [start.sh](/Users/luffy/project/mev_dashboard/scripts/start.sh)
  - 读取根目录 `.env` 与 `server/.env`
  - 使用 PM2 启动或重载：
    - `mev-api`
    - `mev-web`
  - 执行健康检查

## 部署产出的环境文件

部署脚本会自动写入两个环境文件：

1. 根目录 `.env`
   - `FRONTEND_DIST_DIR`
   - `WEB_HOST`
   - `WEB_PORT`
   - `API_HOST`
   - `API_PORT`
   - `API_PROXY_HOST`
   - `SSL_CERT_PATH`
   - `SSL_KEY_PATH`
   - `ALLOW_API_IPS`
   - `SSH_PORT`
   - `PM2_API_NAME`
   - `PM2_WEB_NAME`

2. 后端 `server/.env`
   - `PORT`
   - `HOST`
   - `NODE_ENV`
   - `DATABASE_PATH`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS`
   - `WRITE_API_ALLOWED_ROLES`
   - `SYNCHRONIZE_DB`
   - `LOG_LEVEL`

如果这两个文件已存在，`deploy.sh` 会把它们当作默认值来源；命令行传入的环境变量仍然可以覆盖。

## 默认端口

- Web HTTPS: `8443`
- API: `3000`
- SSH: `22`

## 必需输入

首次部署至少需要准备：

- Cloudflare Origin Certificate `.pem`
- Cloudflare Origin Key `.key`
- 强随机 `JWT_SECRET`
- 允许访问 `3000` 的白名单 IP 或 CIDR

如果你没有通过环境变量传入下面这些值，脚本会交互提示：

- `SSL_CERT_PATH`
- `SSL_KEY_PATH`
- `JWT_SECRET`
- `ALLOW_API_IPS`（当 `CONFIGURE_UFW=1` 时）

## 推荐部署流程

### 1. 执行部署准备

最简命令：

```bash
./scripts/deploy.sh
```

显式传入常用参数：

```bash
SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem \
SSL_KEY_PATH=/etc/ssl/private/cf-origin.key \
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32,5.6.7.0/24' \
./scripts/deploy.sh
```

部署脚本会完成：

- 系统依赖安装
- Node/npm 检查与安装
- 前后端 npm 依赖安装
- 前后端构建
- 前端静态资源发布
- `.env` 写入
- `ufw` 配置

### 2. 启动服务

```bash
./scripts/start.sh
```

启动脚本会读取刚刚写入的 `.env`，然后通过 PM2 启动：

- `mev-api`
- `mev-web`

## 可选参数

### 跳过依赖安装

```bash
SKIP_INSTALL=1 ./scripts/deploy.sh
```

### 自定义前端发布目录

```bash
FRONTEND_DIST_DIR=/var/www/mev_dashboard ./scripts/deploy.sh
```

### 跳过 UFW 配置

```bash
CONFIGURE_UFW=0 ./scripts/deploy.sh
```

### 初始化默认用户

```bash
RUN_USER_INIT=1 ./scripts/deploy.sh
```

## Cloudflare 配置

请使用 Cloudflare Origin Certificate，而不是浏览器侧证书。

推荐设置：

- SSL/TLS 模式：`Full (strict)`
- 域名指向你的服务器
- 访问地址：`https://your-domain:8443`

## 前端构建方式

部署脚本会自动使用：

```bash
VITE_API_SAME_ORIGIN=1
```

这意味着前端不会直接请求 `https://domain:3000`，而是通过 `8443` 上的网关同源访问：

- `https://your-domain:8443/api/...`
- `https://your-domain:8443/socket.io/...`

## 防火墙说明

部署脚本内部调用：

- [firewall-ufw.sh](/Users/luffy/project/mev_dashboard/scripts/firewall-ufw.sh)

目标规则：

- `22/tcp` 开放
- `8443/tcp` 开放
- `3000/tcp` 仅允许：
  - `ALLOW_API_IPS` 指定的外部地址
  - 本机回环访问

这意味着 `3000` 会对外监听，但只有白名单来源 IP 可以访问。

## 首次部署后需要做的事

### 1. 创建管理员用户

后端不会自动创建默认管理员。

```bash
cd server
npx tsx scripts/user-manager.ts create admin your-password admin
```

### 2. 验证服务

```bash
curl http://127.0.0.1:3000/api/health
curl -k https://127.0.0.1:8443/api/health
pm2 list
sudo ufw status verbose
```

### 3. 验证外部访问

- 浏览器访问：`https://your-domain:8443`
- 白名单机器访问：`http://your-server:3000/api/health`
- 非白名单机器访问 `3000` 应被 `ufw` 拒绝

## 说明

当前工程实际维护的生产入口只有：

- [deploy.sh](/Users/luffy/project/mev_dashboard/scripts/deploy.sh)
- [start.sh](/Users/luffy/project/mev_dashboard/scripts/start.sh)
- [gateway.mjs](/Users/luffy/project/mev_dashboard/scripts/gateway.mjs)
- [firewall-ufw.sh](/Users/luffy/project/mev_dashboard/scripts/firewall-ufw.sh)

如果后续新增新的官方部署方式，再单独补充文档。
