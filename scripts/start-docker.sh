#!/bin/bash
# ==========================================
# Docker 开发环境启动脚本 (Linux)
# ==========================================

echo "========================================"
echo "  启动 Docker 开发环境"
echo "========================================"
echo ""

# 检查 Docker 是否运行
docker info >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "[错误] Docker 未运行，请先启动 Docker"
    exit 1
fi

echo "[1/4] 检查 Docker 状态... OK"
echo ""

# 进入 deploy 目录
cd "$(dirname "$0")/../deploy"

echo "[2/4] 停止现有容器..."
docker-compose down 2>/dev/null || docker compose down
echo ""

echo "[3/4] 构建并启动服务..."
echo "这可能需要几分钟时间，请耐心等待..."
echo ""
docker-compose up -d --build 2>/dev/null || docker compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "[错误] 启动失败，请检查错误信息"
    exit 1
fi

echo ""
echo "[4/4] 等待服务启动..."
sleep 10

echo ""
echo "========================================"
echo "  服务启动成功！"
echo "========================================"
echo ""
echo "访问地址："
echo "  - 前端首页:     http://localhost:8998/"
echo "  - 管理后台:     http://localhost:8998/app/"
echo "  - 后端API文档:  http://localhost:8999/docs"
echo "  - 健康检查:     http://localhost:8999/api/music/health"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo ""

# 显示容器状态
echo "容器状态："
docker-compose ps 2>/dev/null || docker compose ps
echo ""
