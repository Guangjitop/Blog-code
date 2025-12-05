#!/bin/bash
# ===========================================
# 停止脚本 - Linux/macOS
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  停止账号管理系统"
echo "=========================================="

echo ""
echo "🛑 正在停止容器..."

docker-compose down

echo ""
echo "✅ 所有服务已停止"
echo "=========================================="
