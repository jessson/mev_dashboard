#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"
BACKEND_DIR="$ROOT_DIR/server"
RUNTIME_DIR="$ROOT_DIR/.deploy-runtime"

FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/mev_dashboard}"

WEB_HOST="${WEB_HOST:-0.0.0.0}"
WEB_PORT="${WEB_PORT:-8443}"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3000}"

SSL_CERT_PATH="${SSL_CERT_PATH:-}"
SSL_KEY_PATH="${SSL_KEY_PATH:-}"

NODE_ENV="${NODE_ENV:-production}"
JWT_SECRET="${JWT_SECRET:-}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"
LOG_LEVEL="${LOG_LEVEL:-info}"
DATABASE_PATH="${DATABASE_PATH:-$BACKEND_DIR/data/mev.db}"

HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-https://${HEALTH_HOST}:${WEB_PORT}/api/health}"
API_HEALTH_URL="${API_HEALTH_URL:-http://${HEALTH_HOST}:${API_PORT}/api/health}"

SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_FRONTEND_DEPLOY="${SKIP_FRONTEND_DEPLOY:-0}"
RUN_USER_INIT="${RUN_USER_INIT:-0}"

PM2_API_NAME="${PM2_API_NAME:-mev-api}"
PM2_WEB_NAME="${PM2_WEB_NAME:-mev-web}"
LEGACY_PM2_NAME="${LEGACY_PM2_NAME:-mev-server}"

BACKEND_PID_FILE="$RUNTIME_DIR/${PM2_API_NAME}.pid"
GATEWAY_PID_FILE="$RUNTIME_DIR/${PM2_WEB_NAME}.pid"

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

ensure_tls_config() {
  if [[ -z "$SSL_CERT_PATH" || -z "$SSL_KEY_PATH" ]]; then
    echo "必须设置 Cloudflare Origin Certificate 路径。" >&2
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

warn_security_defaults() {
  if [[ -z "$JWT_SECRET" ]]; then
    echo "警告: 未设置 JWT_SECRET，后端将回退到默认密钥。生产环境强烈建议显式传入 JWT_SECRET。" >&2
  fi
}

ensure_runtime_dirs() {
  mkdir -p "$RUNTIME_DIR"
  mkdir -p "$BACKEND_DIR/logs"
}

publish_frontend() {
  if [[ "$SKIP_FRONTEND_DEPLOY" == "1" ]]; then
    log "跳过前端静态文件发布 (SKIP_FRONTEND_DEPLOY=1)"
    return 0
  fi

  log "发布前端静态文件到: $FRONTEND_DIST_DIR"
  mkdir -p "$FRONTEND_DIST_DIR"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_DIST_DIR/"
  else
    rm -rf "${FRONTEND_DIST_DIR:?}/"*
    cp -R "$FRONTEND_DIR/dist/." "$FRONTEND_DIST_DIR/"
  fi
}

stop_pid_file_process() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi

  rm -f "$pid_file"
}

cleanup_legacy_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  if pm2 describe "$LEGACY_PM2_NAME" >/dev/null 2>&1; then
    log "清理旧版直出进程: $LEGACY_PM2_NAME"
    pm2 delete "$LEGACY_PM2_NAME" >/dev/null 2>&1 || true
  fi
}

start_with_pm2() {
  cleanup_legacy_pm2

  log "使用 PM2 启动/重载 API 进程: $PM2_API_NAME"
  if pm2 describe "$PM2_API_NAME" >/dev/null 2>&1; then
    env \
      PORT="$API_PORT" \
      HOST="$API_HOST" \
      NODE_ENV="$NODE_ENV" \
      JWT_SECRET="$JWT_SECRET" \
      ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
      LOG_LEVEL="$LOG_LEVEL" \
      DATABASE_PATH="$DATABASE_PATH" \
      pm2 restart "$PM2_API_NAME" --update-env
  else
    env \
      PORT="$API_PORT" \
      HOST="$API_HOST" \
      NODE_ENV="$NODE_ENV" \
      JWT_SECRET="$JWT_SECRET" \
      ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
      LOG_LEVEL="$LOG_LEVEL" \
      DATABASE_PATH="$DATABASE_PATH" \
      pm2 start "$BACKEND_DIR/dist/index.js" \
      --name "$PM2_API_NAME" \
      --cwd "$BACKEND_DIR" \
      --time \
      --output "$BACKEND_DIR/logs/${PM2_API_NAME}.out.log" \
      --error "$BACKEND_DIR/logs/${PM2_API_NAME}.err.log"
  fi

  log "使用 PM2 启动/重载 Web 网关进程: $PM2_WEB_NAME"
  if pm2 describe "$PM2_WEB_NAME" >/dev/null 2>&1; then
    env \
      WEB_HOST="$WEB_HOST" \
      WEB_PORT="$WEB_PORT" \
      API_TARGET="http://${API_HOST}:${API_PORT}" \
      FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
      SSL_CERT_PATH="$SSL_CERT_PATH" \
      SSL_KEY_PATH="$SSL_KEY_PATH" \
      pm2 restart "$PM2_WEB_NAME" --update-env
  else
    env \
      WEB_HOST="$WEB_HOST" \
      WEB_PORT="$WEB_PORT" \
      API_TARGET="http://${API_HOST}:${API_PORT}" \
      FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
      SSL_CERT_PATH="$SSL_CERT_PATH" \
      SSL_KEY_PATH="$SSL_KEY_PATH" \
      pm2 start "$ROOT_DIR/scripts/gateway.mjs" \
      --name "$PM2_WEB_NAME" \
      --cwd "$ROOT_DIR" \
      --time \
      --output "$ROOT_DIR/.deploy-runtime/${PM2_WEB_NAME}.out.log" \
      --error "$ROOT_DIR/.deploy-runtime/${PM2_WEB_NAME}.err.log"
  fi

  pm2 save >/dev/null 2>&1 || true
}

start_without_pm2() {
  log "未检测到 PM2，使用 nohup 启动 API 和 Web 网关"

  stop_pid_file_process "$BACKEND_PID_FILE"
  stop_pid_file_process "$GATEWAY_PID_FILE"

  env \
    PORT="$API_PORT" \
    HOST="$API_HOST" \
    NODE_ENV="$NODE_ENV" \
    JWT_SECRET="$JWT_SECRET" \
    ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
    LOG_LEVEL="$LOG_LEVEL" \
    DATABASE_PATH="$DATABASE_PATH" \
    nohup node "$BACKEND_DIR/dist/index.js" \
      >"$BACKEND_DIR/logs/${PM2_API_NAME}.out.log" \
      2>"$BACKEND_DIR/logs/${PM2_API_NAME}.err.log" &
  echo $! >"$BACKEND_PID_FILE"

  env \
    WEB_HOST="$WEB_HOST" \
    WEB_PORT="$WEB_PORT" \
    API_TARGET="http://${API_HOST}:${API_PORT}" \
    FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
    SSL_CERT_PATH="$SSL_CERT_PATH" \
    SSL_KEY_PATH="$SSL_KEY_PATH" \
    nohup node "$ROOT_DIR/scripts/gateway.mjs" \
      >"$ROOT_DIR/.deploy-runtime/${PM2_WEB_NAME}.out.log" \
      2>"$ROOT_DIR/.deploy-runtime/${PM2_WEB_NAME}.err.log" &
  echo $! >"$GATEWAY_PID_FILE"
}

run_health_check() {
  local url="$1"
  local label="$2"
  local insecure="${3:-0}"
  local max_retry=20
  local i
  local curl_args=(-fsS)

  if [[ "$insecure" == "1" ]]; then
    curl_args=(-k "${curl_args[@]}")
  fi

  log "执行健康检查 [$label]: $url"
  for ((i=1; i<=max_retry; i++)); do
    if curl "${curl_args[@]}" "$url" >/dev/null 2>&1; then
      log "健康检查通过 [$label]"
      return 0
    fi
    sleep 2
  done

  echo "健康检查失败 [$label]: $url" >&2
  return 1
}

main() {
  need_cmd node
  need_cmd npm
  need_cmd curl
  ensure_tls_config
  warn_security_defaults
  ensure_runtime_dirs

  log "开始一键部署"
  log "前端监听: ${WEB_HOST}:${WEB_PORT} (HTTPS)"
  log "后端监听: ${API_HOST}:${API_PORT} (HTTP，仅本机/内网)"
  log "前端发布目录: $FRONTEND_DIST_DIR"

  if [[ "$SKIP_INSTALL" != "1" ]]; then
    log "安装前端依赖"
    install_deps "$FRONTEND_DIR"

    log "安装后端依赖"
    install_deps "$BACKEND_DIR"
  else
    log "跳过依赖安装 (SKIP_INSTALL=1)"
  fi

  log "构建前端 (同源 API 模式)"
  VITE_API_SAME_ORIGIN=1 npm run build --prefix "$FRONTEND_DIR"

  log "构建后端"
  npm run build --prefix "$BACKEND_DIR"

  if [[ "$RUN_USER_INIT" == "1" ]]; then
    log "初始化默认用户"
    npm run user:init --prefix "$BACKEND_DIR"
  fi

  publish_frontend

  if command -v pm2 >/dev/null 2>&1; then
    start_with_pm2
  else
    start_without_pm2
  fi

  run_health_check "$API_HEALTH_URL" "api"
  run_health_check "$WEB_HEALTH_URL" "web" "1"

  log "部署完成"
  log "前端访问地址: https://${HEALTH_HOST}:${WEB_PORT}"
  log "前端健康检查: $WEB_HEALTH_URL"
  log "后端健康检查: $API_HEALTH_URL"
  log "Cloudflare 证书: $SSL_CERT_PATH"
}

main "$@"
