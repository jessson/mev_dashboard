#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR"
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

escape_env_value() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\\$}"
  value="${value//\`/\\\`}"
  printf '%s' "$value"
}

write_env_line() {
  local key="$1"
  local value="$2"
  printf '%s="%s"\n' "$key" "$(escape_env_value "$value")"
}

install_system_dependencies() {
  local packages=(
    curl
    ca-certificates
    build-essential
    gnupg
    python3
    make
    g++
    sqlite3
    libsqlite3-dev
    ufw
  )

  if ! command -v apt-get >/dev/null 2>&1; then
    log "当前系统不是 apt 系，跳过系统依赖自动安装"
    return 0
  fi

  log "安装系统依赖: ${packages[*]}"
  sudo apt-get update
  sudo apt-get install -y "${packages[@]}"
}

ensure_node_runtime() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "未检测到 node/npm，且当前系统不是 apt 系。请先手动安装 Node.js 18+ 和 npm。" >&2
    exit 1
  fi

  log "未检测到 node/npm，开始安装 Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
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

install_deps() {
  local dir="$1"
  if [[ -f "$dir/package-lock.json" ]]; then
    npm ci --no-audit --no-fund --prefix "$dir"
  else
    npm install --no-audit --no-fund --prefix "$dir"
  fi
}

ensure_runtime_dirs() {
  local database_dir

  if [[ "$DATABASE_PATH" = /* ]]; then
    database_dir="$(dirname "$DATABASE_PATH")"
  else
    database_dir="$BACKEND_DIR/$(dirname "$DATABASE_PATH")"
  fi

  mkdir -p "$RUNTIME_DIR"
  mkdir -p "$BACKEND_DIR/logs"
  mkdir -p "$database_dir"
}

ensure_tls_config() {
  if [[ -z "$SSL_CERT_PATH" ]]; then
    read -r -p "请输入 Cloudflare Origin Certificate PEM 路径: " SSL_CERT_PATH
  fi

  if [[ -z "$SSL_KEY_PATH" ]]; then
    read -r -p "请输入 Cloudflare Origin Certificate KEY 路径: " SSL_KEY_PATH
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

ensure_api_allowlist() {
  if [[ "$CONFIGURE_UFW" != "1" ]]; then
    return 0
  fi

  if [[ -n "$ALLOW_API_IPS" ]]; then
    return 0
  fi

  read -r -p "请输入允许访问 3000 端口的外部 IP/CIDR（多个用逗号分隔）: " ALLOW_API_IPS

  if [[ -z "$ALLOW_API_IPS" ]]; then
    echo "必须提供 ALLOW_API_IPS，才能为 3000 端口配置 UFW 白名单。" >&2
    exit 1
  fi
}

ensure_jwt_secret() {
  if [[ -n "$JWT_SECRET" ]]; then
    return 0
  fi

  read -r -s -p "请输入生产环境 JWT_SECRET: " JWT_SECRET
  echo

  if [[ -z "$JWT_SECRET" ]]; then
    echo "JWT_SECRET 不能为空。" >&2
    exit 1
  fi
}

configure_firewall() {
  if [[ "$CONFIGURE_UFW" != "1" ]]; then
    log "跳过 UFW 配置 (CONFIGURE_UFW=0)"
    return 0
  fi

  if ! command -v ufw >/dev/null 2>&1; then
    log "未检测到 ufw，自动安装"
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y ufw
    else
      echo "未找到 ufw，且当前系统不支持自动安装。请先手动安装 ufw。" >&2
      exit 1
    fi
  fi

  log "配置 UFW：开放 ${SSH_PORT}/tcp、${WEB_PORT}/tcp，并按白名单控制 ${API_PORT}/tcp"
  sudo -E env \
    APPLY=1 \
    ENABLE_UFW=1 \
    WEB_PORT="$WEB_PORT" \
    API_PORT="$API_PORT" \
    SSH_PORT="$SSH_PORT" \
    ALLOW_API_IPS="$ALLOW_API_IPS" \
    "$ROOT_DIR/scripts/firewall-ufw.sh"
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

write_gateway_env() {
  log "写入网关运行配置: $ROOT_ENV_FILE"
  {
    echo "# 由 scripts/deploy.sh 自动生成"
    write_env_line "FRONTEND_DIST_DIR" "$FRONTEND_DIST_DIR"
    write_env_line "WEB_HOST" "$WEB_HOST"
    write_env_line "WEB_PORT" "$WEB_PORT"
    write_env_line "API_HOST" "$API_HOST"
    write_env_line "API_PORT" "$API_PORT"
    write_env_line "API_PROXY_HOST" "$API_PROXY_HOST"
    write_env_line "SSL_CERT_PATH" "$SSL_CERT_PATH"
    write_env_line "SSL_KEY_PATH" "$SSL_KEY_PATH"
    write_env_line "ALLOW_API_IPS" "$ALLOW_API_IPS"
    write_env_line "SSH_PORT" "$SSH_PORT"
    write_env_line "CONFIGURE_UFW" "$CONFIGURE_UFW"
    write_env_line "PM2_API_NAME" "$PM2_API_NAME"
    write_env_line "PM2_WEB_NAME" "$PM2_WEB_NAME"
    write_env_line "LEGACY_PM2_NAME" "$LEGACY_PM2_NAME"
    write_env_line "HEALTH_HOST" "$HEALTH_HOST"
  } > "$ROOT_ENV_FILE"
}

write_api_env() {
  log "写入后端运行配置: $API_ENV_FILE"
  {
    echo "# 由 scripts/deploy.sh 自动生成"
    write_env_line "PORT" "$API_PORT"
    write_env_line "HOST" "$API_HOST"
    write_env_line "NODE_ENV" "$NODE_ENV"
    write_env_line "DATABASE_PATH" "$DATABASE_PATH"
    write_env_line "JWT_SECRET" "$JWT_SECRET"
    write_env_line "ALLOWED_ORIGINS" "$ALLOWED_ORIGINS"
    write_env_line "WRITE_API_ALLOWED_ROLES" "$WRITE_API_ALLOWED_ROLES"
    write_env_line "SYNCHRONIZE_DB" "$SYNCHRONIZE_DB"
    write_env_line "LOG_LEVEL" "$LOG_LEVEL"
  } > "$API_ENV_FILE"
}

main() {
  load_env_defaults "$ROOT_ENV_FILE"
  load_env_defaults "$API_ENV_FILE"

  FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-/var/www/mev_dashboard}"
  WEB_HOST="${WEB_HOST:-0.0.0.0}"
  WEB_PORT="${WEB_PORT:-8443}"
  API_HOST="${API_HOST:-${HOST:-0.0.0.0}}"
  API_PORT="${API_PORT:-${PORT:-3000}}"
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
  SKIP_INSTALL="${SKIP_INSTALL:-0}"
  SKIP_FRONTEND_DEPLOY="${SKIP_FRONTEND_DEPLOY:-0}"
  RUN_USER_INIT="${RUN_USER_INIT:-0}"
  CONFIGURE_UFW="${CONFIGURE_UFW:-1}"
  ALLOW_API_IPS="${ALLOW_API_IPS:-}"
  SSH_PORT="${SSH_PORT:-22}"
  PM2_API_NAME="${PM2_API_NAME:-mev-api}"
  PM2_WEB_NAME="${PM2_WEB_NAME:-mev-web}"
  LEGACY_PM2_NAME="${LEGACY_PM2_NAME:-mev-server}"
  HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"

  install_system_dependencies
  ensure_node_runtime
  need_cmd node
  need_cmd npm
  need_cmd curl
  ensure_runtime_dirs
  ensure_pm2
  ensure_tls_config
  ensure_api_allowlist
  ensure_jwt_secret

  log "开始准备部署环境"
  log "前端监听: ${WEB_HOST}:${WEB_PORT} (HTTPS)"
  log "后端监听: ${API_HOST}:${API_PORT} (HTTP，对外开放，依赖 UFW 控制)"
  log "前端网关反代目标: ${API_PROXY_HOST}:${API_PORT}"
  log "前端发布目录: $FRONTEND_DIST_DIR"
  if [[ "$CONFIGURE_UFW" == "1" ]]; then
    log "API 白名单: $ALLOW_API_IPS"
  fi

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
  write_gateway_env
  write_api_env
  configure_firewall

  log "部署准备完成，服务尚未启动"
  log "已写入配置: $ROOT_ENV_FILE"
  log "已写入配置: $API_ENV_FILE"
  log "启动服务请执行: ./scripts/start.sh"
  log "后端对外监听将使用: http://0.0.0.0:${API_PORT} (由 UFW 白名单控制)"
}

main "$@"
