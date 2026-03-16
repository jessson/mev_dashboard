#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/server"
RUNTIME_DIR="$ROOT_DIR/.deploy-runtime"
ROOT_ENV_FILE="$ROOT_DIR/.env"
API_ENV_FILE="$BACKEND_DIR/.env"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

load_env_defaults() {
  local file="$1"
  local line key value

  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*= ]] || continue

    key="${line%%=*}"
    key="${key//[[:space:]]/}"
    value="${line#*=}"

    if [[ -z "${!key:-}" ]]; then
      eval "export ${key}=${value}"
    fi
  done < "$file"
}

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  log "未检测到 pm2，开始自动安装"
  npm install -g pm2

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "pm2 安装失败，请手动执行: npm install -g pm2" >&2
    exit 1
  fi

  log "pm2 安装完成: $(pm2 --version)"
}

ensure_files_ready() {
  if [[ ! -f "$ROOT_ENV_FILE" ]]; then
    echo "缺少 $ROOT_ENV_FILE，请先执行 ./scripts/deploy.sh" >&2
    exit 1
  fi

  if [[ ! -f "$API_ENV_FILE" ]]; then
    echo "缺少 $API_ENV_FILE，请先执行 ./scripts/deploy.sh" >&2
    exit 1
  fi

  if [[ ! -f "$BACKEND_DIR/dist/index.js" ]]; then
    echo "缺少后端构建产物: $BACKEND_DIR/dist/index.js，请先执行 ./scripts/deploy.sh" >&2
    exit 1
  fi

  if [[ ! -d "$FRONTEND_DIST_DIR" ]]; then
    echo "缺少前端发布目录: $FRONTEND_DIST_DIR，请先执行 ./scripts/deploy.sh" >&2
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

ensure_runtime_dirs() {
  mkdir -p "$RUNTIME_DIR"
  mkdir -p "$BACKEND_DIR/logs"
}

cleanup_legacy_pm2() {
  if pm2 describe "$LEGACY_PM2_NAME" >/dev/null 2>&1; then
    log "清理旧版直出进程: $LEGACY_PM2_NAME"
    pm2 delete "$LEGACY_PM2_NAME" >/dev/null 2>&1 || true
  fi
}

start_api() {
  log "使用 PM2 启动/重载 API 进程: $PM2_API_NAME"
  if pm2 describe "$PM2_API_NAME" >/dev/null 2>&1; then
    env \
      PORT="$API_PORT" \
      HOST="$API_HOST" \
      NODE_ENV="$NODE_ENV" \
      JWT_SECRET="$JWT_SECRET" \
      ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
      WRITE_API_ALLOWED_ROLES="$WRITE_API_ALLOWED_ROLES" \
      SYNCHRONIZE_DB="$SYNCHRONIZE_DB" \
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
      WRITE_API_ALLOWED_ROLES="$WRITE_API_ALLOWED_ROLES" \
      SYNCHRONIZE_DB="$SYNCHRONIZE_DB" \
      LOG_LEVEL="$LOG_LEVEL" \
      DATABASE_PATH="$DATABASE_PATH" \
      pm2 start "$BACKEND_DIR/dist/index.js" \
      --name "$PM2_API_NAME" \
      --cwd "$BACKEND_DIR" \
      --time \
      --output "$BACKEND_DIR/logs/${PM2_API_NAME}.out.log" \
      --error "$BACKEND_DIR/logs/${PM2_API_NAME}.err.log"
  fi
}

start_web() {
  log "使用 PM2 启动/重载 Web 网关进程: $PM2_WEB_NAME"
  if pm2 describe "$PM2_WEB_NAME" >/dev/null 2>&1; then
    env \
      WEB_HOST="$WEB_HOST" \
      WEB_PORT="$WEB_PORT" \
      API_TARGET="http://${API_PROXY_HOST}:${API_PORT}" \
      FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
      SSL_CERT_PATH="$SSL_CERT_PATH" \
      SSL_KEY_PATH="$SSL_KEY_PATH" \
      pm2 restart "$PM2_WEB_NAME" --update-env
  else
    env \
      WEB_HOST="$WEB_HOST" \
      WEB_PORT="$WEB_PORT" \
      API_TARGET="http://${API_PROXY_HOST}:${API_PORT}" \
      FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
      SSL_CERT_PATH="$SSL_CERT_PATH" \
      SSL_KEY_PATH="$SSL_KEY_PATH" \
      pm2 start "$ROOT_DIR/scripts/gateway.mjs" \
      --name "$PM2_WEB_NAME" \
      --cwd "$ROOT_DIR" \
      --time \
      --output "$RUNTIME_DIR/${PM2_WEB_NAME}.out.log" \
      --error "$RUNTIME_DIR/${PM2_WEB_NAME}.err.log"
  fi
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
  load_env_defaults "$ROOT_ENV_FILE"
  load_env_defaults "$API_ENV_FILE"

  FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/mev_dashboard}"
  WEB_HOST="${WEB_HOST:-0.0.0.0}"
  WEB_PORT="${WEB_PORT:-8443}"
  API_HOST="${API_HOST:-${HOST:-0.0.0.0}}"
  API_PORT="${PORT:-${API_PORT:-3000}}"
  API_PROXY_HOST="${API_PROXY_HOST:-127.0.0.1}"
  SSL_CERT_PATH="${SSL_CERT_PATH:-}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-}"
  NODE_ENV="${NODE_ENV:-production}"
  JWT_SECRET="${JWT_SECRET:-}"
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"
  WRITE_API_ALLOWED_ROLES="${WRITE_API_ALLOWED_ROLES:-admin}"
  SYNCHRONIZE_DB="${SYNCHRONIZE_DB:-0}"
  LOG_LEVEL="${LOG_LEVEL:-info}"
  DATABASE_PATH="${DATABASE_PATH:-$BACKEND_DIR/data/mev.db}"
  PM2_API_NAME="${PM2_API_NAME:-mev-api}"
  PM2_WEB_NAME="${PM2_WEB_NAME:-mev-web}"
  LEGACY_PM2_NAME="${LEGACY_PM2_NAME:-mev-server}"
  HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"
  WEB_HEALTH_URL="${WEB_HEALTH_URL:-https://${HEALTH_HOST}:${WEB_PORT}/api/health}"
  API_HEALTH_URL="${API_HEALTH_URL:-http://${HEALTH_HOST}:${API_PORT}/api/health}"

  need_cmd node
  need_cmd npm
  need_cmd curl
  ensure_pm2
  ensure_runtime_dirs
  ensure_files_ready

  log "开始启动服务"
  log "前端监听: ${WEB_HOST}:${WEB_PORT} (HTTPS)"
  log "后端监听: ${API_HOST}:${API_PORT} (HTTP)"
  log "前端网关反代目标: ${API_PROXY_HOST}:${API_PORT}"

  cleanup_legacy_pm2
  start_api
  start_web
  pm2 save >/dev/null 2>&1 || true

  run_health_check "$API_HEALTH_URL" "api"
  run_health_check "$WEB_HEALTH_URL" "web" "1"

  log "启动完成"
  log "前端访问地址: https://${HEALTH_HOST}:${WEB_PORT}"
  log "前端健康检查: $WEB_HEALTH_URL"
  log "后端健康检查: $API_HEALTH_URL"
  log "后端对外监听: http://0.0.0.0:${API_PORT} (请确保 UFW 白名单已配置)"
}

main "$@"
