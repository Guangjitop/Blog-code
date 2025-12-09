#!/bin/bash
# ===========================================
# 构建Docker镜像脚本 - Linux/macOS
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "  Docker 镜像构建"
echo "=========================================="
echo ""

# 检查.env.images文件
ENV_IMAGES_FILE="$DEPLOY_DIR/.env.images"
if [ ! -f "$ENV_IMAGES_FILE" ]; then
    echo "⚠️  未找到 .env.images 文件"
    echo "正在从模板创建..."
    if [ -f "$DEPLOY_DIR/.env.images.example" ]; then
        cp "$DEPLOY_DIR/.env.images.example" "$ENV_IMAGES_FILE"
        echo "✅ 已创建 .env.images 文件，请编辑配置后再运行此脚本"
        exit 1
    else
        echo "❌ 未找到 .env.images.example 模板文件"
        exit 1
    fi
fi

# 加载环境变量
source "$ENV_IMAGES_FILE"

# 检查必要的环境变量
if [ -z "$IMAGE_REGISTRY" ] || [ -z "$IMAGE_USERNAME" ]; then
    echo "❌ 错误: .env.images 文件中缺少必要的配置"
    echo "请设置 IMAGE_REGISTRY 和 IMAGE_USERNAME"
    exit 1
fi

# 设置默认值
IMAGE_TAG=${IMAGE_TAG:-latest}
IMAGE_REGISTRY=${IMAGE_REGISTRY:-docker.io}

# 构建镜像名称
BACKEND_IMAGE="${IMAGE_REGISTRY}/${IMAGE_USERNAME}/blog-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${IMAGE_REGISTRY}/${IMAGE_USERNAME}/blog-frontend:${IMAGE_TAG}"

echo "📦 镜像配置:"
echo "   仓库: $IMAGE_REGISTRY"
echo "   用户: $IMAGE_USERNAME"
echo "   标签: $IMAGE_TAG"
echo ""
echo "   后端镜像: $BACKEND_IMAGE"
echo "   前端镜像: $FRONTEND_IMAGE"
echo ""
echo "=========================================="
echo ""

# 构建后端镜像
echo "🔨 正在构建后端镜像..."
docker build \
    -f "$DEPLOY_DIR/Dockerfile.backend" \
    -t "$BACKEND_IMAGE" \
    "$PROJECT_ROOT"

echo "✅ 后端镜像构建完成: $BACKEND_IMAGE"
echo ""

# 构建前端镜像
echo "🔨 正在构建前端镜像..."
docker build \
    -f "$DEPLOY_DIR/Dockerfile.frontend" \
    -t "$FRONTEND_IMAGE" \
    "$PROJECT_ROOT"

echo "✅ 前端镜像构建完成: $FRONTEND_IMAGE"
echo ""

echo "=========================================="
echo "✅ 所有镜像构建完成！"
echo ""
echo "📋 下一步:"
echo "   运行 ./scripts/push-images.sh 推送镜像到仓库"
echo "=========================================="









