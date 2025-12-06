#!/bin/bash
# ===========================================
# 一键部署脚本 - Linux服务器
# 自动检查端口、拉取镜像、启动服务
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  一键部署 - Docker镜像部署"
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
    echo "或创建 .env.images 文件并设置镜像名称"
    exit 1
fi

# 步骤1: 检查端口
echo "=========================================="
echo "步骤 1/3: 检查端口占用"
echo "=========================================="
echo ""

if [ -f "$SCRIPT_DIR/check-ports.sh" ]; then
    chmod +x "$SCRIPT_DIR/check-ports.sh"
    if ! "$SCRIPT_DIR/check-ports.sh"; then
        echo ""
        echo "❌ 端口检查失败，请解决端口占用问题后重试"
        exit 1
    fi
else
    echo "⚠️  端口检查脚本不存在，跳过端口检查"
    echo "建议手动检查 80/443 端口是否被占用"
fi

echo ""
echo "=========================================="
echo "步骤 2/3: 拉取镜像"
echo "=========================================="
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

echo "📥 正在拉取镜像..."
docker pull "$BACKEND_IMAGE"
if [ $? -ne 0 ]; then
    echo "❌ 后端镜像拉取失败"
    echo "请检查:"
    echo "  1. 镜像名称是否正确: $BACKEND_IMAGE"
    echo "  2. 是否已登录镜像仓库: docker login"
    exit 1
fi
echo "✅ 后端镜像拉取成功"

docker pull "$FRONTEND_IMAGE"
if [ $? -ne 0 ]; then
    echo "❌ 前端镜像拉取失败"
    echo "请检查:"
    echo "  1. 镜像名称是否正确: $FRONTEND_IMAGE"
    echo "  2. 是否已登录镜像仓库: docker login"
    exit 1
fi
echo "✅ 前端镜像拉取成功"

echo ""
echo "=========================================="
echo "步骤 3/3: 启动服务"
echo "=========================================="
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
DOMAIN=${DOMAIN:-localhost}

# 停止旧容器（如果存在）
echo "🛑 停止旧容器（如果存在）..."
$COMPOSE_CMD -f docker-compose.images.yml down 2>/dev/null || true

# 启动服务
echo "🚀 正在启动服务..."
export BACKEND_IMAGE
export FRONTEND_IMAGE
export APP_PORT
export APP_SSL_PORT
export ADMIN_PASSWORD
export DOMAIN

$COMPOSE_CMD -f docker-compose.images.yml -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 部署完成！"
    echo "=========================================="
    echo ""
    echo "📦 镜像信息:"
    echo "   后端: $BACKEND_IMAGE"
    echo "   前端: $FRONTEND_IMAGE"
    echo ""
    echo "🌐 访问地址:"
    if [ "$DOMAIN" != "localhost" ]; then
        echo "   HTTPS: https://$DOMAIN"
        echo "   HTTP:  http://$DOMAIN (自动重定向到HTTPS)"
    else
        echo "   HTTP:  http://localhost:$APP_PORT"
        echo "   HTTPS: https://localhost:$APP_SSL_PORT"
    fi
    echo ""
    echo "📋 常用命令:"
    echo "   查看日志: $COMPOSE_CMD -f docker-compose.images.yml -f docker-compose.prod.yml logs -f"
    echo "   查看状态: $COMPOSE_CMD -f docker-compose.images.yml ps"
    echo "   停止服务: $COMPOSE_CMD -f docker-compose.images.yml down"
    echo "   重启服务: $COMPOSE_CMD -f docker-compose.images.yml restart"
    echo ""
    echo "📝 注意事项:"
    echo "   - 如果使用HTTPS，请确保SSL证书已配置在 deploy/ssl/ 目录"
    echo "   - 如果使用域名，请确保DNS已正确解析"
    echo "   - 确保防火墙已开放 80/443 端口"
    echo "=========================================="
else
    echo ""
    echo "❌ 服务启动失败"
    echo ""
    echo "请检查:"
    echo "  1. 查看错误日志: $COMPOSE_CMD -f docker-compose.images.yml logs"
    echo "  2. 检查端口是否被占用"
    echo "  3. 检查环境变量配置"
    exit 1
fi

