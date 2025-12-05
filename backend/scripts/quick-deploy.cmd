@echo off
chcp 65001 > nul 2>&1

:: 快速部署脚本 - 一键安装并启动
:: 使用方法: 双击运行 quick-deploy.cmd

echo ========================================
echo   账号管理系统 - 快速部署（Windows版）
echo ========================================
echo.

:: 设置端口号
set "PORT=8998"

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
:: 项目目录 = 脚本目录的上一级目录
for %%i in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fi"

:: 检测Python环境
echo [信息] 检测 Python 环境...
set "PYTHON_CMD="

python --version > nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    for /f "delims=" %%v in ('python --version 2^>^&1') do echo [信息] 找到: %%v
    goto :check_pip
)

python3 --version > nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python3"
    for /f "delims=" %%v in ('python3 --version 2^>^&1') do echo [信息] 找到: %%v
    goto :check_pip
)

echo [错误] 未找到 Python，请先安装 Python 3.7+
pause
exit /b 1

:check_pip
:: 检查pip是否可用
echo [信息] 检查 pip 环境...
%PYTHON_CMD% -m pip --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] pip 未安装或不可用
    pause
    exit /b 1
)
echo [信息] pip 可用

:: 检查端口占用
echo [信息] 检查端口 %PORT% 占用情况...
set "PID_FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set "PID_FOUND=%%a"
)

if defined PID_FOUND (
    echo [警告] 端口 %PORT% 已被占用，PID: %PID_FOUND%
    echo.
    set /p "KILL_CHOICE=是否结束占用进程？(Y/N): "
    if /i "%KILL_CHOICE%"=="Y" (
        echo [信息] 正在结束进程 %PID_FOUND%...
        taskkill /F /PID %PID_FOUND% > nul 2>&1
        if %errorlevel% equ 0 (
            echo [信息] 进程已结束
            timeout /t 2 > nul
        ) else (
            echo [错误] 无法结束进程，请手动关闭或以管理员身份运行
            pause
            exit /b 1
        )
    ) else (
        echo [信息] 取消启动
        pause
        exit /b 0
    )
)
echo [信息] 端口 %PORT% 可用

:: 进入项目目录
cd /d "%PROJECT_DIR%"
if %errorlevel% neq 0 (
    echo [错误] 无法进入项目目录: %PROJECT_DIR%
    pause
    exit /b 1
)
echo [信息] 项目目录: %PROJECT_DIR%

:: 安装Python依赖
echo [信息] 安装 Python 依赖（请等待）...
if not exist "requirements.txt" (
    echo [错误] 未找到 requirements.txt 文件
    pause
    exit /b 1
)

%PYTHON_CMD% -m pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo [警告] 常规安装失败，尝试忽略缓存重新安装...
    %PYTHON_CMD% -m pip install --no-cache-dir -r requirements.txt
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
)
echo [信息] 依赖安装完成

:: -------------------------
:: 前端构建部分 (新增)
:: -------------------------
echo.
echo [信息] 检查前端构建环境...

:: 检查 Node.js
call node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 Node.js，跳过前端构建。
    echo [提示] 如果您修改了前端代码，请安装 Node.js 并运行构建，否则无法生效。
    goto :start_service
)

echo [信息] 发现 Node.js，准备构建前端...
:: 定位前端目录 (backend同级的frontend)
set "FRONTEND_DIR=%PROJECT_DIR%\..\frontend"

if not exist "%FRONTEND_DIR%" (
    echo [警告] 未找到前端目录: %FRONTEND_DIR%
    goto :start_service
)

pushd "%FRONTEND_DIR%"

:: 检查 node_modules
if not exist "node_modules" (
    echo [信息] 正在安装前端依赖 (首次运行可能较慢)...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        popd
        goto :start_service
    )
)

:: 执行构建
echo [信息] 正在编译前端代码...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 前端编译失败
    popd
    goto :start_service
)
echo [信息] 前端构建完成
popd

:start_service
:: 启动服务
echo.
echo [信息] 准备启动服务...

:: 直接用 Python 启动
echo [信息] 启动 Python 服务...
start "账号管理系统" /D "%PROJECT_DIR%" %PYTHON_CMD% -m uvicorn main:app --reload --host 0.0.0.0 --port %PORT%

:success
echo.
echo ========================================
echo [信息] 部署完成！
echo ========================================
echo.
echo 用户端: http://localhost:%PORT%/user
echo 管理端: http://localhost:%PORT%/admin
echo API文档: http://localhost:%PORT%/docs
echo.
echo 管理员密码: admin112211
echo.

pause
exit /b 0
