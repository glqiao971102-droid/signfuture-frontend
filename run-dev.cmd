@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE=C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo Starting Sign Studio (dev) at http://localhost:3000/
"%NODE%" ".\node_modules\next\dist\bin\next" dev
pause
