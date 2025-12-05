#!/bin/bash
# ===========================================
# Let's Encrypt SSL 证书自动续期脚本
# 域名: blog.mytype.top
# ===========================================

set -e

# 配置变量
DOMAIN="blog.mytype.top"
SSL_DIR="$(cd "$(dirname "$0")/../ssl" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==========================================="
echo "Let's Encrypt SSL 证书续期检查"
echo "域名: $DOMAIN"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "==========================================="

# 检查是否已安装 certbot
if ! command -v certbot &> /dev/null; then
    echo "错误: 未找到 certbot"
    exit 1
fi

# 尝试续期证书
if certbot renew --quiet --cert-name "$DOMAIN"; then
    # 检查证书是否已更新
    CERT_FILE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    
    if [ -f "$CERT_FILE" ]; then
        # 复制新证书到项目目录
        echo "复制新证书到项目目录..."
        sudo cp "$CERT_FILE" "$SSL_DIR/fullchain.pem"
        sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"
        sudo chown -R $(whoami):$(whoami) "$SSL_DIR"
        
        # 重启 Nginx 容器
        echo "重启 Nginx 容器..."
        cd "$PROJECT_ROOT/deploy"
        docker-compose restart nginx
        
        echo "✓ 证书续期成功，Nginx 已重启"
    else
        echo "警告: 证书文件不存在"
    fi
else
    # 证书未到期或续期失败
    echo "证书未到期或续期失败（这是正常的，如果证书还有超过30天有效期）"
fi

echo "==========================================="

