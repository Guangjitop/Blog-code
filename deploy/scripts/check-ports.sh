#!/bin/bash
# ===========================================
# 端口检查脚本 - 检查80/443端口占用
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查的端口
PORTS=(80 443)
OCCUPIED_PORTS=()

echo "=========================================="
echo "  端口占用检查"
echo "=========================================="
echo ""

# 检查端口占用
check_port() {
    local port=$1
    local occupied=false
    
    # 尝试多种方法检查端口
    if command -v lsof >/dev/null 2>&1; then
        # 使用 lsof
        if lsof -i :$port >/dev/null 2>&1; then
            occupied=true
            echo -e "${RED}❌ 端口 $port 被占用${NC}"
            echo "占用进程信息:"
            lsof -i :$port | head -n 5
        fi
    elif command -v netstat >/dev/null 2>&1; then
        # 使用 netstat
        if netstat -tuln | grep -q ":$port "; then
            occupied=true
            echo -e "${RED}❌ 端口 $port 被占用${NC}"
            echo "占用进程信息:"
            netstat -tulnp | grep ":$port " | head -n 3
        fi
    elif command -v ss >/dev/null 2>&1; then
        # 使用 ss
        if ss -tuln | grep -q ":$port "; then
            occupied=true
            echo -e "${RED}❌ 端口 $port 被占用${NC}"
            echo "占用进程信息:"
            ss -tulnp | grep ":$port " | head -n 3
        fi
    else
        echo -e "${YELLOW}⚠️  未找到端口检查工具 (lsof/netstat/ss)${NC}"
        return 1
    fi
    
    if [ "$occupied" = true ]; then
        OCCUPIED_PORTS+=($port)
        return 1
    else
        echo -e "${GREEN}✅ 端口 $port 可用${NC}"
        return 0
    fi
}

# 检查所有端口
ALL_OK=true
for port in "${PORTS[@]}"; do
    echo "检查端口 $port..."
    if ! check_port $port; then
        ALL_OK=false
    fi
    echo ""
done

# 如果有端口被占用，提供处理方案
if [ "$ALL_OK" = false ]; then
    echo "=========================================="
    echo -e "${YELLOW}⚠️  检测到端口占用，需要处理${NC}"
    echo "=========================================="
    echo ""
    
    # 检查是否是系统nginx占用
    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo "检测到系统nginx服务正在运行"
        echo ""
        echo "处理方案:"
        echo "1. 停止系统nginx服务:"
        echo "   sudo systemctl stop nginx"
        echo ""
        echo "2. 禁用系统nginx开机自启（推荐）:"
        echo "   sudo systemctl disable nginx"
        echo ""
        read -p "是否现在停止系统nginx服务? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if sudo systemctl stop nginx; then
                echo -e "${GREEN}✅ 系统nginx已停止${NC}"
                # 重新检查端口
                echo ""
                echo "重新检查端口..."
                ALL_OK=true
                for port in "${PORTS[@]}"; do
                    if ! check_port $port; then
                        ALL_OK=false
                    fi
                done
            else
                echo -e "${RED}❌ 停止系统nginx失败${NC}"
            fi
        fi
    fi
    
    # 检查是否是Docker容器占用
    if command -v docker >/dev/null 2>&1; then
        CONTAINERS_USING_PORTS=$(docker ps --format "{{.Names}}" | xargs -I {} sh -c 'docker port {} 2>/dev/null | grep -E ":(80|443)->" && echo {}' || true)
        if [ -n "$CONTAINERS_USING_PORTS" ]; then
            echo ""
            echo "检测到Docker容器占用端口:"
            echo "$CONTAINERS_USING_PORTS"
            echo ""
            echo "处理方案:"
            echo "1. 停止占用端口的容器:"
            echo "   docker stop <container_name>"
            echo ""
            echo "2. 或查看所有运行中的容器:"
            echo "   docker ps"
            echo ""
        fi
    fi
    
    # 如果仍有端口被占用
    if [ "$ALL_OK" = false ]; then
        echo ""
        echo "=========================================="
        echo -e "${RED}❌ 端口仍被占用，请手动处理${NC}"
        echo "=========================================="
        echo ""
        echo "手动检查命令:"
        echo "  sudo lsof -i :80"
        echo "  sudo lsof -i :443"
        echo "  或"
        echo "  sudo netstat -tulnp | grep -E ':(80|443) '"
        echo ""
        return 1
    fi
fi

echo "=========================================="
echo -e "${GREEN}✅ 所有端口检查通过${NC}"
echo "=========================================="
return 0

