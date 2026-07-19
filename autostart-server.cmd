@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE=C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

rem If port 3000 is already serving, do nothing (avoid double-start).
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }"
if %errorlevel%==0 exit /b 0

rem Build once if there is no production build yet.
if not exist ".next\BUILD_ID" "%NODE%" ".\node_modules\next\dist\bin\next" build

rem Run the production server (this process stays alive = the website stays up).
"%NODE%" ".\node_modules\next\dist\bin\next" start -p 3000
