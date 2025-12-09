@echo off
REM ==========================================
REM Docker 日志查看脚本 (Windows)
REM ==========================================

echo ========================================
echo   查看 Docker 服务日志
echo ========================================
echo.
echo 按 Ctrl+C 退出日志查看
echo.

REM 进入 deploy 目录
cd /d "%~dp0..\deploy"

REM 查看所有服务的日志
docker-compose logs -f --tail=100
