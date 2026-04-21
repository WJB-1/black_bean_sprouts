# ──────────────────────────────────────────────
# 黑豆芽 (Black Bean Sprouts) — 停止脚本 (PowerShell)
# 用法: powershell -ExecutionPolicy Bypass -File scripts\Stop.ps1
# ──────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ROOT

function Log($msg)  { Write-Host "[STOP]  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }

# ── 1. 停止 Job ──
if (Test-Path ".server.job") {
    $jobId = Get-Content ".server.job"
    Log "停止后端 (Job $jobId)..."
    Stop-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Item ".server.job" -ErrorAction SilentlyContinue
}

if (Test-Path ".web.job") {
    $jobId = Get-Content ".web.job"
    Log "停止前端 (Job $jobId)..."
    Stop-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Item ".web.job" -ErrorAction SilentlyContinue
}

# 兜底: 按端口杀
Log "清理残留进程..."
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# ── 2. 停止 Docker ──
Log "停止 Docker 服务..."
docker compose down

Write-Host ""
Log "黑豆芽已停止。"
