$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.wind-flow.pid'

if (-not (Test-Path $pidFile)) {
  Write-Host '[Wind Flow] No managed development process is running.'
  exit 0
}

$windFlowPid = [int](Get-Content $pidFile)
$process = Get-Process -Id $windFlowPid -ErrorAction SilentlyContinue
if ($process) {
  & taskkill.exe /PID $windFlowPid /T /F | Out-Null
  Write-Host '[Wind Flow] All development processes were stopped.' -ForegroundColor Green
} else {
  Write-Host '[Wind Flow] Removed a stale PID file.' -ForegroundColor Yellow
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
