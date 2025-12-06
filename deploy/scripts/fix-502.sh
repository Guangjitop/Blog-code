#!/bin/bash
# 快速修复502错误的脚本

echo "============================================================"
echo "502错误诊断和修复工具"
echo "============================================================"
echo ""

# 1. 检查容器状态
echo "1. 检查容器状态..."
docker ps -a | grep -E "backend|nginx" || echo "   未找到容器"
echo ""

# 2. 检查后端容器
echo "2. 检查后端容器..."
if docker ps | grep -q "account-backend"; then
    echo "   ✅ 后端容器正在运行"
    BACKEND_STATUS="running"
else
    echo "   ❌ 后端容器未运行"
    BACKEND_STATUS="stopped"
    
    # 检查是否有停止的容器
    if docker ps -a | grep -q "account-backend"; then
        echo "   尝试启动后端容器..."
        docker start account-backend
        sleep 3
        if docker ps | grep -q "account-backend"; then
            echo "   ✅ 后端容器已启动"
            BACKEND_STATUS="running"
        else
            echo "   ❌ 后端容器启动失败"
        fi
    fi
fi
echo ""

# 3. 检查Nginx容器
echo "3. 检查Nginx容器..."
if docker ps | grep -q "account-nginx"; then
    echo "   ✅ Nginx容器正在运行"
    NGINX_STATUS="running"
else
    echo "   ❌ Nginx容器未运行"
    NGINX_STATUS="stopped"
    
    if docker ps -a | grep -q "account-nginx"; then
        echo "   尝试启动Nginx容器..."
        docker start account-nginx
        sleep 3
        if docker ps | grep -q "account-nginx"; then
            echo "   ✅ Nginx容器已启动"
            NGINX_STATUS="running"
        else
            echo "   ❌ Nginx容器启动失败"
        fi
    fi
fi
echo ""

# 4. 检查后端服务健康
echo "4. 检查后端服务健康..."
if [ "$BACKEND_STATUS" = "running" ]; then
    # 检查后端是否响应
    if docker exec account-backend curl -f http://localhost:8998/docs > /dev/null 2>&1; then
        echo "   ✅ 后端服务正常响应"
    else
        echo "   ❌ 后端服务无响应"
        echo "   查看后端日志..."
        docker logs account-backend --tail 50 | tail -20
    fi
else
    echo "   ⚠️  后端容器未运行，跳过检查"
fi
echo ""

# 5. 检查网络连接
echo "5. 检查网络连接..."
if [ "$BACKEND_STATUS" = "running" ] && [ "$NGINX_STATUS" = "running" ]; then
    # 从Nginx容器测试后端连接
    if docker exec account-nginx curl -f http://backend:8998/docs > /dev/null 2>&1; then
        echo "   ✅ Nginx可以连接到后端"
    else
        echo "   ❌ Nginx无法连接到后端"
        echo "   可能的原因："
        echo "     1. 后端服务未启动"
        echo "     2. 网络配置问题"
        echo "     3. 端口配置错误"
    fi
else
    echo "   ⚠️  容器未运行，跳过检查"
fi
echo ""

# 6. 重启服务
echo "6. 重启服务..."
if [ "$BACKEND_STATUS" != "running" ] || [ "$NGINX_STATUS" != "running" ]; then
    echo "   尝试重启所有服务..."
    cd "$(dirname "$0")/.."
    docker-compose restart
    sleep 5
    
    echo "   检查重启后状态..."
    if docker ps | grep -q "account-backend" && docker ps | grep -q "account-nginx"; then
        echo "   ✅ 服务已重启"
    else
        echo "   ❌ 服务重启失败，尝试完全重启..."
        docker-compose down
        sleep 2
        docker-compose up -d
        sleep 5
    fi
else
    echo "   所有服务正在运行，跳过重启"
fi
echo ""

# 7. 最终检查
echo "7. 最终检查..."
sleep 3
if docker ps | grep -q "account-backend" && docker ps | grep -q "account-nginx"; then
    echo "   ✅ 所有容器正在运行"
    
    # 测试API
    echo "   测试API端点..."
    if curl -f http://localhost:8998/api/health > /dev/null 2>&1 || \
       curl -f http://localhost:8999/docs > /dev/null 2>&1; then
        echo "   ✅ API端点可访问"
    else
        echo "   ⚠️  API端点可能仍有问题，请检查日志"
    fi
else
    echo "   ❌ 仍有容器未运行"
    echo "   请手动检查: docker ps -a"
fi
echo ""

echo "============================================================"
echo "诊断完成"
echo "============================================================"
echo ""
echo "如果问题仍然存在，请："
echo "1. 查看后端日志: docker logs account-backend --tail 100"
echo "2. 查看Nginx日志: docker logs account-nginx --tail 100"
echo "3. 检查网络: docker network inspect deploy_app-network"
echo "4. 完全重启: cd deploy && docker-compose down && docker-compose up -d"
echo ""

