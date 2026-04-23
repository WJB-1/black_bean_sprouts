#!/usr/bin/env bash
# ============================================================================
# 黑豆芽 (Black Bean Sprouts) — 一键启动/停止/重启脚本
# 用法:
#   ./dev.sh          启动所有服务 (默认)
#   ./dev.sh start    启动所有服务
#   ./dev.sh stop     停止所有服务
#   ./dev.sh restart  重启所有服务
#   ./dev.sh status   查看服务状态
# ============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

DB_URL="postgresql://postgres:postgres@127.0.0.1:5432/black_bean_sprouts?schema=public"
PID_DIR="$ROOT_DIR/.dev-pids"
LOG_DIR="$ROOT_DIR/.dev-logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ---- 颜色 ----
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

# ---- 辅助函数 ----

is_running() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
}

stop_process() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    info "Stopping $name (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    for i in $(seq 1 10); do
      if ! kill -0 "$pid" 2>/dev/null; then break; fi
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      warn "$name did not exit gracefully, force killing..."
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
    ok "$name stopped"
  else
    info "$name is not running"
  fi
}

wait_for_postgres() {
  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec black_bean_sprouts-postgres-1 pg_isready -U postgres &>/dev/null; then
      ok "PostgreSQL is ready"
      return 0
    fi
    sleep 1
  done
  fail "PostgreSQL did not become ready in 30s"
  return 1
}

# ---- 命令实现 ----

cmd_start() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  黑豆芽 Dev Environment — Starting${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  # 1. Docker 容器
  info "Starting Docker containers (PostgreSQL, Redis, MinIO)..."
  docker compose up -d 2>&1 | grep -v "obsolete" || true
  ok "Docker containers started"
  echo ""

  # 2. 等待 PostgreSQL
  wait_for_postgres
  echo ""

  # 3. .env 文件
  if [ ! -f "$ROOT_DIR/.env" ]; then
    info "Creating .env from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  fi

  # 4. Prisma schema push
  info "Syncing database schema..."
  DATABASE_URL="$DB_URL" npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 | tail -1
  ok "Database schema synced"
  echo ""

  # 5. Build
  info "Building all packages..."
  pnpm -r --stream run build 2>&1 | grep -E "(Done|Failed)" || true
  ok "Build complete"
  echo ""

  # 6. 后端服务器
  if is_running "$PID_DIR/server.pid"; then
    info "Backend server already running (PID $(cat "$PID_DIR/server.pid"))"
  else
    info "Starting backend server on http://localhost:3000..."
    DATABASE_URL="$DB_URL" node packages/server/dist/index.js > "$LOG_DIR/server.log" 2>&1 &
    echo $! > "$PID_DIR/server.pid"
    sleep 2
    if is_running "$PID_DIR/server.pid"; then
      ok "Backend server started (PID $(cat "$PID_DIR/server.pid"))"
    else
      fail "Backend server failed to start. See $LOG_DIR/server.log"
      cat "$LOG_DIR/server.log" 2>/dev/null
      return 1
    fi
  fi
  echo ""

  # 7. Vite 前端
  if is_running "$PID_DIR/vite.pid"; then
    info "Vite dev server already running (PID $(cat "$PID_DIR/vite.pid"))"
  else
    info "Starting Vite dev server on http://localhost:5173..."
    npx vite packages/web --host > "$LOG_DIR/vite.log" 2>&1 &
    echo $! > "$PID_DIR/vite.pid"
    sleep 3
    if is_running "$PID_DIR/vite.pid"; then
      ok "Vite dev server started (PID $(cat "$PID_DIR/vite.pid"))"
    else
      fail "Vite dev server failed to start. See $LOG_DIR/vite.log"
      cat "$LOG_DIR/vite.log" 2>/dev/null
      return 1
    fi
  fi
  echo ""

  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  All services running!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "  Frontend:  ${CYAN}http://localhost:5173${NC}"
  echo -e "  Backend:   ${CYAN}http://localhost:3000${NC}"
  echo -e "  MinIO:     ${CYAN}http://localhost:9001${NC} (minioadmin/minioadmin)"
  echo ""
  echo -e "  Stop:      ${YELLOW}./dev.sh stop${NC}"
  echo -e "  Logs:      ${YELLOW}tail -f .dev-logs/server.log${NC}"
  echo ""
}

cmd_stop() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  黑豆芽 Dev Environment — Stopping${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  stop_process "vite"
  stop_process "server"

  info "Stopping Docker containers..."
  docker compose down 2>&1 | grep -v "obsolete" || true
  ok "Docker containers stopped"
  echo ""

  echo -e "${GREEN}All services stopped.${NC}"
  echo ""
}

cmd_status() {
  echo ""
  echo -e "${CYAN}Service Status:${NC}"
  echo ""

  local all_ok=true

  if docker compose ps --format "table" 2>/dev/null | grep -q "healthy"; then
    ok "Docker containers: running"
  else
    warn "Docker containers: not running"
    all_ok=false
  fi

  if is_running "$PID_DIR/server.pid"; then
    ok "Backend server: running (PID $(cat "$PID_DIR/server.pid"))"
  else
    warn "Backend server: not running"
    all_ok=false
  fi

  if is_running "$PID_DIR/vite.pid"; then
    ok "Vite dev server: running (PID $(cat "$PID_DIR/vite.pid"))"
  else
    warn "Vite dev server: not running"
    all_ok=false
  fi

  echo ""
  if [ "$all_ok" = true ]; then
    echo -e "  Frontend: ${CYAN}http://localhost:5173${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:3000${NC}"
  else
    echo -e "  Run ${YELLOW}./dev.sh start${NC} to start all services"
  fi
  echo ""
}

# ---- 主入口 ----

case "${1:-start}" in
  start)   cmd_start   ;;
  stop)    cmd_stop    ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status  ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
