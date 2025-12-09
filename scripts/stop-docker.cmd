@echo off
REM ==========================================
REM Docker 开发环境停止脚本 (Windows)
REM ==========================================

echo ========================================
echo   停止 Docker 开发环境
echo ========================================
echo.

REM 进入 deploy 目录
cd /d "%~dp0..\deploy"

echo 正在停止所有服务...
docker-compose down

if errorlevel 1 (
    echo.
    echo [错误] 停止失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   所有服务已停止
echo ========================================
echo.
pause
