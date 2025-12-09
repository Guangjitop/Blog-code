#!/bin/bash
# ===========================================
# 从零开始部署脚本 - Linux/macOS
# 自动处理端口检查、SSL证书申请、配置生成、服务启动
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
DOMAIN="blog.mytype.top"
EMAIL=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"
SSL_DIR="$DEPLOY_DIR/ssl"

# 部署方案
DEPLOY_MODE=""  # "direct" 或 "proxy"

echo "=========================================="
echo "  从零开始部署 - 账号管理系统"
echo "=========================================="
echo ""

# 步骤1: 检查系统环境
echo "=========================================="
echo "步骤 1/7: 检查系统环境"
echo "=========================================="
echo ""

# 检查Docker
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: 未安装 Docker${NC}"
    echo ""
    echo "安装方法:"
    echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
    echo "  或访问: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker 已安装${NC}"

# 检查Docker Compose
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: 未安装 Docker Compose${NC}"
    echo ""
    echo "安装方法:"
    echo "  Ubuntu/Debian: sudo apt install docker-compose-plugin -y"
    exit 1
fi

# 确定docker-compose命令
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi
echo -e "${GREEN}✅ Docker Compose 已安装${NC}"

# 检查Docker服务是否运行
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ 错误: Docker 服务未运行${NC}"
    echo ""
    echo "请启动 Docker 服务:"
    echo "  sudo systemctl start docker"
    exit 1
fi
echo -e "${GREEN}✅ Docker 服务正在运行${NC}"

echo ""

# 步骤2: 检查端口占用
echo "=========================================="
echo "步骤 2/7: 检查端口占用"
echo "=========================================="
echo ""

check_port() {
    local port=$1
    local occupied=false
    
    if command -v lsof >/dev/null 2>&1; then
        if lsof -i :$port >/dev/null 2>&1; then
            occupied=true
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            occupied=true
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            occupied=true
        fi
    fi
    
    if [ "$occupied" = true ]; then
        echo -e "${YELLOW}⚠️  端口 $port 被占用${NC}"
        if command -v lsof >/dev/null 2>&1; then
            lsof -i :$port | head -n 3
        fi
        return 1
    else
        echo -e "${GREEN}✅ 端口 $port 可用${NC}"
        return 0
    fi
}

PORT_80_OCCUPIED=false
PORT_443_OCCUPIED=false

echo "检查端口 80..."
if ! check_port 80; then
    PORT_80_OCCUPIED=true
fi

echo "检查端口 443..."
if ! check_port 443; then
    PORT_443_OCCUPIED=true
fi

echo "检查端口 8998..."
check_port 8998 || echo -e "${YELLOW}⚠️  端口 8998 被占用（如果使用方案B，这是正常的）${NC}"

echo "检查端口 8999..."
check_port 8999 || echo -e "${YELLOW}⚠️  端口 8999 被占用（如果使用方案B，这是正常的）${NC}"

echo ""

# 选择部署方案
if [ "$PORT_80_OCCUPIED" = true ] || [ "$PORT_443_OCCUPIED" = true ]; then
    DEPLOY_MODE="proxy"
    echo "=========================================="
    echo -e "${YELLOW}检测到 80/443 端口被占用${NC}"
    echo "=========================================="
    echo ""
    echo "将使用方案B：现有Nginx反向代理"
    echo "- Docker容器使用 8998/8999 端口（仅内部访问）"
    echo "- 宿主机Nginx反向代理到 localhost:8998"
    echo "- SSL证书配置在宿主机Nginx"
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    DEPLOY_MODE="direct"
    echo "=========================================="
    echo -e "${GREEN}端口 80/443 可用${NC}"
    echo "=========================================="
    echo ""
    echo "将使用方案A：直接使用 80/443 端口"
    echo "- Docker容器直接监听 80/443 端口"
    echo "- SSL证书配置在容器内Nginx"
    echo ""
fi

echo ""

# 步骤3: 配置环境变量
echo "=========================================="
echo "步骤 3/7: 配置环境变量"
echo "=========================================="
echo ""

cd "$DEPLOY_DIR"

if [ ! -f ".env" ]; then
    echo "创建 .env 文件..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ 已从模板创建 .env 文件${NC}"
    else
        cat > .env <<EOF
DOMAIN=$DOMAIN
APP_PORT=80
APP_SSL_PORT=443
ADMIN_PASSWORD=admin121
SSL_ENABLED=false
EOF
        echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
    fi
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

# 更新.env文件
if [ "$DEPLOY_MODE" = "proxy" ]; then
    # 方案B：使用8998端口
    sed -i.bak 's/^APP_PORT=.*/APP_PORT=8998/' .env 2>/dev/null || \
    sed -i '' 's/^APP_PORT=.*/APP_PORT=8998/' .env 2>/dev/null || true
    echo "APP_PORT=8998" >> .env
fi

echo ""

# 步骤4: SSL证书申请
echo "=========================================="
echo "步骤 4/7: SSL证书申请"
echo "=========================================="
echo ""

# 检查certbot
CERTBOT_AVAILABLE=false
if command -v certbot >/dev/null 2>&1; then
    CERTBOT_AVAILABLE=true
    echo -e "${GREEN}✅ Certbot 已安装${NC}"
else
    echo -e "${YELLOW}⚠️  Certbot 未安装${NC}"
    echo ""
    echo "安装方法:"
    echo "  Ubuntu/Debian: sudo apt install certbot -y"
    echo "  CentOS/RHEL:   sudo yum install certbot -y"
    echo ""
    read -p "是否现在安装 Certbot？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v apt >/dev/null 2>&1; then
            sudo apt update && sudo apt install certbot -y
            CERTBOT_AVAILABLE=true
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install certbot -y
            CERTBOT_AVAILABLE=true
        else
            echo -e "${RED}❌ 无法自动安装 Certbot，请手动安装${NC}"
        fi
    fi
fi

# 申请证书
if [ "$CERTBOT_AVAILABLE" = true ]; then
    # 获取邮箱
    if [ -z "$EMAIL" ]; then
        read -p "请输入您的邮箱地址（用于证书申请）: " EMAIL
    fi
    
    if [ -z "$EMAIL" ]; then
        echo -e "${YELLOW}⚠️  未提供邮箱，跳过证书申请${NC}"
        echo "您可以稍后手动申请证书"
    else
        echo ""
        echo "开始申请 SSL 证书..."
        
        # 确保SSL目录存在
        mkdir -p "$SSL_DIR"
        
        if [ "$DEPLOY_MODE" = "direct" ]; then
            # 方案A：在容器内申请（需要先启动服务）
            echo "方案A：将在容器启动后申请证书"
            echo "提示：证书申请需要临时占用80端口，请确保80端口可用"
        else
            # 方案B：在宿主机申请
            echo "方案B：在宿主机申请证书"
            
            # 检查域名解析
            echo "检查域名解析..."
            if ! nslookup "$DOMAIN" >/dev/null 2>&1 && ! dig "$DOMAIN" >/dev/null 2>&1; then
                echo -e "${YELLOW}⚠️  无法解析域名 $DOMAIN${NC}"
                echo "请确保域名已正确解析到服务器IP"
                read -p "是否继续？(y/n) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
            
            # 使用webroot模式申请（如果服务已运行）
            if [ -d "../Home" ]; then
                echo "使用 webroot 模式申请证书..."
                if sudo certbot certonly \
                    --webroot \
                    -w "$PROJECT_ROOT/Home" \
                    -d "$DOMAIN" \
                    --email "$EMAIL" \
                    --agree-tos \
                    --non-interactive 2>&1; then
                    echo -e "${GREEN}✅ 证书申请成功${NC}"
                else
                    echo -e "${YELLOW}⚠️  证书申请失败，可能需要先启动服务${NC}"
                    echo "您可以稍后手动申请证书"
                fi
            else
                echo -e "${YELLOW}⚠️  未找到 Home 目录，跳过证书申请${NC}"
            fi
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Certbot 未安装，跳过证书申请${NC}"
    echo "您可以稍后手动安装并申请证书"
fi

echo ""

# 步骤5: 生成配置文件
echo "=========================================="
echo "步骤 5/7: 生成配置文件"
echo "=========================================="
echo ""

if [ "$DEPLOY_MODE" = "proxy" ]; then
    # 方案B：生成宿主机Nginx配置模板
    echo "生成宿主机Nginx反向代理配置模板..."
    
    HOST_NGINX_CONF="$DEPLOY_DIR/nginx/host-nginx-proxy.conf.example"
    
    cat > "$HOST_NGINX_CONF" <<'EOF'
# ===========================================
# 宿主机 Nginx 反向代理配置
# 用于方案B：当80/443端口被占用时
# ===========================================
# 
# 使用方法：
# 1. 复制此文件到Nginx配置目录：
#    sudo cp deploy/nginx/host-nginx-proxy.conf.example /etc/nginx/conf.d/blog.mytype.top.conf
#    # 或
#    sudo cp deploy/nginx/host-nginx-proxy.conf.example /etc/nginx/sites-available/blog.mytype.top
#    sudo ln -s /etc/nginx/sites-available/blog.mytype.top /etc/nginx/sites-enabled/
#
# 2. 修改域名和证书路径（如果需要）
# 3. 测试配置：sudo nginx -t
# 4. 重新加载：sudo systemctl reload nginx
# ===========================================

upstream docker_app {
    server 127.0.0.1:8998;
    keepalive 32;
}

# HTTP 服务器 - 重定向到 HTTPS
server {
    listen 80;
    server_name blog.mytype.top;
    
    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # 重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name blog.mytype.top;
    
    # SSL 证书配置（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/blog.mytype.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.mytype.top/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 反向代理到 Docker 容器
    location / {
        proxy_pass http://docker_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲设置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}
EOF
    
    echo -e "${GREEN}✅ 已生成宿主机Nginx配置模板: $HOST_NGINX_CONF${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  重要：请手动配置宿主机Nginx${NC}"
    echo "1. 复制配置模板到Nginx配置目录"
    echo "2. 测试并重新加载Nginx配置"
    echo ""
fi

echo ""

# 步骤6: 启动服务
echo "=========================================="
echo "步骤 6/7: 启动服务"
echo "=========================================="
echo ""

echo "构建并启动 Docker 容器..."
cd "$DEPLOY_DIR"

# 确保SSL目录存在
mkdir -p "$SSL_DIR"

# 启动服务
if $COMPOSE_CMD up -d --build; then
    echo -e "${GREEN}✅ 服务启动成功${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo ""
    echo "请检查错误信息:"
    $COMPOSE_CMD logs
    exit 1
fi

echo ""
echo "等待服务就绪..."
sleep 5

# 检查容器状态
echo ""
echo "容器状态:"
$COMPOSE_CMD ps

echo ""

# 步骤7: 健康检查
echo "=========================================="
echo "步骤 7/7: 健康检查"
echo "=========================================="
echo ""

# 检查后端
echo "检查后端服务..."
if curl -f -s http://localhost:8999/docs >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务正常${NC}"
else
    echo -e "${YELLOW}⚠️  后端服务可能未就绪，请稍后重试${NC}"
fi

# 检查前端
echo "检查前端服务..."
if curl -f -s http://localhost:8998 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务正常${NC}"
else
    echo -e "${YELLOW}⚠️  前端服务可能未就绪，请稍后重试${NC}"
fi

echo ""

# 部署完成
echo "=========================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=========================================="
echo ""

echo "📋 部署信息:"
echo "  部署方案: $([ "$DEPLOY_MODE" = "direct" ] && echo "方案A（直接使用80/443）" || echo "方案B（现有Nginx反向代理）")"
echo "  域名: $DOMAIN"
echo ""

if [ "$DEPLOY_MODE" = "direct" ]; then
    echo "🌐 访问地址:"
    echo "  HTTP:  http://$DOMAIN"
    echo "  HTTPS: https://$DOMAIN（需要先申请证书）"
    echo "  本地:  http://localhost"
    echo ""
    echo "📝 下一步:"
    echo "  1. 如果未申请证书，运行: ./scripts/get-ssl-cert.sh"
    echo "  2. 访问 https://$DOMAIN 验证部署"
else
    echo "🌐 访问地址:"
    echo "  生产环境: https://$DOMAIN（需要配置宿主机Nginx）"
    echo "  本地测试: http://localhost:8998"
    echo ""
    echo "📝 下一步:"
    echo "  1. 配置宿主机Nginx反向代理:"
    echo "     sudo cp nginx/host-nginx-proxy.conf.example /etc/nginx/conf.d/blog.mytype.top.conf"
    echo "     sudo nginx -t"
    echo "     sudo systemctl reload nginx"
    echo ""
    echo "  2. 如果未申请证书，运行:"
    echo "     sudo certbot certonly --webroot -w $PROJECT_ROOT/Home -d $DOMAIN --email $EMAIL"
    echo ""
    echo "  3. 访问 https://$DOMAIN 验证部署"
fi

echo ""
echo "📋 常用命令:"
echo "  查看日志: $COMPOSE_CMD logs -f"
echo "  查看状态: $COMPOSE_CMD ps"
echo "  停止服务: $COMPOSE_CMD down"
echo "  重启服务: $COMPOSE_CMD restart"
echo ""

if [ "$DEPLOY_MODE" = "proxy" ]; then
    echo "⚠️  重要提示:"
    echo "  请确保已配置宿主机Nginx反向代理，否则无法通过域名访问"
    echo ""
fi

echo "=========================================="

