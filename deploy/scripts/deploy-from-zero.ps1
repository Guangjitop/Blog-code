# ===========================================
# 从零开始部署脚本 - Windows PowerShell
# 自动处理端口检查、SSL证书申请、配置生成、服务启动
# ===========================================

$ErrorActionPreference = "Stop"

# 配置变量
$DOMAIN = "blog.mytype.top"
$EMAIL = ""
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$DEPLOY_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $DEPLOY_DIR
$SSL_DIR = Join-Path $DEPLOY_DIR "ssl"

# 部署方案
$DEPLOY_MODE = ""  # "direct" 或 "proxy"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  从零开始部署 - 账号管理系统" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤1: 检查系统环境
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 1/7: 检查系统环境" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Docker
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not found"
    }
    Write-Host "✅ Docker 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: 未安装 Docker" -ForegroundColor Red
    Write-Host ""
    Write-Host "请安装 Docker Desktop:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    exit 1
}

# 检查Docker Compose
$COMPOSE_CMD = "docker compose"
try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $COMPOSE_CMD = "docker-compose"
        docker-compose --version 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose not found"
        }
    }
    Write-Host "✅ Docker Compose 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: 未安装 Docker Compose" -ForegroundColor Red
    exit 1
}

# 检查Docker服务是否运行
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker service not running"
    }
    Write-Host "✅ Docker 服务正在运行" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: Docker 服务未运行" -ForegroundColor Red
    Write-Host ""
    Write-Host "请启动 Docker Desktop"
    exit 1
}

Write-Host ""

# 步骤2: 检查端口占用
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 2/7: 检查端口占用" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Test-Port {
    param([int]$Port)
    
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet 2>$null
    if ($connection) {
        Write-Host "⚠️  端口 $Port 被占用" -ForegroundColor Yellow
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($process) {
            $proc = Get-Process -Id $process.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "   占用进程: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
            }
        }
        return $true
    } else {
        Write-Host "✅ 端口 $Port 可用" -ForegroundColor Green
        return $false
    }
}

$PORT_80_OCCUPIED = Test-Port -Port 80
$PORT_443_OCCUPIED = Test-Port -Port 443
$port8998 = Test-Port -Port 8998
$port8999 = Test-Port -Port 8999

if ($port8998) {
    Write-Host "⚠️  端口 8998 被占用（如果使用方案B，这是正常的）" -ForegroundColor Yellow
}
if ($port8999) {
    Write-Host "⚠️  端口 8999 被占用（如果使用方案B，这是正常的）" -ForegroundColor Yellow
}

Write-Host ""

# 选择部署方案
if ($PORT_80_OCCUPIED -or $PORT_443_OCCUPIED) {
    $DEPLOY_MODE = "proxy"
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "检测到 80/443 端口被占用" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "将使用方案B：现有Nginx反向代理"
    Write-Host "- Docker容器使用 8998/8999 端口（仅内部访问）"
    Write-Host "- 宿主机Nginx反向代理到 localhost:8998"
    Write-Host "- SSL证书配置在宿主机Nginx"
    Write-Host ""
    $response = Read-Host "是否继续？(y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    $DEPLOY_MODE = "direct"
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "端口 80/443 可用" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "将使用方案A：直接使用 80/443 端口"
    Write-Host "- Docker容器直接监听 80/443 端口"
    Write-Host "- SSL证书配置在容器内Nginx"
    Write-Host ""
}

Write-Host ""

# 步骤3: 配置环境变量
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 3/7: 配置环境变量" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $DEPLOY_DIR

$envFile = Join-Path $DEPLOY_DIR ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "创建 .env 文件..."
    $envExample = Join-Path $DEPLOY_DIR ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "✅ 已从模板创建 .env 文件" -ForegroundColor Green
    } else {
        @"
DOMAIN=$DOMAIN
APP_PORT=80
APP_SSL_PORT=443
ADMIN_PASSWORD=admin121
SSL_ENABLED=false
"@ | Out-File -FilePath $envFile -Encoding UTF8
        Write-Host "✅ 已创建 .env 文件" -ForegroundColor Green
    }
} else {
    Write-Host "✅ .env 文件已存在" -ForegroundColor Green
}

# 更新.env文件
if ($DEPLOY_MODE -eq "proxy") {
    $envContent = Get-Content $envFile -Raw
    $envContent = $envContent -replace "APP_PORT=\d+", "APP_PORT=8998"
    if ($envContent -notmatch "APP_PORT=") {
        $envContent += "`nAPP_PORT=8998"
    }
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -NoNewline
}

Write-Host ""

# 步骤4: SSL证书申请
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 4/7: SSL证书申请" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Windows上通常不使用certbot，提示用户
Write-Host "⚠️  Windows环境下，建议使用以下方式申请SSL证书：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 使用WSL (Windows Subsystem for Linux) 运行certbot"
Write-Host "2. 使用Docker容器运行certbot"
Write-Host "3. 使用其他Windows兼容的证书申请工具"
Write-Host ""
Write-Host "或者，如果您已有SSL证书文件，可以："
Write-Host "  1. 将证书文件放入: $SSL_DIR"
Write-Host "  2. 文件名: fullchain.pem 和 privkey.pem"
Write-Host ""

if ([string]::IsNullOrEmpty($EMAIL)) {
    $EMAIL = Read-Host "请输入您的邮箱地址（用于后续证书申请）"
}

Write-Host ""

# 步骤5: 生成配置文件
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 5/7: 生成配置文件" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if ($DEPLOY_MODE -eq "proxy") {
    Write-Host "生成宿主机Nginx反向代理配置模板..."
    
    $hostNginxConf = Join-Path $DEPLOY_DIR "nginx\host-nginx-proxy.conf.example"
    $nginxDir = Join-Path $DEPLOY_DIR "nginx"
    if (-not (Test-Path $nginxDir)) {
        New-Item -ItemType Directory -Path $nginxDir | Out-Null
    }
    
    $nginxConfig = @"
# ===========================================
# 宿主机 Nginx 反向代理配置
# 用于方案B：当80/443端口被占用时
# ===========================================
# 
# 使用方法：
# 1. 复制此文件到Nginx配置目录
# 2. 修改域名和证书路径（如果需要）
# 3. 测试配置：nginx -t
# 4. 重新加载：nginx -s reload
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
        return 301 https://`$server_name`$request_uri;
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
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
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
"@
    
    $nginxConfig | Out-File -FilePath $hostNginxConf -Encoding UTF8
    Write-Host "✅ 已生成宿主机Nginx配置模板: $hostNginxConf" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  重要：请手动配置宿主机Nginx" -ForegroundColor Yellow
    Write-Host "1. 复制配置模板到Nginx配置目录"
    Write-Host "2. 测试并重新加载Nginx配置"
    Write-Host ""
}

Write-Host ""

# 步骤6: 启动服务
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 6/7: 启动服务" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "构建并启动 Docker 容器..."

# 确保SSL目录存在
if (-not (Test-Path $SSL_DIR)) {
    New-Item -ItemType Directory -Path $SSL_DIR | Out-Null
}

# 启动服务
try {
    if ($COMPOSE_CMD -eq "docker compose") {
        docker compose up -d --build
    } else {
        docker-compose up -d --build
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 服务启动成功" -ForegroundColor Green
    } else {
        throw "Docker Compose failed"
    }
} catch {
    Write-Host "❌ 服务启动失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查错误信息:"
    if ($COMPOSE_CMD -eq "docker compose") {
        docker compose logs
    } else {
        docker-compose logs
    }
    exit 1
}

Write-Host ""
Write-Host "等待服务就绪..."
Start-Sleep -Seconds 5

# 检查容器状态
Write-Host ""
Write-Host "容器状态:"
if ($COMPOSE_CMD -eq "docker compose") {
    docker compose ps
} else {
    docker-compose ps
}

Write-Host ""

# 步骤7: 健康检查
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "步骤 7/7: 健康检查" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查后端
Write-Host "检查后端服务..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8999/docs" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ 后端服务正常" -ForegroundColor Green
} catch {
    Write-Host "⚠️  后端服务可能未就绪，请稍后重试" -ForegroundColor Yellow
}

# 检查前端
Write-Host "检查前端服务..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8998" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ 前端服务正常" -ForegroundColor Green
} catch {
    Write-Host "⚠️  前端服务可能未就绪，请稍后重试" -ForegroundColor Yellow
}

Write-Host ""

# 部署完成
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 部署信息:"
$modeText = if ($DEPLOY_MODE -eq "direct") { "方案A（直接使用80/443）" } else { "方案B（现有Nginx反向代理）" }
Write-Host "  部署方案: $modeText"
Write-Host "  域名: $DOMAIN"
Write-Host ""

if ($DEPLOY_MODE -eq "direct") {
    Write-Host "🌐 访问地址:"
    Write-Host "  HTTP:  http://$DOMAIN"
    Write-Host "  HTTPS: https://$DOMAIN（需要先申请证书）"
    Write-Host "  本地:  http://localhost"
    Write-Host ""
    Write-Host "📝 下一步:"
    Write-Host "  1. 申请SSL证书（使用WSL或Docker）"
    Write-Host "  2. 访问 https://$DOMAIN 验证部署"
} else {
    Write-Host "🌐 访问地址:"
    Write-Host "  生产环境: https://$DOMAIN（需要配置宿主机Nginx）"
    Write-Host "  本地测试: http://localhost:8998"
    Write-Host ""
    Write-Host "📝 下一步:"
    Write-Host "  1. 配置宿主机Nginx反向代理"
    Write-Host "  2. 申请SSL证书"
    Write-Host "  3. 访问 https://$DOMAIN 验证部署"
}

Write-Host ""
Write-Host "📋 常用命令:"
$logsCmd = if ($COMPOSE_CMD -eq "docker compose") { "docker compose logs -f" } else { "docker-compose logs -f" }
Write-Host "  查看日志: $logsCmd"
$psCmd = if ($COMPOSE_CMD -eq "docker compose") { "docker compose ps" } else { "docker-compose ps" }
Write-Host "  查看状态: $psCmd"
$downCmd = if ($COMPOSE_CMD -eq "docker compose") { "docker compose down" } else { "docker-compose down" }
Write-Host "  停止服务: $downCmd"
$restartCmd = if ($COMPOSE_CMD -eq "docker compose") { "docker compose restart" } else { "docker-compose restart" }
Write-Host "  重启服务: $restartCmd"
Write-Host ""

if ($DEPLOY_MODE -eq "proxy") {
    Write-Host "⚠️  重要提示:" -ForegroundColor Yellow
    Write-Host "  请确保已配置宿主机Nginx反向代理，否则无法通过域名访问"
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan

