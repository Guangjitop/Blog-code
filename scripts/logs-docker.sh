#!/bin/bash
# ==========================================
# Docker 日志查看脚本 (Linux)
# ==========================================

echo "========================================"
echo "  查看 Docker 服务日志"
echo "========================================"
echo ""
echo "按 Ctrl+C 退出日志查看"
echo ""

# 进入 deploy 目录
cd "$(dirname "$0")/../deploy"

# 查看所有服务的日志
docker-compose logs -f --tail=100 2>/dev/null || docker compose logs -f --tail=100
