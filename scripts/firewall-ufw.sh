#!/usr/bin/env bash
set -euo pipefail

# UFW 防火墙配置脚本
#
# 目标：
# - 放行 Web HTTPS 端口（默认 8443）
# - API 端口（默认 3000）仅允许：
#   - 本机回环（127.0.0.1 / lo）
#   - 指定的固定 IP/CIDR（ALLOW_API_IPS）
#
# 使用（先预览，再执行）：
#   WEB_PORT=8443 API_PORT=3000 ALLOW_API_IPS="1.2.3.4/32,5.6.7.0/24" ./scripts/firewall-ufw.sh
#   APPLY=1 WEB_PORT=8443 API_PORT=3000 ALLOW_API_IPS="1.2.3.4/32" sudo -E ./scripts/firewall-ufw.sh
#
# 注意：
# - 脚本不会 reset UFW，也不会改默认策略；只添加必要规则。
# - 如果你的 SSH 不是 22 端口，请设置 SSH_PORT，否则可能把自己锁在门外。

WEB_PORT="${WEB_PORT:-8443}"
API_PORT="${API_PORT:-3000}"
SSH_PORT="${SSH_PORT:-22}"
ALLOW_API_IPS="${ALLOW_API_IPS:-}" # 逗号分隔 CIDR 列表

APPLY="${APPLY:-0}"               # 1=执行；默认仅打印
ENABLE_UFW="${ENABLE_UFW:-0}"     # 1=执行 ufw enable

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

run() {
  if [[ "$APPLY" == "1" ]]; then
    log "RUN: $*"
    "$@"
  else
    log "DRY: $*"
  fi
}

if [[ "$APPLY" == "1" && "$EUID" -ne 0 ]]; then
  echo "需要 root 权限执行。请使用 sudo -E 并设置 APPLY=1。" >&2
  exit 1
fi

need_cmd ufw

log "准备配置 UFW（APPLY=$APPLY, ENABLE_UFW=$ENABLE_UFW）"
log "Web 端口: $WEB_PORT/tcp"
log "API 端口: $API_PORT/tcp（仅 lo + allowlist）"
log "SSH 端口: $SSH_PORT/tcp"

# 先确保 SSH 不会被误伤
run ufw allow "${SSH_PORT}/tcp" comment "ssh"

# 放行 Web 端口
run ufw allow "${WEB_PORT}/tcp" comment "mev-web"

# API 仅允许本地回环
run ufw allow in on lo to any port "$API_PORT" proto tcp comment "mev-api-local"

# API allowlist
IFS=',' read -r -a allowIps <<< "$ALLOW_API_IPS"
for raw in "${allowIps[@]}"; do
  ip="$(echo "$raw" | xargs)"
  if [[ -z "$ip" ]]; then
    continue
  fi
  run ufw allow from "$ip" to any port "$API_PORT" proto tcp comment "mev-api-allowlist"
done

# 最后 deny 公网访问 API
run ufw deny "${API_PORT}/tcp" comment "mev-api-deny-public"

if [[ "$ENABLE_UFW" == "1" ]]; then
  run ufw --force enable
fi

run ufw status verbose

