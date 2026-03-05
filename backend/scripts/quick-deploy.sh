#!/bin/bash

# 快速部署脚本 - 一键安装并启动
# 使用方法: bash quick-deploy.sh

echo "========================================"
echo "  账号管理系统 - 快速部署"
echo "========================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

# 检测Python
print_info "检测 Python 环境..."
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    print_error "未找到 Python，请先安装 Python 3.7+"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
print_info "找到: $PYTHON_VERSION"

# 检查pip
print_info "检查 pip..."
if ! $PYTHON_CMD -m pip --version &> /dev/null; then
    print_error "pip 未安装，请先安装 pip"
    exit 1
fi

# 进入项目目录
cd "$PROJECT_DIR"

# 安装依赖
print_info "安装 Python 依赖..."
if [ -f "requirements.txt" ]; then
    # 尝试正常安装
    if $PYTHON_CMD -m pip install -r requirements.txt 2>/dev/null; then
        print_info "依赖安装完成"
    else
        # 检查是否是 externally-managed-environment 错误
        if $PYTHON_CMD -m pip install -r requirements.txt 2>&1 | grep -q "externally-managed-environment"; then
            print_warning "检测到系统保护的 Python 环境 (PEP 668)"
            print_info "尝试使用 --break-system-packages 安装..."
            
            if $PYTHON_CMD -m pip install --break-system-packages -r requirements.txt; then
                print_info "依赖安装完成 (使用 --break-system-packages)"
            else
                print_error "依赖安装失败"
                echo ""
                print_info "建议使用以下方法之一:"
                echo "  1. 使用虚拟环境 (推荐):"
                echo "     python3 -m venv venv"
                echo "     source venv/bin/activate"
                echo "     pip install -r requirements.txt"
                echo ""
                echo "  2. 使用系统包管理器:"
                echo "     sudo apt install python3-fastapi python3-uvicorn"
                exit 1
            fi
        else
            print_error "依赖安装失败"
            exit 1
        fi
    fi
else
    print_error "未找到 requirements.txt"
    exit 1
fi

# 构建前端（确保拉取代码后前端变更生效）
print_info "检查前端构建环境..."
FRONTEND_DIR="$(dirname "$PROJECT_DIR")/frontend"

if [ -d "$FRONTEND_DIR" ]; then
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        print_info "检测到 Node.js，开始构建前端..."
        pushd "$FRONTEND_DIR" >/dev/null

        if [ ! -d "node_modules" ]; then
            print_info "安装前端依赖..."
            npm ci || npm install || {
                print_error "前端依赖安装失败"
                popd >/dev/null
                exit 1
            }
        fi

        print_info "执行前端构建..."
        npm run build || {
            print_error "前端构建失败"
            popd >/dev/null
            exit 1
        }
        popd >/dev/null
        print_info "前端构建完成"
    else
        if [ -f "$(dirname "$PROJECT_DIR")/frontend/dist/index.html" ]; then
            print_warning "未检测到 Node.js/npm，跳过前端构建，将使用现有 dist 产物"
        else
            print_error "未检测到 Node.js/npm，且不存在 frontend/dist，无法继续部署"
            exit 1
        fi
    fi
else
    print_warning "未找到前端目录: $FRONTEND_DIR，跳过前端构建"
fi

# 设置脚本执行权限
print_info "设置脚本执行权限..."
chmod +x "$SCRIPT_DIR/deploy.sh"

# 启动服务
print_info "启动服务..."
"$SCRIPT_DIR/deploy.sh" start

echo ""
echo "========================================"
print_info "部署完成!"
echo "========================================"
echo ""
echo "常用命令:"
echo "  查看状态: $SCRIPT_DIR/deploy.sh status"
echo "  查看日志: $SCRIPT_DIR/deploy.sh logs"
echo "  停止服务: $SCRIPT_DIR/deploy.sh stop"
echo "  重启服务: $SCRIPT_DIR/deploy.sh restart"
echo ""
