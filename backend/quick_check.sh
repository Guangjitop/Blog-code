#!/bin/bash
# 快速检查音乐API连接状态

echo "=========================================="
echo "  音乐API快速检查"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查端口3000
echo "1. 检查端口3000状态..."
if netstat -tlnp 2>/dev/null | grep -q ":3000 " || ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo -e "${GREEN}✓${NC} 端口3000正在监听"
    netstat -tlnp 2>/dev/null | grep ":3000 " || ss -tlnp 2>/dev/null | grep ":3000 "
else
    echo -e "${RED}✗${NC} 端口3000未监听"
    echo "   音乐API服务可能未启动"
fi
echo ""

# 检查Docker容器
echo "2. 检查Docker容器..."
if command -v docker &> /dev/null; then
    if docker ps | grep -E "music|meting|3000" > /dev/null; then
        echo -e "${GREEN}✓${NC} 找到音乐API相关容器:"
        docker ps | grep -E "music|meting|3000"
    else
        echo -e "${YELLOW}!${NC} 未找到音乐API相关容器"
        echo "   所有运行的容器:"
        docker ps --format "table {{.Names}}\t{{.Ports}}"
    fi
else
    echo -e "${YELLOW}!${NC} Docker未安装或不可用"
fi
echo ""

# 测试本地连接
echo "3. 测试本地连接..."
for endpoint in "http://localhost:3000/" "http://127.0.0.1:3000/"; do
    echo -n "   测试 $endpoint ... "
    if curl -s --connect-timeout 3 --max-time 5 "$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}成功${NC}"
    else
        echo -e "${RED}失败${NC}"
    fi
done
echo ""

# 测试外部IP连接
echo "4. 测试外部IP连接..."
echo -n "   测试 http://107.174.140.100:3000/ ... "
if curl -s --connect-timeout 3 --max-time 5 "http://107.174.140.100:3000/" > /dev/null 2>&1; then
    echo -e "${GREEN}成功${NC}"
else
    echo -e "${RED}失败${NC}"
fi
echo ""

# 测试API功能
echo "5. 测试API功能..."
echo -n "   测试热门歌单API ... "
if curl -s --connect-timeout 5 --max-time 10 "http://localhost:3000/?type=playlist&id=3778678&server=netease" > /dev/null 2>&1; then
    echo -e "${GREEN}成功${NC}"
elif curl -s --connect-timeout 5 --max-time 10 "http://107.174.140.100:3000/?type=playlist&id=3778678&server=netease" > /dev/null 2>&1; then
    echo -e "${GREEN}成功${NC} (使用外部IP)"
else
    echo -e "${RED}失败${NC}"
fi
echo ""

# 检查后端配置
echo "6. 检查后端配置..."
if command -v docker &> /dev/null && docker ps | grep -q "backend"; then
    echo "   后端日志中的配置:"
    docker logs backend 2>&1 | grep "MUSIC-API-CONFIG" | tail -2
else
    echo -e "${YELLOW}!${NC} 无法检查后端配置（backend容器未运行）"
fi
echo ""

# 总结
echo "=========================================="
echo "  检查完成"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 如果端口3000未监听，启动音乐API服务"
echo "2. 如果连接失败，运行详细诊断: python3 debug_music_api.py"
echo "3. 查看完整指南: cat DEBUG_GUIDE.md"
echo ""
