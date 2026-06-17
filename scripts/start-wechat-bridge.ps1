param(
  [int]$IntervalSeconds = 120
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env.wechat-bridge'
$LogDir = Join-Path $Root 'logs'
$OutLog = Join-Path $LogDir 'wechat-bridge.out.log'
$ErrLog = Join-Path $LogDir 'wechat-bridge.err.log'

if (!(Test-Path -LiteralPath $EnvFile)) {
  throw "Missing env file: $EnvFile"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $Root

$Node = (Get-Command node).Source

& $Node `
  'scripts/wechat-message-bridge.mjs' `
  '--config' 'scripts/wechat-feedback-sources.example.json' `
  '--env-file' '.env.wechat-bridge' `
  '--watch' `
  '--from' '1d' `
  '--interval' "$IntervalSeconds" `
  '--output' 'tmp/wechat-message-bridge-watch' `
  >> $OutLog 2>> $ErrLog
