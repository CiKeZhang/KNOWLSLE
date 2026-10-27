@echo off
title KNOWLSLE Backend
cd /d "%~dp0"
set "NODE_EXE=C:\Program Files\Lenovo\AIAgent\mcp\node-v24.18.0-win-x64\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
if not exist "dist\src\main.js" (
  echo [ERROR] dist\src\main.js not found. This bat must stay in the backend folder.
  pause
  exit /b 1
)
echo ================================================
echo   KNOWLSLE backend starting... keep this window open
echo   API: http://localhost:3000/api
echo ================================================
echo.
"%NODE_EXE%" dist\src\main.js
echo.
echo Backend stopped. Copy the error above and send it back.
pause
