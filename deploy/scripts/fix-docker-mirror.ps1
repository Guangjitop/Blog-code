# ===========================================
# Docker 镜像源修复脚本 - Windows PowerShell
# ===========================================

Write-Host "=========================================="
Write-Host "  Docker 镜像源修复工具"
Write-Host "=========================================="
Write-Host ""

# 检查 Docker 是否运行
$dockerRunning = docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker 正在运行" -ForegroundColor Green
Write-Host ""

# 方法1: 尝试手动拉取镜像
Write-Host "方法1: 尝试手动拉取所需镜像..." -ForegroundColor Yellow
Write-Host ""

$images = @("node:20-alpine", "nginx:alpine", "python:3.11-slim")

foreach ($image in $images) {
    Write-Host "正在拉取: $image ..." -NoNewline
    docker pull $image 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ 成功" -ForegroundColor Green
    } else {
        Write-Host " ❌ 失败" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host ""

# 方法2: 提供镜像源配置建议
Write-Host "方法2: 如果拉取失败，请手动配置镜像源" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 打开 Docker Desktop"
Write-Host "2. 进入 Settings → Docker Engine"
Write-Host "3. 修改 registry-mirrors 为以下配置："
Write-Host ""
Write-Host '{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}' -ForegroundColor Cyan
Write-Host ""
Write-Host "4. 点击 Apply & Restart"
Write-Host ""
Write-Host "=========================================="
Write-Host ""

# 方法3: 检查当前镜像
Write-Host "方法3: 检查已存在的镜像..." -ForegroundColor Yellow
Write-Host ""
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | Select-String -Pattern "node|nginx|python"
Write-Host ""

Write-Host "如果镜像已存在，可以直接运行构建命令" -ForegroundColor Green
Write-Host ""

