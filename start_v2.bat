@echo off
chcp 65001 >nul
echo ========================================
echo   化妆品资讯系统 v2.0 启动脚本
echo ========================================
echo.

echo [1/3] 检查数据库连接...
mysql -u root -pqwaszx12 -e "USE cosmetics_info; SHOW TABLES;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ 数据库连接失败，请检查MySQL服务和密码
    pause
    exit /b 1
)
echo ✓ 数据库连接成功
echo.

echo [2/3] 启动后端服务...
cd backend
start "后端服务" cmd /k "node server_v2.js"
timeout /t 3 /nobreak >nul
echo ✓ 后端服务启动中 (端口 3000)
echo.

echo [3/3] 启动前端服务...
cd ..\frontend
start "前端服务" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
echo ✓ 前端服务启动中 (端口 5173)
echo.

echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 后端地址: http://localhost:3000
echo 前端地址: http://localhost:5173
echo.
echo 按任意键关闭此窗口（服务将继续运行）
pause >nul
