# MEV监控系统后端

基于Fastify + TypeORM + Socket.io构建的高性能MEV交易监控系统后端。

## 技术栈

- **Fastify** - 高性能Node.js Web框架
- **TypeORM** - TypeScript ORM
- **SQLite** - 轻量级数据库
- **Socket.io** - 实时通信
- **JWT** - 身份认证
- **Zod** - 数据验证
- **Pino** - 高性能日志

## 功能特性

- ✅ 高性能API服务
- ✅ 实时WebSocket通信
- ✅ JWT身份认证
- ✅ 数据库ORM映射
- ✅ 自动API文档生成
- ✅ 请求限流保护
- ✅ 数据验证
- ✅ 定时任务调度
- ✅ 结构化日志
- ✅ 优雅关闭

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

```bash
cp .env.example .env
# 编辑 .env 文件配置相关参数
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
npm start
```

## API文档

开发模式下访问 `http://localhost:3000/docs` 查看Swagger API文档。

## 项目结构

```
src/
├── config/          # 配置文件
├── entities/        # 数据库实体
├── routes/          # 路由定义
├── services/        # 业务逻辑
├── types/           # 类型定义
├── utils/           # 工具函数
└── index.ts         # 应用入口
```

## 主要改进

### 1. 框架升级
- 从Express迁移到Fastify，性能提升2-3倍
- 内置TypeScript支持
- 更好的插件生态系统

### 2. 数据库优化
- 使用TypeORM替代原生SQL
- 实体关系映射
- 自动迁移管理
- 查询构建器

### 3. 架构改进
- 分层架构设计
- 服务层抽象
- 依赖注入
- 错误处理中间件

### 4. 安全增强
- JWT认证
- 请求限流
- CORS配置
- 安全头设置

### 5. 开发体验
- 热重载开发
- 自动API文档
- 类型安全
- 结构化日志

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 3000 |
| HOST | 服务地址 | 0.0.0.0 |
| NODE_ENV | 环境模式 | development |
| DATABASE_PATH | 数据库路径 | ./data/mev.db |
| JWT_SECRET | JWT密钥 | - |
| CORS_ORIGIN | CORS源 | http://localhost:5173 |
| LOG_LEVEL | 日志级别 | info |

## 部署建议

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### PM2部署

```json
{
  "name": "mev-backend",
  "script": "dist/index.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 性能优化

1. **连接池配置** - 数据库连接池优化
2. **缓存策略** - Redis缓存热点数据
3. **索引优化** - 数据库索引优化
4. **压缩传输** - Gzip压缩响应
5. **集群部署** - 多进程负载均衡

## 监控告警

建议集成以下监控工具：
- **Prometheus** - 指标收集
- **Grafana** - 可视化监控
- **ELK Stack** - 日志分析
- **Sentry** - 错误追踪