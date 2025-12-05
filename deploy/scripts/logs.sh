#!/bin/bash
# ===========================================
# 日志查看脚本 - Linux/macOS
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  账号管理系统 - 日志查看"
echo "=========================================="
echo ""
echo "按 Ctrl+C 退出日志查看"
echo ""

# 查看所有服务日志，跟踪模式
docker-compose logs -f --tail=100
