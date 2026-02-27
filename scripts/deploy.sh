#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"
BACKEND_DIR="$ROOT_DIR/server"

# 可通过环境变量覆盖
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/mev_dashboard}"
SERVER_HOST="${SERVER_HOST:-0.0.0.0}"
SERVER_PORT="${SERVER_PORT:-8443}"
TLS_ENABLED="${TLS_ENABLED:-1}"
SSL_CERT_PATH="${SSL_CERT_PATH:-}"
SSL_KEY_PATH="${SSL_KEY_PATH:-}"
HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"
HEALTH_SCHEME="${HEALTH_SCHEME:-}"
if [[ -z "$HEALTH_SCHEME" ]]; then
  if [[ "$TLS_ENABLED" == "1" ]]; then
    HEALTH_SCHEME="https"
  else
    HEALTH_SCHEME="http"
  fi
fi
HEALTH_INSECURE="${HEALTH_INSECURE:-}"
if [[ -z "$HEALTH_INSECURE" ]]; then
  if [[ "$TLS_ENABLED" == "1" ]]; then
    HEALTH_INSECURE="1"
  else
    HEALTH_INSECURE="0"
  fi
fi
API_HEALTH_URL="${API_HEALTH_URL:-${HEALTH_SCHEME}://${HEALTH_HOST}:${SERVER_PORT}/api/health}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_FRONTEND_DEPLOY="${SKIP_FRONTEND_DEPLOY:-0}"
RUN_USER_INIT="${RUN_USER_INIT:-0}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

install_deps() {
  local dir="$1"
  if [[ -f "$dir/package-lock.json" ]]; then
    npm ci --no-audit --no-fund --prefix "$dir"
  else
    npm install --no-audit --no-fund --prefix "$dir"
  fi
}

ensure_low_port_permission() {
  if (( SERVER_PORT >= 1024 )); then
    return 0
  fi

  if [[ "$EUID" -eq 0 ]]; then
    return 0
  fi

  local node_bin
  node_bin="$(command -v node)"

  if command -v getcap >/dev/null 2>&1; then
    if getcap "$node_bin" | grep -q "cap_net_bind_service"; then
      return 0
    fi
  fi

  echo "当前用户无权限绑定低位端口 ${SERVER_PORT}。" >&2
  echo "请使用 root 运行，或先执行：" >&2
  echo "sudo setcap 'cap_net_bind_service=+ep' \"$node_bin\"" >&2
  exit 1
}

ensure_tls_config() {
  if [[ "$TLS_ENABLED" != "1" ]]; then
    return 0
  fi

  if [[ -z "$SSL_CERT_PATH" || -z "$SSL_KEY_PATH" ]]; then
    echo "启用 TLS 时必须设置 SSL_CERT_PATH 和 SSL_KEY_PATH。" >&2
    echo "示例:" >&2
    echo "SSL_CERT_PATH=/etc/ssl/certs/cf-origin.pem SSL_KEY_PATH=/etc/ssl/private/cf-origin.key ./scripts/deploy.sh" >&2
    exit 1
  fi

  if [[ ! -f "$SSL_CERT_PATH" ]]; then
    echo "证书文件不存在: $SSL_CERT_PATH" >&2
    exit 1
  fi

  if [[ ! -f "$SSL_KEY_PATH" ]]; then
    echo "私钥文件不存在: $SSL_KEY_PATH" >&2
    exit 1
  fi
}

run_health_check() {
  log "执行健康检查: $API_HEALTH_URL"
  local max_retry=20
  local i
  local curl_args=(-fsS)
  if [[ "$HEALTH_INSECURE" == "1" ]]; then
    curl_args=(-k "${curl_args[@]}")
  fi

  for ((i=1; i<=max_retry; i++)); do
    if curl "${curl_args[@]}" "$API_HEALTH_URL" >/dev/null 2>&1; then
      log "健康检查通过"
      return 0
    fi
    sleep 2
  done

  echo "健康检查失败: $API_HEALTH_URL" >&2
  return 1
}

main() {
  need_cmd node
  need_cmd npm
  need_cmd curl
  ensure_low_port_permission
  ensure_tls_config

  log "开始一键部署"
  log "项目目录: $ROOT_DIR"
  log "后端监听: ${SERVER_HOST}:${SERVER_PORT}"
  log "TLS 启用状态: ${TLS_ENABLED}"

  if [[ "$SKIP_INSTALL" != "1" ]]; then
    log "安装前端依赖"
    install_deps "$FRONTEND_DIR"

    log "安装后端依赖"
    install_deps "$BACKEND_DIR"
  else
    log "跳过依赖安装 (SKIP_INSTALL=1)"
  fi

  log "构建前端"
  npm run build --prefix "$FRONTEND_DIR"

  log "构建后端"
  npm run build --prefix "$BACKEND_DIR"

  if [[ "$RUN_USER_INIT" == "1" ]]; then
    log "初始化默认用户"
    npm run user:init --prefix "$BACKEND_DIR"
  fi

  if [[ "$SKIP_FRONTEND_DEPLOY" != "1" ]]; then
    log "发布前端静态文件到: $FRONTEND_DIST_DIR"
    mkdir -p "$FRONTEND_DIST_DIR"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_DIST_DIR/"
    else
      rm -rf "${FRONTEND_DIST_DIR:?}/"*
      cp -R "$FRONTEND_DIR/dist/." "$FRONTEND_DIST_DIR/"
    fi
  else
    log "跳过前端静态文件发布 (SKIP_FRONTEND_DEPLOY=1)"
  fi

  if command -v pm2 >/dev/null 2>&1; then
    log "使用 PM2 启动/重载后端"
    mkdir -p "$BACKEND_DIR/logs"

    if pm2 describe mev-server >/dev/null 2>&1; then
      PORT="$SERVER_PORT" HOST="$SERVER_HOST" NODE_ENV=production \
        ENABLE_HTTPS="$TLS_ENABLED" SSL_CERT_PATH="$SSL_CERT_PATH" SSL_KEY_PATH="$SSL_KEY_PATH" \
        pm2 reload "$BACKEND_DIR/ecosystem.config.js" --only mev-server --update-env
    else
      PORT="$SERVER_PORT" HOST="$SERVER_HOST" NODE_ENV=production \
        ENABLE_HTTPS="$TLS_ENABLED" SSL_CERT_PATH="$SSL_CERT_PATH" SSL_KEY_PATH="$SSL_KEY_PATH" \
        pm2 start "$BACKEND_DIR/ecosystem.config.js"
    fi

    pm2 save
  else
    log "未检测到 PM2，使用后台进程启动后端"
    mkdir -p "$BACKEND_DIR/logs"
    PORT="$SERVER_PORT" HOST="$SERVER_HOST" NODE_ENV=production \
      ENABLE_HTTPS="$TLS_ENABLED" SSL_CERT_PATH="$SSL_CERT_PATH" SSL_KEY_PATH="$SSL_KEY_PATH" \
      nohup node "$BACKEND_DIR/dist/index.js" >"$BACKEND_DIR/logs/out.log" 2>"$BACKEND_DIR/logs/err.log" &
  fi

  run_health_check

  log "部署完成"
  log "后端健康检查地址: $API_HEALTH_URL"
  log "前端静态目录: $FRONTEND_DIST_DIR"
  log "后端已直接监听端口: ${SERVER_PORT} (未使用 Nginx 反向代理)"
  if [[ "$TLS_ENABLED" == "1" ]]; then
    log "HTTPS 证书: $SSL_CERT_PATH"
  fi
}

main "$@"
