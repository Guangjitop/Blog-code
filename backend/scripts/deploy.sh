#!/bin/bash

# 账号管理系统部署脚本 (Linux)
# 使用方法: ./deploy.sh [start|stop|restart|status|logs]


APP_NAME="账号管理系统"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/app.pid"
LOG_FILE="$PROJECT_DIR/app.log"
ERROR_LOG_FILE="$PROJECT_DIR/error.log"
MAIN_FILE="$PROJECT_DIR/main.py"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印彩色信息
print_info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

# 检测Python命令
detect_python() {
    if command -v python3 &> /dev/null; then
        echo "python3"
    elif command -v python &> /dev/null; then
        # 检查python版本是否为3.x
        if python -c 'import sys; exit(0 if sys.version_info >= (3, 7) else 1)' 2>/dev/null; then
            echo "python"
        else
            print_error "需要 Python 3.7 或更高版本"
            exit 1
        fi
    else
        print_error "未找到 Python，请先安装 Python 3.7+"
        exit 1
    fi
}

PYTHON_CMD=$(detect_python)

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    # 检查main.py是否存在
    if [ ! -f "$MAIN_FILE" ]; then
        print_error "未找到 main.py 文件: $MAIN_FILE"
        exit 1
    fi
    
    # 检查Python模块
    if ! $PYTHON_CMD -c "import fastapi, uvicorn" 2>/dev/null; then
        print_warning "缺少必要的Python模块"
        print_info "正在安装依赖..."
        
        if [ -f "$PROJECT_DIR/requirements.txt" ]; then
            # 尝试正常安装
            if $PYTHON_CMD -m pip install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null; then
                print_info "依赖安装完成"
            else
                # 检查是否是 externally-managed-environment 错误
                if $PYTHON_CMD -m pip install -r "$PROJECT_DIR/requirements.txt" 2>&1 | grep -q "externally-managed-environment"; then
                    print_warning "检测到系统保护的 Python 环境 (PEP 668)"
                    print_info "尝试使用 --break-system-packages 安装..."
                    
                    $PYTHON_CMD -m pip install --break-system-packages -r "$PROJECT_DIR/requirements.txt" || {
                        print_error "依赖安装失败"
                        echo ""
                        print_info "建议手动运行:"
                        echo "  $PYTHON_CMD -m pip install --break-system-packages -r requirements.txt"
                        exit 1
                    }
                    print_info "依赖安装完成 (使用 --break-system-packages)"
                else
                    print_error "依赖安装失败，请手动运行: $PYTHON_CMD -m pip install -r requirements.txt"
                    exit 1
                fi
            fi
        else
            print_error "未找到 requirements.txt 文件"
            exit 1
        fi
    fi
    
    print_info "依赖检查完成"
}

# 检查服务状态
check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0  # 运行中
        else
            return 1  # PID文件存在但进程不存在
        fi
    else
        return 2  # PID文件不存在
    fi
}

# 启动服务
start_service() {
    check_status
    status=$?
    
    if [ $status -eq 0 ]; then
        PID=$(cat "$PID_FILE")
        print_warning "$APP_NAME 已在运行中 (PID: $PID)"
        return 1
    fi
    
    # 检查依赖
    check_dependencies
    
    print_info "正在启动 $APP_NAME..."
    
    # 进入项目目录
    cd "$PROJECT_DIR"
    
    # 后台启动服务
    nohup $PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8999 > "$LOG_FILE" 2> "$ERROR_LOG_FILE" &
    PID=$!
    
    # 保存PID
    echo $PID > "$PID_FILE"
    
    # 等待2秒检查是否成功启动
    sleep 2
    
    if ps -p "$PID" > /dev/null 2>&1; then
        print_info "$APP_NAME 启动成功!"
        print_info "PID: $PID"
        print_info "日志文件: $LOG_FILE"
        print_info "错误日志: $ERROR_LOG_FILE"
        print_info "访问地址: http://localhost:8999"
        print_info ""
        print_info "提示: 使用 '$0 logs' 查看运行日志"
    else
        print_error "$APP_NAME 启动失败，请查看错误日志: $ERROR_LOG_FILE"
        if [ -f "$ERROR_LOG_FILE" ]; then
            print_error "最近的错误信息:"
            tail -n 20 "$ERROR_LOG_FILE"
        fi
        rm -f "$PID_FILE"
        return 1
    fi
}

# 停止服务
stop_service() {
    check_status
    status=$?
    
    if [ $status -eq 2 ]; then
        print_warning "$APP_NAME 未运行"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    
    if [ $status -eq 1 ]; then
        print_warning "PID文件存在但进程已停止，清理PID文件"
        rm -f "$PID_FILE"
        return 0
    fi
    
    print_info "正在停止 $APP_NAME (PID: $PID)..."
    
    # 发送TERM信号
    kill "$PID"
    
    # 等待进程结束
    for i in {1..10}; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            print_info "$APP_NAME 已停止"
            rm -f "$PID_FILE"
            return 0
        fi
        sleep 1
    done
    
    # 如果还没停止，强制终止
    print_warning "进程未响应，强制终止..."
    kill -9 "$PID"
    rm -f "$PID_FILE"
    print_info "$APP_NAME 已强制停止"
}

# 重启服务
restart_service() {
    print_info "正在重启 $APP_NAME..."
    stop_service
    sleep 2
    start_service
}

# 查看状态
show_status() {
    check_status
    status=$?
    
    echo "========================================"
    echo "  $APP_NAME 状态"
    echo "========================================"
    
    if [ $status -eq 0 ]; then
        PID=$(cat "$PID_FILE")
        print_info "状态: ${GREEN}运行中${NC}"
        echo "PID: $PID"
        echo "内存使用: $(ps -p "$PID" -o rss= | awk '{printf "%.2f MB", $1/1024}')"
        echo "CPU使用: $(ps -p "$PID" -o %cpu= | xargs)%"
        echo "运行时间: $(ps -p "$PID" -o etime= | xargs)"
        echo "日志文件: $LOG_FILE"
    elif [ $status -eq 1 ]; then
        print_warning "状态: ${YELLOW}异常${NC} (PID文件存在但进程不存在)"
    else
        print_error "状态: ${RED}未运行${NC}"
    fi
    
    echo "========================================"
}

# 查看日志
show_logs() {
    echo "========================================"
    echo "  日志文件位置"
    echo "========================================"
    echo "标准输出日志: $LOG_FILE"
    echo "错误日志: $ERROR_LOG_FILE"
    echo "========================================"
    echo ""
    
    # 检查日志文件是否存在
    if [ ! -f "$LOG_FILE" ] && [ ! -f "$ERROR_LOG_FILE" ]; then
        print_error "日志文件不存在"
        print_info "提示: 服务可能还未启动，或日志文件路径配置有误"
        return 1
    fi
    
    # 显示最近的日志
    if [ -f "$LOG_FILE" ]; then
        print_info "=== 标准输出日志 (最近50行) ==="
        tail -n 50 "$LOG_FILE"
        echo ""
    fi
    
    if [ -f "$ERROR_LOG_FILE" ] && [ -s "$ERROR_LOG_FILE" ]; then
        print_info "=== 错误日志 (最近50行) ==="
        tail -n 50 "$ERROR_LOG_FILE"
        echo ""
    fi
    
    # 提供实时查看的命令提示
    echo ""
    print_info "实时查看日志命令:"
    echo "  tail -f $LOG_FILE"
    if [ -f "$ERROR_LOG_FILE" ]; then
        echo "  tail -f $ERROR_LOG_FILE"
    fi
}

# 主函数
main() {
    case "$1" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        errors)
            if [ -f "$ERROR_LOG_FILE" ]; then
                print_info "=== 错误日志 (最近100行) ==="
                tail -n 100 "$ERROR_LOG_FILE"
            else
                print_error "错误日志文件不存在: $ERROR_LOG_FILE"
            fi
            ;;
        *)
            echo "使用方法: $0 {start|stop|restart|status|logs|errors}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动服务"
            echo "  stop    - 停止服务"
            echo "  restart - 重启服务"
            echo "  status  - 查看服务状态"
            echo "  logs    - 查看运行日志"
            echo "  errors  - 查看错误日志"
            exit 1
            ;;
    esac
}

main "$@"
