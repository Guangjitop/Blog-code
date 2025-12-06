#!/bin/bash
# ===========================================
# Let's Encrypt SSL 证书申请脚本
# 域名: blog.mytype.top
# ===========================================

set -e

# 配置变量
DOMAIN="blog.mytype.top"
EMAIL="your-email@example.com"  # 请修改为您的邮箱
SSL_DIR="$(cd "$(dirname "$0")/../ssl" && pwd)"
NGINX_WEBROOT="/usr/share/nginx/html"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==========================================="
echo "Let's Encrypt SSL 证书申请"
echo "域名: $DOMAIN"
echo "==========================================="

# 检查是否已安装 certbot
if ! command -v certbot &> /dev/null; then
    echo "错误: 未找到 certbot，请先安装"
    echo ""
    echo "安装方法:"
    echo "  Ubuntu/Debian: sudo apt install certbot -y"
    echo "  CentOS/RHEL:   sudo yum install certbot -y"
    exit 1
fi

# 检查邮箱配置
if [ "$EMAIL" = "your-email@example.com" ]; then
    echo "警告: 请先修改脚本中的 EMAIL 变量为您的真实邮箱"
    echo "编辑文件: $0"
    exit 1
fi

# 确保 SSL 目录存在
mkdir -p "$SSL_DIR"

# 检查 Docker 容器是否运行
if ! docker ps | grep -q account-nginx; then
    echo "警告: Nginx 容器未运行，请先启动服务"
    echo "运行: cd $PROJECT_ROOT/deploy && docker-compose up -d"
    exit 1
fi

echo ""
echo "步骤 1: 临时停止 Nginx 容器以释放 80 端口"
echo "注意: 此方法需要 80 端口可用"
echo ""

# 临时停止nginx容器
cd "$PROJECT_ROOT/deploy"
if docker ps | grep -q account-nginx; then
    echo "正在停止 Nginx 容器..."
    docker-compose stop nginx
    NGINX_WAS_RUNNING=true
else
    NGINX_WAS_RUNNING=false
fi

echo ""
echo "步骤 2: 使用 standalone 模式申请证书"
echo ""

# 使用 standalone 模式申请证书
# certbot 会临时启动一个服务器来验证域名
if certbot certonly \
    --standalone \
    --preferred-challenges http \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive; then
    echo "✓ 证书申请成功"
else
    echo "错误: 证书申请失败"
    # 如果nginx之前在运行，尝试重启它
    if [ "$NGINX_WAS_RUNNING" = true ]; then
        echo "正在重启 Nginx 容器..."
        docker-compose start nginx
    fi
    exit 1
fi

# 复制证书到项目目录
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo ""
    echo "步骤 3: 复制证书文件到项目目录"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/"
    sudo chown -R $(whoami):$(whoami) "$SSL_DIR"
    
    # 验证文件是否复制成功
    if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
        echo "✓ 证书已复制到: $SSL_DIR"
        # 设置正确的文件权限
        chmod 644 "$SSL_DIR/fullchain.pem"
        chmod 600 "$SSL_DIR/privkey.pem"
    else
        echo "错误: 证书文件复制失败"
        exit 1
    fi
    
    echo ""
    echo "步骤 4: 重启 Nginx 容器以加载新证书"
    cd "$PROJECT_ROOT/deploy"
    if [ "$NGINX_WAS_RUNNING" = true ]; then
        docker-compose start nginx
    else
        docker-compose up -d nginx
    fi
    
    echo ""
    echo "==========================================="
    echo "✓ SSL 证书申请成功！"
    echo "==========================================="
    echo ""
    echo "证书文件位置:"
    echo "  - 完整链: $SSL_DIR/fullchain.pem"
    echo "  - 私钥:   $SSL_DIR/privkey.pem"
    echo ""
    echo "下一步:"
    echo "1. 确保 Nginx 配置已更新为使用 HTTPS"
    echo "2. 配置自动续期: 将 renew-ssl-cert.sh 添加到 crontab"
    echo "3. 测试访问: https://$DOMAIN"
    echo ""
else
    echo "错误: 证书申请失败，请检查错误信息"
    exit 1
fi

