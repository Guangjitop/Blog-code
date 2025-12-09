@echo off
REM ==========================================
REM Docker 开发环境启动脚本 (Windows)
REM ==========================================

echo ========================================
echo   启动 Docker 开发环境
echo ========================================
echo.

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

echo [1/4] 检查 Docker 状态... OK
echo.

REM 进入 deploy 目录
cd /d "%~dp0..\deploy"

echo [2/4] 停止现有容器...
docker-compose down
echo.

echo [3/4] 构建并启动服务...
echo 这可能需要几分钟时间，请耐心等待...
echo.
docker-compose up -d --build

if errorlevel 1 (
    echo.
    echo [错误] 启动失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo [4/4] 等待服务启动...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   服务启动成功！
echo ========================================
echo.
echo 访问地址：
echo   - 前端首页:     http://localhost:8998/
echo   - 管理后台:     http://localhost:8998/app/
echo   - 后端API文档:  http://localhost:8999/docs
echo   - 音乐API:      http://localhost:3000/
echo   - 健康检查:     http://localhost:8999/api/music/health
echo.
echo 查看日志: docker-compose logs -f
echo 停止服务: docker-compose down
echo.

REM 显示容器状态
echo 容器状态：
docker-compose ps

echo.
pause
