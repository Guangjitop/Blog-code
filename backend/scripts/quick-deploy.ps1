# 快速部署脚本 (Windows PowerShell) - 一键安装并启动
# 使用方法: .\quick-deploy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  账号管理系统 - 快速部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 设置端口号
$PORT = 8999

# 获取脚本所在目录
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

# 打印彩色信息
function Print-Info {
    param([string]$Message)
    Write-Host "[信息] $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[错误] $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[警告] $Message" -ForegroundColor Yellow
}

# 检测Python
Print-Info "检测 Python 环境..."
$PYTHON_CMD = $null

if (Get-Command python -ErrorAction SilentlyContinue) {
    $PYTHON_CMD = "python"
}
elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $PYTHON_CMD = "python3"
}
else {
    Print-Error "未找到 Python,请先安装 Python 3.7+"
    Write-Host ""
    Write-Host "下载地址: https://www.python.org/downloads/"
    exit 1
}

$PYTHON_VERSION = & $PYTHON_CMD --version 2>&1
Print-Info "找到: $PYTHON_VERSION"

# 检查pip
Print-Info "检查 pip..."
$pipCheck = & $PYTHON_CMD -m pip --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Print-Error "pip 未安装,请先安装 pip"
    exit 1
}

# 检查端口占用
Print-Info "检查端口 $PORT 占用情况..."
$portProcess = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($portProcess) {
    $pid = $portProcess.OwningProcess
    $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
    
    Print-Warning "端口 $PORT 已被占用"
    Write-Host "  进程ID: $pid" -ForegroundColor Yellow
    Write-Host "  进程名: $processName" -ForegroundColor Yellow
    Write-Host ""
    
    $choice = Read-Host "是否结束占用进程？(Y/N)"
    if ($choice -eq 'Y' -or $choice -eq 'y') {
        Print-Info "正在结束进程 $pid ($processName)..."
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Print-Info "进程已结束"
            Start-Sleep -Seconds 2
        }
        catch {
            Print-Error "无法结束进程，请手动关闭或以管理员身份运行"
            Write-Host "错误: $_" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Print-Info "取消启动"
        exit 0
    }
}
Print-Info "端口 $PORT 可用"

# 进入项目目录
Set-Location $PROJECT_DIR

# 安装依赖
Print-Info "安装 Python 依赖..."
$REQUIREMENTS_FILE = Join-Path $PROJECT_DIR "requirements.txt"

if (Test-Path $REQUIREMENTS_FILE) {
    Print-Info "正在安装依赖包..."
    & $PYTHON_CMD -m pip install -r $REQUIREMENTS_FILE -q 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Print-Info "依赖安装完成"
    }
    else {
        Print-Warning "安装出现问题，重试中..."
        & $PYTHON_CMD -m pip install -r $REQUIREMENTS_FILE --no-cache-dir 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Print-Error "依赖安装失败"
            exit 1
        }
        Print-Info "依赖安装完成"
    }
}
else {
    Print-Error "未找到 requirements.txt"
    exit 1
}

# 启动服务
Print-Info "启动服务..."
Start-Process -FilePath $PYTHON_CMD -ArgumentList "-m uvicorn main:app --reload --host 0.0.0.0 --port $PORT" -WorkingDirectory $PROJECT_DIR -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Print-Info "部署完成!"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "用户端: http://localhost:$PORT/user" -ForegroundColor Green
Write-Host "管理端: http://localhost:$PORT/admin" -ForegroundColor Green
Write-Host "API文档: http://localhost:$PORT/docs" -ForegroundColor Green
Write-Host ""
Write-Host "管理员密码: admin112211" -ForegroundColor Yellow
Write-Host ""
