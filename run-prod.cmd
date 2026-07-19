@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE=C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo Building Sign Studio...
"%NODE%" ".\node_modules\next\dist\bin\next" build
if errorlevel 1 goto :eof
echo Starting Sign Studio (production) at http://localhost:3000/
"%NODE%" ".\node_modules\next\dist\bin\next" start
pause
