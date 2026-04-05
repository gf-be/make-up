@echo off
echo 正在停止所有Node.js进程...
taskkill /F /IM node.exe /T
timeout /t 2 /nobreak >nul
echo.
echo 启动后端服务器...
cd /d f:\daoke\化妆品\backend
node server_v2.js
