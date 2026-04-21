#!/usr/bin/env bash
# ──────────────────────────────────────────────
# 黑豆芽 (Black Bean Sprouts) — 启动脚本
# 用法: bash scripts/start.sh
# ──────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
info() { echo -e "${CYAN}[INFO]${NC}  $1"; }

# ── 1. 检查 .env ──
if [ ! -f .env ]; then
  warn ".env 不存在, 从 .env.example 复制..."
  cp .env.example .env
  info "请编辑 .env 填写真实配置 (尤其是 LLM_API_KEY), 然后重新运行"
fi

# ── 2. 启动 Docker 服务 ──
log "启动 Docker 服务 (PostgreSQL + Redis + MinIO)..."
docker compose up -d

log "等待数据库就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 1
done

# ── 3. Prisma ──
log "同步数据库 Schema..."
npx prisma generate --schema=prisma/schema.prisma 2>/dev/null || true
npx prisma db push --schema=prisma/schema.prisma 2>/dev/null || true

# ── 4. 构建 agent-runtime (server 依赖其 dist) ──
log "构建 agent-runtime..."
pnpm --filter @black-bean-sprouts/agent-runtime build 2>/dev/null || true

# ── 5. 启动后端 ──
log "启动后端 (port 4000)..."
pnpm --filter @black-bean-sprouts/server dev &
SERVER_PID=$!

# 等待后端就绪
for i in $(seq 1 15); do
  if curl -s http://localhost:4000/api/health &>/dev/null; then
    break
  fi
  sleep 1
done

# ── 6. 启动前端 ──
log "启动前端 (port 5173)..."
pnpm --filter @black-bean-sprouts/web dev &
WEB_PID=$!

# 保存 PID 供 stop 脚本使用
echo "$SERVER_PID" > .server.pid
echo "$WEB_PID"    > .web.pid

echo ""
echo "───────────────────────────────────────────"
log "黑豆芽已启动!"
echo "───────────────────────────────────────────"
echo "  后端 API:    http://localhost:4000"
echo "  前端页面:    http://localhost:5173"
echo "  MinIO 控制台: http://localhost:9001"
echo ""
echo "  停止服务: bash scripts/stop.sh"
echo "───────────────────────────────────────────"

# 前台等待
wait
