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

$Node = (Get-Command node).Source

& $Node `
  'scripts/feishu-task-runner.mjs' `
  '--config' 'scripts/feishu-task-runner.config.json' `
  '--interval' "$IntervalSeconds" `
  >> $OutLog 2>> $ErrLog
