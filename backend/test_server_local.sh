#!/bin/bash
# 在服务器上运行的本地诊断脚本
# 用于检查服务器本地的音乐API连接

echo "============================================================"
echo "服务器本地音乐API诊断"
echo "============================================================"
echo "时间: $(date)"
echo ""

# 1. 检查运行环境
echo "1. 检查运行环境..."
if [ -f "/.dockerenv" ] || [ -f "/run/.containerenv" ]; then
    echo "   运行环境: Docker容器"
    RECOMMENDED_ENDPOINT="http://host.docker.internal:3000/"
else
    echo "   运行环境: 直接部署"
    RECOMMENDED_ENDPOINT="http://localhost:3000/"
fi
echo "   推荐端点: $RECOMMENDED_ENDPOINT"
echo ""

# 2. 检查音乐API服务状态
echo "2. 检查音乐API服务状态..."
echo "   检查3000端口监听状态:"
if command -v netstat &> /dev/null; then
    netstat -tlnp | grep 3000 || echo "   未发现3000端口监听"
elif command -v ss &> /dev/null; then
    ss -tlnp | grep 3000 || echo "   未发现3000端口监听"
else
    echo "   无法检查端口状态（需要netstat或ss命令）"
fi
echo ""

# 3. 测试本地端点连接
echo "3. 测试本地端点连接..."
ENDPOINTS=(
    "http://localhost:3000/"
    "http://127.0.0.1:3000/"
    "http://host.docker.internal:3000/"
    "http://107.174.140.100:3000/"
)

TEST_PATH="?type=playlist&id=3778678&server=netease"

for endpoint in "${ENDPOINTS[@]}"; do
    test_url="${endpoint}${TEST_PATH}"
    echo "   测试: $endpoint"
    
    if command -v curl &> /dev/null; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" --max-time 8 "$test_url" 2>&1)
        http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
        time_total=$(echo "$response" | grep "TIME" | cut -d: -f2)
        
        if [ "$http_code" = "200" ]; then
            echo "     ✅ 连接成功 (HTTP $http_code, 耗时 ${time_total}s)"
            # 尝试检查响应内容
            body=$(echo "$response" | sed '/HTTP_CODE/d; /TIME/d')
            if echo "$body" | grep -q "\["; then
                count=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data) if isinstance(data, list) else 'object')" 2>/dev/null || echo "unknown")
                echo "     ✅ 返回数据: $count 条记录"
            fi
        elif [ -n "$http_code" ]; then
            echo "     ❌ HTTP错误: $http_code (耗时 ${time_total}s)"
        else
            echo "     ❌ 连接失败或超时"
        fi
    elif command -v python3 &> /dev/null; then
        python3 << EOF
import httpx
import sys
try:
    timeout = httpx.Timeout(8.0, connect=3.0)
    r = httpx.get("$test_url", timeout=timeout)
    if r.status_code == 200:
        print("     ✅ 连接成功 (HTTP {})".format(r.status_code))
        try:
            data = r.json()
            if isinstance(data, list):
                print("     ✅ 返回数据: {} 条记录".format(len(data)))
            else:
                print("     ✅ 返回数据: {}".format(type(data).__name__))
        except:
            print("     ⚠️  响应不是JSON")
    else:
        print("     ❌ HTTP错误: {}".format(r.status_code))
except httpx.ConnectError as e:
    print("     ❌ 连接失败: {}".format(str(e)[:50]))
except httpx.TimeoutException:
    print("     ❌ 连接超时")
except Exception as e:
    print("     ❌ 错误: {}".format(str(e)[:50]))
EOF
    else
        echo "     ⚠️  需要curl或python3来测试"
    fi
    echo ""
done

# 4. 检查环境变量配置
echo "4. 检查环境变量配置..."
if [ -n "$METING_API_URL" ]; then
    echo "   METING_API_URL: $METING_API_URL"
    IFS=',' read -ra ENDPOINTS <<< "$METING_API_URL"
    echo "   配置的端点 (${#ENDPOINTS[@]} 个):"
    for idx in "${!ENDPOINTS[@]}"; do
        echo "     $((idx+1)). ${ENDPOINTS[idx]}"
    done
else
    echo "   METING_API_URL: 未设置（将使用默认配置）"
fi
echo ""

# 5. 检查后端日志（如果在Docker中）
echo "5. 检查后端配置日志..."
if command -v docker &> /dev/null; then
    echo "   查找后端容器..."
    backend_container=$(docker ps --format "{{.Names}}" | grep -E "backend|account" | head -1)
    if [ -n "$backend_container" ]; then
        echo "   后端容器: $backend_container"
        echo "   配置信息:"
        docker logs "$backend_container" 2>&1 | grep "MUSIC-API-CONFIG" | tail -5 || echo "   未找到配置日志"
    else
        echo "   未找到后端容器"
    fi
fi
echo ""

# 6. 建议
echo "============================================================"
echo "诊断完成"
echo "============================================================"
echo ""
echo "如果所有端点都失败，请检查："
echo "1. 音乐API服务是否运行: ps aux | grep -E 'music|meting|node.*3000'"
echo "2. 防火墙设置: sudo ufw status 或 sudo firewall-cmd --list-all"
echo "3. Docker网络配置（如果使用Docker）"
echo ""

