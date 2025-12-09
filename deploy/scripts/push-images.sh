#!/bin/bash
# ===========================================
# 推送Docker镜像到仓库脚本
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEPLOY_DIR"

echo "=========================================="
echo "  Docker 镜像推送"
echo "=========================================="
echo ""

# 检查.env.images文件
ENV_IMAGES_FILE="$DEPLOY_DIR/.env.images"
if [ ! -f "$ENV_IMAGES_FILE" ]; then
    echo "❌ 错误: 未找到 .env.images 文件"
    echo "请先运行 ./scripts/build-images.sh 构建镜像"
    exit 1
fi

# 加载环境变量
source "$ENV_IMAGES_FILE"

# 检查必要的环境变量
if [ -z "$IMAGE_REGISTRY" ] || [ -z "$IMAGE_USERNAME" ]; then
    echo "❌ 错误: .env.images 文件中缺少必要的配置"
    exit 1
fi

# 设置默认值
IMAGE_TAG=${IMAGE_TAG:-latest}
IMAGE_REGISTRY=${IMAGE_REGISTRY:-docker.io}

# 构建镜像名称
BACKEND_IMAGE="${IMAGE_REGISTRY}/${IMAGE_USERNAME}/blog-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${IMAGE_REGISTRY}/${IMAGE_USERNAME}/blog-frontend:${IMAGE_TAG}"

echo "📦 准备推送镜像:"
echo "   后端镜像: $BACKEND_IMAGE"
echo "   前端镜像: $FRONTEND_IMAGE"
echo ""

# 检查镜像是否存在
if ! docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1; then
    echo "❌ 错误: 后端镜像不存在: $BACKEND_IMAGE"
    echo "请先运行 ./scripts/build-images.sh 构建镜像"
    exit 1
fi

if ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
    echo "❌ 错误: 前端镜像不存在: $FRONTEND_IMAGE"
    echo "请先运行 ./scripts/build-images.sh 构建镜像"
    exit 1
fi

# 检查Docker登录状态
echo "🔐 检查Docker登录状态..."
if [ "$IMAGE_REGISTRY" = "docker.io" ]; then
    # Docker Hub
    if ! docker info | grep -q "Username"; then
        echo "⚠️  未检测到Docker Hub登录状态"
        echo "正在尝试登录..."
        docker login
    fi
else
    # 私有仓库
    echo "⚠️  请确保已登录到镜像仓库: $IMAGE_REGISTRY"
    echo "如需登录，请运行: docker login $IMAGE_REGISTRY"
    read -p "是否已登录? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "请先登录后再运行此脚本"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo ""

# 推送后端镜像
echo "📤 正在推送后端镜像..."
docker push "$BACKEND_IMAGE"
if [ $? -eq 0 ]; then
    echo "✅ 后端镜像推送成功: $BACKEND_IMAGE"
else
    echo "❌ 后端镜像推送失败"
    exit 1
fi
echo ""

# 推送前端镜像
echo "📤 正在推送前端镜像..."
docker push "$FRONTEND_IMAGE"
if [ $? -eq 0 ]; then
    echo "✅ 前端镜像推送成功: $FRONTEND_IMAGE"
else
    echo "❌ 前端镜像推送失败"
    exit 1
fi
echo ""

echo "=========================================="
echo "✅ 所有镜像推送完成！"
echo ""
echo "📋 镜像信息:"
echo "   后端: $BACKEND_IMAGE"
echo "   前端: $FRONTEND_IMAGE"
echo ""
echo "📋 在Linux服务器上使用以下命令拉取运行:"
echo "   export BACKEND_IMAGE=\"$BACKEND_IMAGE\""
echo "   export FRONTEND_IMAGE=\"$FRONTEND_IMAGE\""
echo "   ./scripts/pull-and-run.sh"
echo "=========================================="









