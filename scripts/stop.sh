#!/usr/bin/env bash
# ──────────────────────────────────────────────
# 黑豆芽 (Black Bean Sprouts) — 停止脚本
# 用法: bash scripts/stop.sh
# ──────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[STOP]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

# ── 1. 停止 Node 进程 ──
if [ -f .server.pid ]; then
  PID=$(cat .server.pid)
  if kill -0 "$PID" 2>/dev/null; then
    log "停止后端 (PID $PID)..."
    kill "$PID" 2>/dev/null || true
  fi
  rm -f .server.pid
fi

if [ -f .web.pid ]; then
  PID=$(cat .web.pid)
  if kill -0 "$PID" 2>/dev/null; then
    log "停止前端 (PID $PID)..."
    kill "$PID" 2>/dev/null || true
  fi
  rm -f .web.pid
fi

# 兜底: 按端口杀
log "清理残留进程..."
# shellcheck disable=SC2046
kill $(lsof -ti:4000 2>/dev/null) 2>/dev/null || true
# shellcheck disable=SC2046
kill $(lsof -ti:5173 2>/dev/null) 2>/dev/null || true

# ── 2. 停止 Docker ──
log "停止 Docker 服务..."
docker compose down

# 清理 PID 文件
rm -f .server.pid .web.pid

echo ""
log "黑豆芽已停止。"
