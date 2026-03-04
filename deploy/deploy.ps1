# ===========================================
# 统一部署脚本 - Windows PowerShell
# 一个脚本完成所有部署工作
# ===========================================
#
# 用法:
#   .\deploy\deploy.ps1                    # 交互式部署
#   .\deploy\deploy.ps1 -Auto              # 全自动部署
#   .\deploy\deploy.ps1 -Action status     # 查看状态
#   .\deploy\deploy.ps1 -Action stop       # 停止服务
#   .\deploy\deploy.ps1 -Action restart    # 重启服务
#   .\deploy\deploy.ps1 -Action logs       # 查看日志
#   .\deploy\deploy.ps1 -Action health     # 健康检查
#   .\deploy\deploy.ps1 -Action backup     # 备份数据库
#   .\deploy\deploy.ps1 -Action update     # 拉取代码并重新部署
#   .\deploy\deploy.ps1 -Domain "xxx.com"  # 指定域名
#   .\deploy\deploy.ps1 -Mode proxy        # 指定部署模式
#   .\deploy\deploy.ps1 -NoSSL             # 跳过 SSL
#
# ===========================================

param(
    [ValidateSet("deploy", "status", "stop", "restart", "logs", "health", "backup", "update")]
    [string]$Action = "deploy",

    [string]$Domain = "",
    [string]$Email = "",

    [ValidateSet("", "direct", "proxy")]
    [string]$Mode = "",

    [switch]$NoSSL,
    [switch]$Auto
)

# ============================================
# 常量
# ============================================
$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$DeployDir   = $ScriptDir
$ProjectRoot = Split-Path -Parent $DeployDir
$SSLDir      = Join-Path $DeployDir "ssl"
$BackupDir   = Join-Path $ProjectRoot "backups"
$ComposeFile = Join-Path $DeployDir "docker-compose.yml"
$ComposeProd = Join-Path $DeployDir "docker-compose.prod.yml"

# ============================================
# 工具函数
# ============================================
function Write-Info    { param($Msg) Write-Host "[INFO] $Msg" -ForegroundColor Green }
function Write-Warn    { param($Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Write-Err     { param($Msg) Write-Host "[ERROR] $Msg" -ForegroundColor Red }
function Write-Step    { param($Msg) Write-Host "`n=== $Msg ===" -ForegroundColor Cyan }
function Write-Ok      { param($Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }

function Confirm-Action {
    param([string]$Msg = "是否继续？")
    if ($Auto) { return $true }
    $reply = Read-Host "$Msg (y/n)"
    return ($reply -match '^[Yy]')
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments)]$Args)
    & docker compose -f $ComposeFile @Args
}

function Invoke-ComposeProd {
    param([Parameter(ValueFromRemainingArguments)]$Args)
    & docker compose -f $ComposeFile -f $ComposeProd @Args
}

function Test-PortInUse {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $conn -and $conn.Count -gt 0)
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# ============================================
# 子命令
# ============================================
function Invoke-Status {
    Write-Step "容器运行状态"
    Invoke-Compose ps
}

function Invoke-Stop {
    Write-Step "停止所有服务"
    Invoke-Compose down
    Write-Ok "服务已停止"
}

function Invoke-Restart {
    Write-Step "重启服务"
    Invoke-Compose restart
    Start-Sleep -Seconds 5
    Invoke-Health
}

function Invoke-Logs {
    Invoke-Compose logs -f --tail=100
}

function Invoke-Health {
    Write-Step "健康检查"

    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8999/docs" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { Write-Ok "后端服务正常 (port 8999)" }
        else { Write-Err "后端服务异常 (port 8999)" }
    } catch {
        Write-Err "后端服务异常 (port 8999)"
    }

    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8998/" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { Write-Ok "前端/Nginx 正常 (port 8998)" }
        else { Write-Err "前端/Nginx 异常 (port 8998)" }
    } catch {
        Write-Err "前端/Nginx 异常 (port 8998)"
    }
}

function Invoke-Backup {
    Write-Step "备份数据库"
    if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

    $dbFile = Join-Path $ProjectRoot "backend\accounts.db"
    if (Test-Path $dbFile) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $dest = Join-Path $BackupDir "accounts_$timestamp.db"
        Copy-Item $dbFile $dest
        Write-Ok "已备份到 backups\accounts_$timestamp.db"
    } else {
        Write-Warn "未找到数据库文件: $dbFile"
    }
}

function Invoke-Update {
    Write-Step "更新部署"
    Push-Location $ProjectRoot
    Write-Info "拉取最新代码..."
    git pull
    Pop-Location
    Write-Info "重新部署..."
    Invoke-Deploy
}

# ============================================
# 核心: 部署流程
# ============================================
function Invoke-Deploy {
    $totalSteps = 6
    $step = 0

    # ------------------------------------------
    # Step 1: 系统环境检查
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: 检查系统环境"

    # Docker Desktop
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "未安装 Docker Desktop"
        Write-Host "  下载: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
    Write-Ok "Docker 已安装"

    if (-not (Test-DockerRunning)) {
        Write-Err "Docker Desktop 未运行，请先启动 Docker Desktop"
        exit 1
    }
    Write-Ok "Docker 服务正在运行"

    # Docker Compose (V2 内置在 Docker Desktop 中)
    try {
        $null = docker compose version 2>&1
        Write-Ok "Docker Compose 可用"
    } catch {
        Write-Err "Docker Compose 不可用"
        exit 1
    }

    # ------------------------------------------
    # Step 2: 端口检测 & 模式选择
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: 端口检测与模式选择"

    $port80Free  = -not (Test-PortInUse 80)
    $port443Free = -not (Test-PortInUse 443)

    if ($port80Free)  { Write-Ok "端口 80 可用" }  else { Write-Warn "端口 80 被占用" }
    if ($port443Free) { Write-Ok "端口 443 可用" } else { Write-Warn "端口 443 被占用" }

    if (-not $Mode) {
        if ($port80Free -and $port443Free) {
            $Mode = "direct"
            Write-Info "80/443 端口空闲，推荐方案 A: Docker 直接监听 80/443"
        } else {
            $Mode = "proxy"
            Write-Info "80/443 端口被占用，自动选择方案 B: 反向代理模式"
        }
    }

    Write-Host ""
    $modeLabel = if ($Mode -eq "direct") { "方案A - 直接模式 (80/443)" } else { "方案B - 反向代理模式 (8998/8999)" }
    Write-Host "  当前部署模式: $modeLabel" -ForegroundColor White
    Write-Host ""
    Write-Host "  方案A (direct): Docker 容器直接监听 80/443，适合干净服务器"
    Write-Host "  方案B (proxy):  Docker 容器监听 8998/8999，由宿主机 Nginx/IIS 代理"
    Write-Host ""

    if (-not (Confirm-Action "使用当前模式继续？")) {
        $Mode = if ($Mode -eq "direct") { "proxy" } else { "direct" }
        Write-Info "已切换到: $(if ($Mode -eq 'direct') { '方案A' } else { '方案B' })"
    }

    # ------------------------------------------
    # Step 3: 配置环境
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: 配置环境"

    Push-Location $DeployDir

    $envFile = Join-Path $DeployDir ".env"
    $envExample = Join-Path $DeployDir ".env.example"

    if (-not (Test-Path $envFile)) {
        if (Test-Path $envExample) {
            Copy-Item $envExample $envFile
            Write-Ok "已从模板创建 .env"
        } else {
            $defaultDomain = if ($Domain) { $Domain } else { "localhost" }
            @"
DOMAIN=$defaultDomain
APP_PORT=80
APP_SSL_PORT=443
ADMIN_PASSWORD=admin121
SSL_ENABLED=false
"@ | Set-Content $envFile -Encoding UTF8
            Write-Ok "已创建 .env"
        }
        Write-Host "  请编辑 deploy\.env 修改管理员密码等配置"
    } else {
        Write-Ok ".env 已存在"
    }

    # 更新域名
    if ($Domain) {
        (Get-Content $envFile) -replace '^DOMAIN=.*', "DOMAIN=$Domain" | Set-Content $envFile
        Write-Info "域名已设置为: $Domain"
    } else {
        $Domain = ((Get-Content $envFile | Select-String '^DOMAIN=') -replace 'DOMAIN=', '').Trim()
        if (-not $Domain) { $Domain = "localhost" }
    }

    # 端口配置
    if ($Mode -eq "proxy") {
        (Get-Content $envFile) -replace '^APP_PORT=.*', 'APP_PORT=8998' | Set-Content $envFile
        Write-Info "APP_PORT 已设为 8998 (代理模式)"
    }

    # 确保必要目录
    if (-not (Test-Path $SSLDir))  { New-Item -ItemType Directory -Path $SSLDir -Force | Out-Null }
    Write-Ok "环境配置完成"

    Pop-Location

    # ------------------------------------------
    # Step 4: SSL 证书 (Windows 通常跳过)
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: SSL 证书"

    if ($NoSSL -or $Domain -eq "localhost") {
        Write-Info "跳过 SSL (本地开发环境)"
    } elseif ((Test-Path (Join-Path $SSLDir "fullchain.pem")) -and (Test-Path (Join-Path $SSLDir "privkey.pem"))) {
        Write-Ok "SSL 证书已存在"
    } else {
        Write-Info "Windows 环境建议使用以下方式获取 SSL 证书:"
        Write-Host "  1. 使用 Cloudflare 免费 SSL (推荐)"
        Write-Host "  2. 在 Linux 服务器上用 certbot 申请后复制到 deploy\ssl\"
        Write-Host "  3. 使用 win-acme: https://www.win-acme.com/"
    }

    # ------------------------------------------
    # Step 5: 构建并启动
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: 构建并启动服务"

    Push-Location $DeployDir

    Write-Info "停止旧容器..."
    try { Invoke-Compose down 2>$null } catch {}

    Write-Info "构建并启动... (首次可能需要 5-10 分钟)"
    if ($Mode -eq "direct") {
        Invoke-ComposeProd up -d --build
    } else {
        Invoke-Compose up -d --build
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "启动失败，查看日志:"
        Invoke-Compose logs --tail=30
        Pop-Location
        exit 1
    }
    Write-Ok "容器已启动"

    Write-Info "等待服务就绪..."
    Start-Sleep -Seconds 10

    Pop-Location

    # ------------------------------------------
    # Step 6: 验证
    # ------------------------------------------
    $step++
    Write-Step "步骤 $step/${totalSteps}: 验证部署"

    Invoke-Compose ps
    Write-Host ""
    Invoke-Health

    # ------------------------------------------
    # 部署完成
    # ------------------------------------------
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  部署完成!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "部署信息:" -ForegroundColor White
    $modeInfo = if ($Mode -eq "direct") { "方案A (直接模式 80/443)" } else { "方案B (反向代理 8998/8999)" }
    Write-Host "  模式: $modeInfo"
    Write-Host "  域名: $Domain"
    Write-Host ""
    Write-Host "访问地址:" -ForegroundColor White
    if ($Mode -eq "direct") {
        Write-Host "  前端:   http://${Domain}/"
        Write-Host "  后台:   http://${Domain}/app/"
        Write-Host "  API:    http://${Domain}/docs"
    } else {
        Write-Host "  前端:   http://localhost:8998/"
        Write-Host "  后台:   http://localhost:8998/app/"
        Write-Host "  API:    http://localhost:8999/docs"
    }
    Write-Host ""
    Write-Host "常用命令:" -ForegroundColor White
    Write-Host "  查看状态: .\deploy\deploy.ps1 -Action status"
    Write-Host "  查看日志: .\deploy\deploy.ps1 -Action logs"
    Write-Host "  健康检查: .\deploy\deploy.ps1 -Action health"
    Write-Host "  停止服务: .\deploy\deploy.ps1 -Action stop"
    Write-Host "  重启服务: .\deploy\deploy.ps1 -Action restart"
    Write-Host "  备份数据: .\deploy\deploy.ps1 -Action backup"
    Write-Host "  更新部署: .\deploy\deploy.ps1 -Action update"
    Write-Host ""

    if ($Mode -eq "proxy") {
        Write-Host "[重要] 方案B 额外步骤:" -ForegroundColor Yellow
        Write-Host "  需要配置 Nginx/IIS 将域名反向代理到 localhost:8998"
        Write-Host "  Nginx 参考: deploy\nginx\host-nginx-proxy.conf.example"
        Write-Host ""
    }
}

# ============================================
# 入口
# ============================================
switch ($Action) {
    "deploy"  { Invoke-Deploy }
    "status"  { Invoke-Status }
    "stop"    { Invoke-Stop }
    "restart" { Invoke-Restart }
    "logs"    { Invoke-Logs }
    "health"  { Invoke-Health }
    "backup"  { Invoke-Backup }
    "update"  { Invoke-Update }
}
