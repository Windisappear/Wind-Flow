$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.wind-flow.pid'
$runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'

Set-Location -LiteralPath $root
$Host.UI.RawUI.WindowTitle = 'Wind Flow'

if (Test-Path (Join-Path $runtime 'node\bin\node.exe')) {
  $env:PATH = @(
    (Join-Path $runtime 'node\bin')
    (Join-Path $runtime 'bin\override')
    (Join-Path $runtime 'bin\fallback')
    $env:PATH
  ) -join ';'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found in PATH or the Codex runtime.' }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'pnpm was not found. Run: npm install -g pnpm' }
if (-not (Test-Path (Join-Path $root '.env'))) { throw 'The root .env file is missing.' }

if (Test-Path $pidFile) {
  $oldPid = [int](Get-Content $pidFile -ErrorAction SilentlyContinue)
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    throw "Wind Flow is already running with PID $oldPid. Run stop-wind-flow.cmd first."
  }
  Remove-Item -LiteralPath $pidFile -Force
}

$busyPorts = 3233, 5173 | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue }
if ($busyPorts) { throw "Required port(s) are already in use: $($busyPorts -join ', '). Stop the owning application first." }

$env:PORT = '3233'
$server = $null

try {
  Write-Host '[Wind Flow] Starting API and web servers in one managed process...' -ForegroundColor Cyan
  Write-Host '[Wind Flow] Press Ctrl+C once to stop all services.' -ForegroundColor DarkGray
  $server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/s', '/c', 'pnpm dev' -NoNewWindow -PassThru
  $server.Id | Set-Content -LiteralPath $pidFile -Encoding ascii

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline -and -not $server.HasExited) {
    if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
      Start-Process 'http://localhost:5173'
      break
    }
    Start-Sleep -Milliseconds 300
  }

  $server.WaitForExit()
  exit $server.ExitCode
}
finally {
  if ($server -and -not $server.HasExited) {
    & taskkill.exe /PID $server.Id /T /F 2>$null | Out-Null
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
