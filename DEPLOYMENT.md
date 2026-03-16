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
   - 托管前端 `dist`
   - 反代：
     - `/api/*`
     - `/socket.io/*`

## 一键部署脚本

入口脚本：

- [deploy.sh](/Users/luffy/project/mev_dashboard/scripts/deploy.sh)

脚本会做这些事情：

1. 在 Debian/Ubuntu 系统上自动安装系统依赖：
   - `curl`
   - `ca-certificates`
   - `build-essential`
   - `python3`
   - `make`
   - `g++`
   - `sqlite3`
   - `libsqlite3-dev`
   - `ufw`
2. 安装前后端 Node 依赖
3. 如果系统没有 `pm2`，自动安装 `pm2`
4. 构建前端
5. 构建后端
6. 发布前端静态资源到 `FRONTEND_DIST_DIR`
7. 启动或重载：
   - `mev-api`
   - `mev-web`
8. 配置防火墙：
   - 放行 `22/tcp`
   - 放行 `8443/tcp`
   - `3000/tcp` 仅允许你指定的 `ALLOW_API_IPS`
9. 执行健康检查

## 默认端口

- Web HTTPS: `8443`
- API: `3000`
- SSH: `22`

## 必需输入

部署时至少需要准备：

- Cloudflare Origin Certificate `.pem`
- Cloudflare Origin Key `.key`
- 强随机 `JWT_SECRET`
- 允许访问 `3000` 的白名单 IP 或 CIDR

说明：

- 如果系统是 Debian/Ubuntu，脚本会自动安装 `sqlite3` 和构建依赖
- 如果系统不是 apt 系发行版，脚本会跳过系统包安装，只继续执行 Node 依赖安装

如果你不通过环境变量传入：

- `SSL_CERT_PATH`
- `SSL_KEY_PATH`
- `ALLOW_API_IPS`

脚本会在执行时交互提示输入。

## 推荐部署命令

```bash
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32,5.6.7.0/24' \
./scripts/deploy.sh
```

如果你想显式提供证书路径：

```bash
SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem \
SSL_KEY_PATH=/etc/ssl/private/cf-origin.key \
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32,5.6.7.0/24' \
./scripts/deploy.sh
```

跳过依赖安装：

```bash
SKIP_INSTALL=1 \
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32' \
./scripts/deploy.sh
```

自定义前端发布目录：

```bash
FRONTEND_DIST_DIR=/var/www/mev_dashboard \
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32' \
./scripts/deploy.sh
```

## Cloudflare 配置

请使用 Cloudflare 的 Origin Certificate，而不是浏览器侧证书。

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

执行结果目标是：

- `22/tcp` 开放
- `8443/tcp` 开放
- `3000/tcp` 仅允许：
  - `ALLOW_API_IPS` 指定的外部地址

如果你不想让脚本配置 `ufw`：

```bash
CONFIGURE_UFW=0 \
JWT_SECRET='replace-with-a-strong-secret' \
ALLOW_API_IPS='1.2.3.4/32' \
./scripts/deploy.sh
```

## 关键环境变量

### 部署脚本

- `JWT_SECRET`
- `ALLOW_API_IPS`
- `SSL_CERT_PATH`
- `SSL_KEY_PATH`
- `FRONTEND_DIST_DIR`
- `WEB_HOST`
- `WEB_PORT`
- `API_HOST`
- `API_PORT`
- `API_PROXY_HOST`
- `SSH_PORT`
- `CONFIGURE_UFW`
- `SKIP_INSTALL`

### 后端

- `PORT`
- `HOST`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `WRITE_API_ALLOWED_ROLES`
- `SYNCHRONIZE_DB`
- `DATABASE_PATH`
- `LOG_LEVEL`

当前脚本默认传入：

- `WRITE_API_ALLOWED_ROLES=admin`
- `SYNCHRONIZE_DB=0`

## 首次部署后需要做的事

### 1. 创建管理员用户

后端不会自动创建默认管理员。

```bash
cd server
npx tsx scripts/user-manager.ts create admin your-password admin
```

### 2. 验证服务

检查：

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
- [gateway.mjs](/Users/luffy/project/mev_dashboard/scripts/gateway.mjs)
- [firewall-ufw.sh](/Users/luffy/project/mev_dashboard/scripts/firewall-ufw.sh)

如果后续新增新的官方部署方式，再单独补充文档。
