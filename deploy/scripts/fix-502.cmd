@echo off
REM Windows版本的502修复脚本

echo ============================================================
echo 502错误诊断和修复工具
echo ============================================================
echo.

REM 检查Docker是否运行
docker ps >nul 2>&1
if errorlevel 1 (
    echo Docker未运行，请先启动Docker Desktop
    pause
    exit /b 1
)

echo 1. 检查容器状态...
docker ps -a | findstr /i "backend nginx"
echo.

echo 2. 检查后端容器...
docker ps | findstr /i "account-backend" >nul
if errorlevel 1 (
    echo   后端容器未运行，尝试启动...
    docker start account-backend
    timeout /t 3 >nul
) else (
    echo   ✅ 后端容器正在运行
)
echo.

echo 3. 检查Nginx容器...
docker ps | findstr /i "account-nginx" >nul
if errorlevel 1 (
    echo   Nginx容器未运行，尝试启动...
    docker start account-nginx
    timeout /t 3 >nul
) else (
    echo   ✅ Nginx容器正在运行
)
echo.

echo 4. 重启所有服务...
cd /d "%~dp0\.."
docker-compose restart
timeout /t 5 >nul

echo.
echo 5. 检查最终状态...
docker ps | findstr /i "backend nginx"
echo.

echo ============================================================
echo 诊断完成
echo ============================================================
echo.
echo 如果问题仍然存在，请查看日志：
echo   docker logs account-backend --tail 100
echo   docker logs account-nginx --tail 100
echo.
pause









