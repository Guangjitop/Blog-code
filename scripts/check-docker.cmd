@echo off
REM ==========================================
REM Docker 环境检查脚本 (Windows)
REM ==========================================

echo ========================================
echo   Docker 环境检查
echo ========================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker 未安装
    echo     请访问 https://www.docker.com/products/docker-desktop 下载安装
    goto :end
) else (
    echo [√] Docker 已安装
    docker --version
)

echo.

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker 未运行
    echo     请启动 Docker Desktop
    goto :end
) else (
    echo [√] Docker 正在运行
)

echo.

REM 检查 docker-compose 是否可用
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo [X] docker-compose 不可用
        goto :end
    ) else (
        echo [√] docker compose 可用
        docker compose version
    )
) else (
    echo [√] docker-compose 可用
    docker-compose --version
)

echo.

REM 检查容器状态
cd /d "%~dp0..\deploy"
echo 当前容器状态：
echo.
docker-compose ps

echo.
echo ========================================
echo   环境检查完成
echo ========================================
echo.
echo 如果所有检查都通过，可以运行：
echo   scripts\start-docker.cmd
echo.

:end
pause
