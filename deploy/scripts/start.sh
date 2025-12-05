#!/bin/bash
# ===========================================
# 启动脚本 - Linux/macOS
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  账号管理系统 - Docker 部署"
echo "=========================================="

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，正在从模板创建..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请根据需要修改配置"
fi

# 加载环境变量
source .env

echo ""
echo "📦 正在构建并启动容器..."
echo ""

# 构建并启动
docker-compose up -d --build

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   欢迎页: http://${DOMAIN:-localhost}:${APP_PORT:-80}/"
echo "   应用:   http://${DOMAIN:-localhost}:${APP_PORT:-80}/app/"
echo "   API文档: http://${DOMAIN:-localhost}:${APP_PORT:-80}/docs"
echo ""
echo "📋 常用命令:"
echo "   查看日志: ./scripts/logs.sh"
echo "   停止服务: ./scripts/stop.sh"
echo "=========================================="
