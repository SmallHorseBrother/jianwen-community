param(
  [int]$Port = 47831
)

$ErrorActionPreference = 'Stop'

$ToolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ToolRoot '..\..')
$Server = Join-Path $ToolRoot 'server.mjs'
$Index = Join-Path $ToolRoot 'dist\index.html'
$LogDir = Join-Path $RepoRoot 'logs'
$OutLog = Join-Path $LogDir 'feishu-codex-console.out.log'
$ErrLog = Join-Path $LogDir 'feishu-codex-console.err.log'

if (-not (Test-Path $Index)) {
  throw '任务台前端尚未构建，请先运行：npx vite build --config tools/feishu-codex-console/vite.config.ts'
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $RepoRoot

$ExistingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($ExistingListener) {
  exit 0
}

$Node = (Get-Command node).Source
$Process = Start-Process `
  -FilePath $Node `
  -ArgumentList @($Server, "$Port") `
  -WorkingDirectory $RepoRoot `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 2
if ($Process.HasExited) {
  throw "任务台服务启动失败，退出码：$($Process.ExitCode)"
}
