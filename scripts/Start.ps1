# ──────────────────────────────────────────────
# 黑豆芽 (Black Bean Sprouts) — 启动脚本 (PowerShell)
# 用法: powershell -ExecutionPolicy Bypass -File scripts/Start.ps1
# ──────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ROOT

function Log($msg)  { Write-Host "[START] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }

# ── 1. 检查 .env ──
if (-not (Test-Path ".env")) {
    Warn ".env 不存在, 从 .env.example 复制..."
    Copy-Item ".env.example" ".env"
    Info "请编辑 .env 填写真实配置 (尤其是 LLM_API_KEY), 然后重新运行"
}

# ── 2. 启动 Docker 服务 ──
Log "启动 Docker 服务 (PostgreSQL + Redis + MinIO)..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Warn "Docker 启动失败, 请确认 Docker Desktop 已运行"
}

Log "等待数据库就绪..."
for ($i = 0; $i -lt 30; $i++) {
    $result = docker compose exec -T postgres pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
}

# ── 3. Prisma ──
Log "同步数据库 Schema..."
npx prisma generate --schema=prisma/schema.prisma 2>$null
npx prisma db push --schema=prisma/schema.prisma 2>$null

# ── 4. 构建 agent-runtime ──
Log "构建 agent-runtime..."
pnpm --filter @black-bean-sprouts/agent-runtime build 2>$null

# ── 5. 启动后端 ──
Log "启动后端 (port 4000)..."
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:ROOT
    pnpm --filter @black-bean-sprouts/server dev
}

# 等待后端就绪
for ($i = 0; $i -lt 15; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 2 2>$null | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

# ── 6. 启动前端 ──
Log "启动前端 (port 5173)..."
$webJob = Start-Job -ScriptBlock {
    Set-Location $using:ROOT
    pnpm --filter @black-bean-sprouts/web dev
}

# 保存 Job ID
$serverJob.Id | Out-File ".server.job" -Encoding utf8
$webJob.Id    | Out-File ".web.job" -Encoding utf8

Write-Host ""
Write-Host "───────────────────────────────────────────" -ForegroundColor White
Log "黑豆芽已启动!"
Write-Host "───────────────────────────────────────────" -ForegroundColor White
Write-Host "  后端 API:    http://localhost:4000"
Write-Host "  前端页面:    http://localhost:5173"
Write-Host "  MinIO 控制台: http://localhost:9001"
Write-Host ""
Write-Host "  停止服务: powershell -ExecutionPolicy Bypass -File scripts\Stop.ps1"
Write-Host "───────────────────────────────────────────" -ForegroundColor White

# 前台等待
Write-Host "按 Ctrl+C 停止..." -ForegroundColor Yellow
try {
    Wait-Job $serverJob, $webJob
} finally {
    Stop-Job $serverJob, $webJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob, $webJob -ErrorAction SilentlyContinue
    Remove-Item ".server.job", ".web.job" -ErrorAction SilentlyContinue
}
