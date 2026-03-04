#!/bin/bash
# ==========================================
# Docker 环境检查脚本 (Linux)
# ==========================================

echo "========================================"
echo "  Docker 环境检查"
echo "========================================"
echo ""

# 检查 Docker 是否安装
if command -v docker &>/dev/null; then
    echo "[√] Docker 已安装"
    docker --version
else
    echo "[X] Docker 未安装"
    echo "    请安装 Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

echo ""

# 检查 Docker 是否运行
if docker info &>/dev/null; then
    echo "[√] Docker 正在运行"
else
    echo "[X] Docker 未运行"
    echo "    请启动 Docker: sudo systemctl start docker"
    exit 1
fi

echo ""

# 检查 docker-compose 是否可用
if command -v docker-compose &>/dev/null; then
    echo "[√] docker-compose 可用"
    docker-compose --version
elif docker compose version &>/dev/null; then
    echo "[√] docker compose 可用"
    docker compose version
else
    echo "[X] docker-compose 不可用"
    exit 1
fi

echo ""

# 检查容器状态
cd "$(dirname "$0")/../deploy"
echo "当前容器状态："
echo ""
docker-compose ps 2>/dev/null || docker compose ps

echo ""
echo "========================================"
echo "  环境检查完成"
echo "========================================"
echo ""
echo "如果所有检查都通过，可以运行："
echo "  bash scripts/start-docker.sh"
echo ""
