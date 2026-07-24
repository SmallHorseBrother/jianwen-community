param(
  [int]$IntervalSeconds = 300
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root 'logs'
$OutLog = Join-Path $LogDir 'feishu-task-runner.out.log'
$ErrLog = Join-Path $LogDir 'feishu-task-runner.err.log'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $Root

$ExistingRunner = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'feishu-task-runner\.mjs'
}
if ($ExistingRunner) {
  exit 0
}

$Node = (Get-Command node).Source

$Process = Start-Process `
  -FilePath $Node `
  -ArgumentList @(
    'scripts/feishu-task-runner.mjs',
    '--config',
    'scripts/feishu-task-runner.config.json',
    '--interval',
    "$IntervalSeconds"
  ) `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 2
if ($Process.HasExited) {
  throw "飞书任务 runner 启动失败，退出码：$($Process.ExitCode)"
}
