# 部署配置说明

## 一键部署（推荐）

项目根目录新增脚本：`scripts/deploy.sh`

```bash
# 首次部署（安装依赖 + 构建 + 发布前端 + 启动后端 + 健康检查）
# 默认 443 端口，默认启用 TLS
SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem \
SSL_KEY_PATH=/etc/ssl/private/cf-origin.key \
./scripts/deploy.sh

# 跳过依赖安装
SKIP_INSTALL=1 ./scripts/deploy.sh

# 自定义前端静态目录
FRONTEND_DIST_DIR=/var/www/your_site ./scripts/deploy.sh

# Cloudflare Origin Certificate 常见健康检查（证书非公网 CA，默认用 -k）
HEALTH_HOST=127.0.0.1 \
SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem \
SSL_KEY_PATH=/etc/ssl/private/cf-origin.key \
./scripts/deploy.sh
```

脚本行为：
1. 安装前后端依赖（默认）
2. 构建前端与后端
3. 将前端 `dist` 发布到 `FRONTEND_DIST_DIR`（默认 `/var/www/mev_dashboard`）
4. 使用 PM2 重载/启动后端（若本机安装了 PM2）
5. 自动执行健康检查

## Cloudflare SSL 证书

如果你要使用 Cloudflare SSL，请使用 **Cloudflare Origin Certificate**（不是 Edge 证书）。

### 1. 生成 Origin Certificate
1. 登录 Cloudflare 控制台
2. 进入 `SSL/TLS` -> `Origin Server`
3. 点击 `Create Certificate`
4. 将证书和私钥保存到服务器，例如：
   - `/etc/ssl/certs/cf-origin.pem`
   - `/etc/ssl/private/cf-origin.key`

### 2. 启动方式

```bash
SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem \
SSL_KEY_PATH=/etc/ssl/private/cf-origin.key \
SERVER_PORT=443 \
./scripts/deploy.sh
```

### 3. Cloudflare 模式
在 Cloudflare 中将 SSL 模式设置为 `Full (strict)`。

### 4. 后端环境变量
- `ENABLE_HTTPS=1`（脚本会自动设置）
- `SSL_CERT_PATH`
- `SSL_KEY_PATH`

## API 地址配置

### 方案一：使用环境变量（推荐）

#### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 开发环境
VITE_API_BASE_URL=http://localhost:3000

# 测试环境
# VITE_API_BASE_URL=http://test-server:3000

# 生产环境
# VITE_API_BASE_URL=https://your-domain.com:3000
# 或者如果 API 服务器在 80/443 端口：
# VITE_API_BASE_URL=https://your-domain.com
```

#### 2. 不同环境的配置示例

**开发环境：**
```bash
VITE_API_BASE_URL=http://localhost:3000
```

**部署到服务器（API 在3000端口）：**
```bash
VITE_API_BASE_URL=http://your-server-ip:3000
# 或者使用域名
VITE_API_BASE_URL=https://your-domain.com:3000
```

**API 和前端在同一服务器的不同端口：**
```bash
VITE_API_BASE_URL=http://your-server-ip:3000
```

**使用 Nginx 反向代理（推荐）：**
```bash
VITE_API_BASE_URL=https://your-domain.com/api
```

### 方案二：动态配置（自动）

如果不设置环境变量，系统会自动：

1. **开发环境**：使用 `http://localhost:3000`
2. **生产环境**：使用当前域名 + `:3000` 端口

例如：
- 访问地址：`https://example.com`
- API 地址：`https://example.com:3000`

## 部署场景

### 场景1：前后端同服务器不同端口

- 前端：`http://your-server:80` 或 `https://your-server:443`
- 后端：`http://your-server:3000`

配置：
```bash
VITE_API_BASE_URL=http://your-server:3000
# 或使用 HTTPS
VITE_API_BASE_URL=https://your-server:3000
```

### 场景2：使用 Nginx 反向代理（推荐）

Nginx 配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

前端配置：
```bash
VITE_API_BASE_URL=https://your-domain.com
```

### 场景3：Docker 部署

Docker Compose 示例：
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_API_BASE_URL=http://backend:3000
    depends_on:
      - backend

  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```

### 场景4：云服务部署

如果使用云服务（如 AWS、阿里云等），可以：

1. **内网通信**：
```bash
VITE_API_BASE_URL=http://内网IP:3000
```

2. **公网访问**：
```bash
VITE_API_BASE_URL=https://api.your-domain.com
```

## 构建和部署

### 1. 构建前端

```bash
# 设置环境变量后构建
npm run build
```

### 2. 部署步骤

1. 将构建好的 `dist` 目录上传到服务器
2. 配置 Web 服务器（Nginx/Apache）
3. 确保 API 服务器正在运行
4. 测试前后端连接

### 3. 验证部署

访问以下地址验证：
- 前端页面：`http://your-domain.com`
- API 健康检查：`http://your-domain.com:3000/health`
- WebSocket 连接：检查浏览器控制台是否有连接成功日志

## 常见问题

### 1. CORS 跨域问题

如果遇到跨域问题，检查后端 CORS 配置：

```typescript
// server/src/config/plugins.ts
await fastify.register(cors, {
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://your-domain.com',  // 添加你的域名
    // 或者使用动态配置
    /^https?:\/\/.*\.your-domain\.com$/
  ],
  credentials: true
});
```

### 2. WebSocket 连接失败

检查：
1. 防火墙是否开放相应端口
2. WebSocket 代理配置是否正确
3. 浏览器控制台的错误信息

### 3. API 请求失败

检查：
1. API 服务器是否正在运行
2. 端口是否正确
3. 防火墙设置
4. 网络连接

## 推荐配置

**生产环境推荐使用 Nginx 反向代理方案**：

优点：
- 统一域名，避免跨域问题
- 更好的安全性
- 负载均衡和缓存能力
- SSL 终止

配置文件位置：
- 环境变量：`.env.local`
- Nginx 配置：`/etc/nginx/sites-available/your-site`
- 后端配置：`server/src/config/` 
