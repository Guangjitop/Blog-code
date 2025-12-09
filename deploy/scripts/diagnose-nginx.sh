#!/bin/bash
# Nginx容器重启问题诊断脚本

echo "============================================================"
echo "Nginx容器重启问题诊断"
echo "============================================================"
echo ""

# 1. 检查Nginx容器状态
echo "1. 检查Nginx容器状态..."
docker ps -a | grep account-nginx
echo ""

# 2. 查看Nginx日志（最近50行）
echo "2. 查看Nginx错误日志（最近50行）..."
docker logs account-nginx --tail 50 2>&1 | tail -30
echo ""

# 3. 检查Nginx配置
echo "3. 检查Nginx配置..."
if docker exec account-nginx nginx -t 2>&1; then
    echo "   ✅ Nginx配置语法正确"
else
    echo "   ❌ Nginx配置有错误！"
    echo "   详细错误："
    docker exec account-nginx nginx -t 2>&1
fi
echo ""

# 4. 检查端口占用
echo "4. 检查端口占用..."
if command -v netstat &> /dev/null; then
    netstat -tlnp | grep -E ":80|:8998" || echo "   未发现端口占用"
elif command -v ss &> /dev/null; then
    ss -tlnp | grep -E ":80|:8998" || echo "   未发现端口占用"
else
    echo "   无法检查端口（需要netstat或ss）"
fi
echo ""

# 5. 检查容器资源
echo "5. 检查容器资源使用..."
docker stats account-nginx --no-stream 2>&1 | head -2
echo ""

# 6. 尝试手动启动并查看实时日志
echo "6. 尝试查看实时启动日志..."
echo "   停止容器..."
docker stop account-nginx 2>/dev/null
sleep 2
echo "   启动容器并查看日志（5秒后自动停止）..."
timeout 5 docker start account-nginx && docker logs account-nginx --tail 20 --follow &
sleep 5
docker stop account-nginx 2>/dev/null
echo ""

echo "============================================================"
echo "诊断完成"
echo "============================================================"
echo ""
echo "常见问题和解决方案："
echo "1. 配置文件语法错误 → 修复nginx配置文件"
echo "2. 端口被占用 → 检查并释放端口"
echo "3. 权限问题 → 检查文件权限"
echo "4. 资源不足 → 检查内存和CPU使用"
echo ""









