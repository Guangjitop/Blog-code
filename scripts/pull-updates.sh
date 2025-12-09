#!/bin/bash
# ===========================================
# 拉取远程仓库更新脚本
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "  拉取远程仓库更新"
echo "=========================================="
echo ""

# 检查是否在Git仓库中
if [ ! -d ".git" ]; then
    echo "❌ 错误: 当前目录不是Git仓库"
    echo "请先克隆仓库:"
    echo "  git clone https://github.com/Guangjitop/Blog-code.git"
    exit 1
fi

# 检查远程仓库配置
if ! git remote get-url origin &>/dev/null; then
    echo "⚠️  未配置远程仓库，正在添加..."
    git remote add origin https://github.com/Guangjitop/Blog-code.git
fi

echo "📋 当前状态:"
git status -sb
echo ""

# 检查是否有未提交的修改
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  检测到未提交的修改"
    echo ""
    read -p "是否暂存当前修改后拉取? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 暂存当前修改..."
        git stash
        STASHED=true
    else
        echo "❌ 取消操作"
        exit 1
    fi
fi

echo ""
echo "📥 正在拉取远程更新..."
git fetch origin

# 检查是否有更新
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ $LOCAL = $REMOTE ]; then
    echo "✅ 本地代码已是最新版本"
elif [ $LOCAL = $BASE ]; then
    echo "📥 发现新更新，正在合并..."
    git pull origin main
    echo "✅ 更新完成！"
elif [ $REMOTE = $BASE ]; then
    echo "⚠️  本地有未推送的提交"
    echo "请先推送本地提交或合并远程更新"
else
    echo "⚠️  本地和远程都有新提交，需要合并"
    git pull origin main
fi

# 如果有暂存的修改，恢复它们
if [ "$STASHED" = true ]; then
    echo ""
    echo "📦 恢复暂存的修改..."
    git stash pop
fi

echo ""
echo "=========================================="
echo "✅ 更新完成！"
echo ""
echo "📋 当前状态:"
git status -sb
echo "=========================================="









