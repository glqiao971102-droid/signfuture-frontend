@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE=C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

rem Build once if there is no production build yet.
if not exist ".next\BUILD_ID" (
  echo Building Sign Studio, please wait...
  "%NODE%" ".\node_modules\next\dist\bin\next" build
)

echo Starting Sign Studio in the background at http://localhost:3000/
rem Launch detached/hidden so closing this window does NOT stop the site.
powershell -NoProfile -Command "Start-Process -FilePath '%NODE%' -ArgumentList '.\node_modules\next\dist\bin\next','start','-p','3000' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
echo.
echo Done. Open http://localhost:3000/ in your browser.
echo (To stop the site later, run stop-server.cmd)
timeout /t 4 >nul
start "" "http://localhost:3000/"
