#!/bin/bash

echo "========================================"
echo "  化妆品资讯系统 v2.0 启动脚本"
echo "========================================"
echo ""

echo "[1/3] 检查数据库连接..."
mysql -u root -pqwaszx12 -e "USE cosmetics_info; SHOW TABLES;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "✗ 数据库连接失败，请检查MySQL服务和密码"
    exit 1
fi
echo "✓ 数据库连接成功"
echo ""

echo "[2/3] 启动后端服务..."
cd backend
gnome-terminal -- bash -c "node server_v2.js" &
sleep 3
echo "✓ 后端服务启动中 (端口 3000)"
echo ""

echo "[3/3] 启动前端服务..."
cd ../frontend
gnome-terminal -- bash -c "npm run dev" &
sleep 3
echo "✓ 前端服务启动中 (端口 5173)"
echo ""

echo "========================================"
echo "  启动完成！"
echo "========================================"
echo ""
echo "后端地址: http://localhost:3000"
echo "前端地址: http://localhost:5173"
echo ""
