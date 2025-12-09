#!/bin/bash
# ===========================================
# 拉取镜像并启动脚本 - Linux服务器
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  Docker 镜像拉取和启动"
echo "=========================================="
echo ""

# 检查必要的环境变量
if [ -z "$BACKEND_IMAGE" ] || [ -z "$FRONTEND_IMAGE" ]; then
    echo "❌ 错误: 未设置镜像环境变量"
    echo ""
    echo "请设置以下环境变量:"
    echo "  export BACKEND_IMAGE=\"docker.io/username/blog-backend:latest\""
    echo "  export FRONTEND_IMAGE=\"docker.io/username/blog-frontend:latest\""
    echo ""
    echo "或创建 .env.images 文件并设置:"
    echo "  BACKEND_IMAGE=docker.io/username/blog-backend:latest"
    echo "  FRONTEND_IMAGE=docker.io/username/blog-frontend:latest"
    exit 1
fi

echo "📦 镜像配置:"
echo "   后端镜像: $BACKEND_IMAGE"
echo "   前端镜像: $FRONTEND_IMAGE"
echo ""

# 检查Docker和Docker Compose
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ 错误: 未安装 Docker"
    echo "请先安装 Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo "❌ 错误: 未安装 Docker Compose"
    echo "请先安装 Docker Compose"
    exit 1
fi

# 检查docker-compose命令
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "=========================================="
echo ""

# 拉取镜像
echo "📥 正在拉取镜像..."
docker pull "$BACKEND_IMAGE"
if [ $? -ne 0 ]; then
    echo "❌ 后端镜像拉取失败"
    exit 1
fi
echo "✅ 后端镜像拉取成功"

docker pull "$FRONTEND_IMAGE"
if [ $? -ne 0 ]; then
    echo "❌ 前端镜像拉取失败"
    exit 1
fi
echo "✅ 前端镜像拉取成功"
echo ""

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，使用默认配置"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已从模板创建 .env 文件"
    fi
fi

# 加载环境变量
if [ -f ".env" ]; then
    source .env
fi

# 设置默认值
APP_PORT=${APP_PORT:-80}
APP_SSL_PORT=${APP_SSL_PORT:-443}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin121}

echo "=========================================="
echo ""

# 启动服务
echo "🚀 正在启动服务..."
export BACKEND_IMAGE
export FRONTEND_IMAGE
export APP_PORT
export APP_SSL_PORT
export ADMIN_PASSWORD

$COMPOSE_CMD -f docker-compose.images.yml -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 服务启动成功！"
    echo ""
    echo "📋 服务信息:"
    echo "   后端镜像: $BACKEND_IMAGE"
    echo "   前端镜像: $FRONTEND_IMAGE"
    echo ""
    echo "🌐 访问地址:"
    DOMAIN=${DOMAIN:-localhost}
    if [ "$DOMAIN" != "localhost" ]; then
        echo "   HTTPS: https://$DOMAIN"
        echo "   HTTP:  http://$DOMAIN (自动重定向到HTTPS)"
    else
        echo "   HTTP:  http://localhost:$APP_PORT"
        echo "   HTTPS: https://localhost:$APP_SSL_PORT"
    fi
    echo ""
    echo "📋 常用命令:"
    echo "   查看日志: $COMPOSE_CMD -f docker-compose.images.yml logs -f"
    echo "   停止服务: $COMPOSE_CMD -f docker-compose.images.yml down"
    echo "   重启服务: $COMPOSE_CMD -f docker-compose.images.yml restart"
    echo "=========================================="
else
    echo ""
    echo "❌ 服务启动失败"
    echo "请检查日志: $COMPOSE_CMD -f docker-compose.images.yml logs"
    exit 1
fi









