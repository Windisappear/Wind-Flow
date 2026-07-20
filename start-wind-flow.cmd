@echo off
setlocal
cd /d "%~dp0"

set "CODEX_RUNTIME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies"
if exist "%CODEX_RUNTIME%\node\bin\node.exe" set "PATH=%CODEX_RUNTIME%\node\bin;%CODEX_RUNTIME%\bin\override;%CODEX_RUNTIME%\bin\fallback;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo [Wind Flow] Node.js was not found in PATH or the Codex runtime.
  echo Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [Wind Flow] pnpm was not found. Run: npm install -g pnpm
  pause
  exit /b 1
)

if not exist ".env" (
  echo [Wind Flow] The root .env file is missing. Configure provider API keys first.
  pause
  exit /b 1
)

call :free_port 3233 API
if errorlevel 1 exit /b 1
call :free_port 5173 Web
if errorlevel 1 exit /b 1

echo [Wind Flow] Starting API and web development servers...
start "Wind Flow API" powershell.exe -NoExit -NoProfile -Command "$Host.UI.RawUI.WindowTitle='Wind Flow API'; Set-Location -LiteralPath '%~dp0'; $env:PORT='3233'; pnpm --filter @canvas/api dev"
start "Wind Flow Web" powershell.exe -NoExit -NoProfile -Command "$Host.UI.RawUI.WindowTitle='Wind Flow Web'; Set-Location -LiteralPath '%~dp0'; pnpm --filter @canvas/web dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0

:free_port
powershell.exe -NoProfile -Command "$connection = Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $connection) { exit 0 }; $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue; if ($process.ProcessName -eq 'node') { Stop-Process -Id $process.Id -Force; Start-Sleep -Milliseconds 300; exit 0 }; exit 1"
if errorlevel 1 (
  echo [Wind Flow] %~2 port %~1 is used by a non-Node process. Close it and try again.
  pause
  exit /b 1
)
exit /b 0
