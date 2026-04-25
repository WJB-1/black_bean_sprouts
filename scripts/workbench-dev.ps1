param(
  [ValidateSet("start", "stop", "restart", "status")]
  [string]$Action = "start",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RuntimeDir = Join-Path $RepoRoot ".tmp\workbench-dev"
$LogDir = Join-Path $RuntimeDir "logs"
$StateDir = Join-Path $RuntimeDir "state"
$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Write-Info([string]$Message) {
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarnLine([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Get-StatePath([string]$Name) {
  return (Join-Path $StateDir "$Name.json")
}

function Get-ServiceState([string]$Name) {
  $statePath = Get-StatePath $Name
  if (-not (Test-Path $statePath)) {
    return $null
  }
  return (Get-Content $statePath -Raw | ConvertFrom-Json)
}

function Save-ServiceState([string]$Name, [hashtable]$State) {
  $statePath = Get-StatePath $Name
  $State | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
}

function Remove-ServiceState([string]$Name) {
  $state = Get-ServiceState $Name
  if ($null -ne $state -and $state.bootstrapPath -and (Test-Path $state.bootstrapPath)) {
    Remove-Item -LiteralPath $state.bootstrapPath -Force -ErrorAction SilentlyContinue
  }

  $statePath = Get-StatePath $Name
  if (Test-Path $statePath) {
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  }
}

function Test-ProcessAlive([int]$ProcessId) {
  return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Test-ManagedServiceRunning([string]$Name) {
  $state = Get-ServiceState $Name
  if ($null -eq $state) {
    return $false
  }

  if (-not (Test-ProcessAlive ([int]$state.pid))) {
    Remove-ServiceState $Name
    return $false
  }

  return $true
}

function Stop-ProcessTree([int]$ProcessId) {
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Test-TcpPortOpen([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(400)) {
      return $false
    }
    $null = $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-TcpPort([int]$Port, [int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPortOpen -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Get-RecentLogText([string]$Path) {
  if (-not (Test-Path $Path)) {
    return ""
  }
  return ((Get-Content $Path -Tail 30 -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
}

function Load-DotEnvFile([string]$Path) {
  if (-not (Test-Path $Path)) {
    return
  }

  foreach ($rawLine in Get-Content $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $match = [regex]::Match($line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not $match.Success) {
      continue
    }

    $name = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim()

    if ($value.Length -ge 2) {
      $startsWithDouble = $value.StartsWith('"')
      $endsWithDouble = $value.EndsWith('"')
      $startsWithSingle = $value.StartsWith("'")
      $endsWithSingle = $value.EndsWith("'")
      if (($startsWithDouble -and $endsWithDouble) -or ($startsWithSingle -and $endsWithSingle)) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Initialize-WorkbenchEnvironment {
  Load-DotEnvFile -Path (Join-Path $RepoRoot ".env.example")
  Load-DotEnvFile -Path (Join-Path $RepoRoot ".env")

  if (-not $env:WORKBENCH_PROMPT_PROVIDER -and $env:SILICONFLOW_API_KEY) {
    $env:WORKBENCH_PROMPT_PROVIDER = "siliconflow-direct"
  }

  if (-not $env:SILICONFLOW_MODEL) {
    $env:SILICONFLOW_MODEL = "Qwen/Qwen2.5-7B-Instruct"
  }

  if (-not $env:PORT) {
    $env:PORT = "3000"
  }
}

function Show-InfrastructureWarnings {
  if (-not (Test-TcpPortOpen -Port 5432)) {
    Write-WarnLine "PostgreSQL is not reachable on localhost:5432. Auth, billing, and saved documents may fail until you start the database and run pnpm db:push."
  }

  if (-not (Test-TcpPortOpen -Port 6379)) {
    Write-WarnLine "Redis is not reachable on localhost:6379. Async render queue features will stay degraded."
  }

  if (-not (Test-TcpPortOpen -Port 9000)) {
    Write-WarnLine "MinIO is not reachable on localhost:9000. Async render file storage will stay degraded."
  }
}

function Assert-RequiredTools {
  foreach ($tool in @("pnpm", "node")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
      throw "Missing required command: $tool"
    }
  }
}

function New-BootstrapScript([string]$Name, [string]$CommandLine) {
  $bootstrapPath = Join-Path $RuntimeDir "$Name.bootstrap.ps1"
  $escapedRoot = $RepoRoot.Replace("'", "''")
  $escapedExampleEnvPath = (Join-Path $RepoRoot ".env.example").Replace("'", "''")
  $escapedEnvPath = (Join-Path $RepoRoot ".env").Replace("'", "''")

  $content = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$escapedRoot'

if (Test-Path '$escapedExampleEnvPath') {
  foreach (`$rawLine in Get-Content '$escapedExampleEnvPath') {
    `$line = `$rawLine.Trim()
    if (-not `$line -or `$line.StartsWith('#')) {
      continue
    }

    `$match = [regex]::Match(`$line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not `$match.Success) {
      continue
    }

    `$name = `$match.Groups[1].Value
    `$value = `$match.Groups[2].Value.Trim()

    if (`$value.Length -ge 2) {
      `$startsWithDouble = `$value.StartsWith('"')
      `$endsWithDouble = `$value.EndsWith('"')
      `$startsWithSingle = `$value.StartsWith("'")
      `$endsWithSingle = `$value.EndsWith("'")
      if ((`$startsWithDouble -and `$endsWithDouble) -or (`$startsWithSingle -and `$endsWithSingle)) {
        `$value = `$value.Substring(1, `$value.Length - 2)
      }
    }

    [System.Environment]::SetEnvironmentVariable(`$name, `$value, 'Process')
  }
}

if (Test-Path '$escapedEnvPath') {
  foreach (`$rawLine in Get-Content '$escapedEnvPath') {
    `$line = `$rawLine.Trim()
    if (-not `$line -or `$line.StartsWith('#')) {
      continue
    }

    `$match = [regex]::Match(`$line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not `$match.Success) {
      continue
    }

    `$name = `$match.Groups[1].Value
    `$value = `$match.Groups[2].Value.Trim()

    if (`$value.Length -ge 2) {
      `$startsWithDouble = `$value.StartsWith('"')
      `$endsWithDouble = `$value.EndsWith('"')
      `$startsWithSingle = `$value.StartsWith("'")
      `$endsWithSingle = `$value.EndsWith("'")
      if ((`$startsWithDouble -and `$endsWithDouble) -or (`$startsWithSingle -and `$endsWithSingle)) {
        `$value = `$value.Substring(1, `$value.Length - 2)
      }
    }

    [System.Environment]::SetEnvironmentVariable(`$name, `$value, 'Process')
  }
}

if (-not `$env:WORKBENCH_PROMPT_PROVIDER -and `$env:SILICONFLOW_API_KEY) {
  `$env:WORKBENCH_PROMPT_PROVIDER = 'siliconflow-direct'
}

if (-not `$env:SILICONFLOW_MODEL) {
  `$env:SILICONFLOW_MODEL = 'Qwen/Qwen2.5-7B-Instruct'
}

if (-not `$env:PORT) {
  `$env:PORT = '3000'
}

$CommandLine
"@

  Set-Content -Path $bootstrapPath -Value $content -Encoding UTF8
  return $bootstrapPath
}

function Start-ManagedService(
  [string]$Name,
  [string]$CommandLine,
  [int]$Port,
  [string]$Url,
  [int]$TimeoutSeconds = 45
) {
  if (Test-ManagedServiceRunning -Name $Name) {
    $state = Get-ServiceState $Name
    Write-Info "$Name is already running (PID $($state.pid))"
    return
  }

  if (Test-TcpPortOpen -Port $Port) {
    throw "Port $Port is already in use. Please free it or run stop-workbench.ps1 first."
  }

  $stdoutPath = Join-Path $LogDir "$Name.stdout.log"
  $stderrPath = Join-Path $LogDir "$Name.stderr.log"
  $bootstrapPath = New-BootstrapScript -Name $Name -CommandLine $CommandLine

  if (Test-Path $stdoutPath) {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $stderrPath) {
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }

  $process = Start-Process `
    -FilePath $PowerShellExe `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $bootstrapPath) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru `
    -WindowStyle Hidden

  Save-ServiceState -Name $Name -State @{
    pid = $process.Id
    port = $Port
    url = $Url
    command = $CommandLine
    bootstrapPath = $bootstrapPath
    stdoutPath = $stdoutPath
    stderrPath = $stderrPath
    startedAt = (Get-Date).ToString("s")
  }

  if (-not (Wait-TcpPort -Port $Port -TimeoutSeconds $TimeoutSeconds)) {
    $stdoutText = Get-RecentLogText -Path $stdoutPath
    $stderrText = Get-RecentLogText -Path $stderrPath
    if (Test-ManagedServiceRunning -Name $Name) {
      Stop-ManagedService -Name $Name
    } else {
      Remove-ServiceState -Name $Name
    }

    throw @(
      "$Name failed to start on port $Port.",
      "stdout:",
      $stdoutText,
      "stderr:",
      $stderrText
    ) -join [Environment]::NewLine
  }

  Write-Ok "$Name running: $Url"
}

function Stop-ManagedService([string]$Name) {
  $state = Get-ServiceState $Name
  if ($null -eq $state) {
    Write-Info "$Name is not running"
    return
  }

  $processId = [int]$state.pid
  if (Test-ProcessAlive -ProcessId $processId) {
    Write-Info "Stopping $Name (PID $processId)"
    Stop-ProcessTree -ProcessId $processId
    Start-Sleep -Milliseconds 800
  }

  Remove-ServiceState -Name $Name
  Write-Ok "$Name stopped"
}

function Show-WorkbenchStatus {
  Write-Host ""
  Write-Host "Workbench service status" -ForegroundColor Cyan
  Write-Host ""

  if (Test-ManagedServiceRunning -Name "server") {
    $state = Get-ServiceState "server"
    Write-Ok ("server: running (PID {0}, {1})" -f $state.pid, $state.url)
    Write-Ok "frontend: served by backend (http://localhost:3000/workbench)"
  } else {
    Write-WarnLine "server: stopped"
    Write-WarnLine "frontend: unavailable because backend is stopped"
  }

  if (Test-ManagedServiceRunning -Name "web") {
    $state = Get-ServiceState "web"
    Write-WarnLine ("legacy web service still running (PID {0}, {1})" -f $state.pid, $state.url)
  }

  Write-Host ""
  Write-Host ("Server log: {0}" -f (Join-Path $LogDir "server.stdout.log"))
  Write-Host ""
}
function Start-Workbench {
  Assert-RequiredTools
  Initialize-WorkbenchEnvironment
  Show-InfrastructureWarnings

  if (Test-ManagedServiceRunning -Name "web") {
    Write-Info "Stopping legacy frontend service"
    Stop-ManagedService -Name "web"
  } else {
    Remove-ServiceState -Name "web"
  }

  if (-not $SkipBuild) {
    Write-Info "Running pnpm build"
    & pnpm build
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm build failed."
    }
  } else {
    Write-Info "Skipping build"
  }

  Write-Info "Starting backend service"
  Start-ManagedService `
    -Name "server" `
    -CommandLine "node packages/server/dist/index.js" `
    -Port 3000 `
    -Url "http://localhost:3000"

  Write-Host ""
  Write-Ok "Workbench is ready"
  Write-Host "Frontend: http://localhost:3000/workbench"
  Write-Host "Backend:  http://localhost:3000/api"
  Write-Host ""
}
switch ($Action) {
  "start" {
    Start-Workbench
  }
  "stop" {
    Stop-ManagedService -Name "web"
    Stop-ManagedService -Name "server"
    Write-Host ""
    Write-Ok "Workbench services stopped"
  }
  "restart" {
    Stop-ManagedService -Name "web"
    Stop-ManagedService -Name "server"
    Start-Workbench
  }
  "status" {
    Show-WorkbenchStatus
  }
}

