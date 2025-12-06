#!/bin/bash
# ===========================================
# 创建自签名SSL证书（用于测试）
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$DEPLOY_DIR/ssl"
DOMAIN="blog.mytype.top"

echo "=========================================="
echo "  创建自签名SSL证书"
echo "  域名: $DOMAIN"
echo "=========================================="
echo ""

# 创建SSL目录
mkdir -p "$SSL_DIR"

# 检查是否已存在证书
if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
    echo "⚠️  证书文件已存在"
    read -p "是否覆盖? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
fi

echo "正在生成自签名证书..."
echo ""

# 生成自签名证书（有效期365天）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=CN/ST=State/L=City/O=Organization/CN=$DOMAIN"

# 设置权限
chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

echo ""
echo "=========================================="
echo "✅ 自签名证书创建成功！"
echo "=========================================="
echo ""
echo "证书文件:"
echo "  - 证书: $SSL_DIR/fullchain.pem"
echo "  - 私钥: $SSL_DIR/privkey.pem"
echo ""
echo "⚠️  注意: 这是自签名证书，浏览器会显示警告"
echo "   生产环境请使用 Let's Encrypt 申请真实证书"
echo ""
echo "下一步:"
echo "  重启Nginx容器: docker-compose restart nginx"
echo "=========================================="

