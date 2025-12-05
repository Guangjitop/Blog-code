#!/bin/bash

echo "========================================"
echo "  一键推送到 GitHub"
echo "  目标仓库: https://github.com/Guangjitop/Blog-code"
echo "========================================"
echo

# 检查是否已初始化 Git
if [ ! -d ".git" ]; then
    echo "[INFO] 初始化 Git 仓库..."
    git init
    echo
fi

# 检查远程仓库配置
if ! git remote get-url origin &>/dev/null; then
    echo "[INFO] 添加远程仓库..."
    git remote add origin https://github.com/Guangjitop/Blog-code.git
else
    echo "[INFO] 更新远程仓库地址..."
    git remote set-url origin https://github.com/Guangjitop/Blog-code.git
fi
echo

# 添加所有文件
echo "[INFO] 添加所有更改..."
git add .
echo

# 提交更改
read -p "请输入提交信息 (直接回车使用默认信息): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Update $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "[INFO] 提交更改: $commit_msg"
git commit -m "$commit_msg"
echo

# 推送到远程仓库
echo "[INFO] 推送到 GitHub..."
if ! git push -u origin main; then
    echo "[WARN] main 分支推送失败，尝试 master 分支..."
    git push -u origin master
fi
echo

echo "========================================"
echo "  推送完成！"
echo "========================================"
