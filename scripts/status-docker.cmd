@echo off
REM ==========================================
REM Docker 服务状态检查脚本 (Windows)
REM ==========================================

echo ========================================
echo   Docker 服务状态检查
echo ========================================
echo.

REM 进入 deploy 目录
cd /d "%~dp0..\deploy"

echo [1/4] 容器状态：
echo.
docker-compose ps
echo.

echo [2/4] 健康检查：
echo.
echo 后端健康检查：
curl -s http://localhost:8999/api/music/health | python -m json.tool 2>nul || echo 后端服务未响应
echo.

echo [3/4] 服务访问测试：
echo.
echo 前端首页 (http://localhost:8998/):
curl -s -o nul -w "HTTP状态码: %%{http_code}\n" http://localhost:8998/
echo.
echo 后端API文档 (http://localhost:8999/docs):
curl -s -o nul -w "HTTP状态码: %%{http_code}\n" http://localhost:8999/docs
echo.
echo 音乐API (http://localhost:3000/):
curl -s -o nul -w "HTTP状态码: %%{http_code}\n" http://localhost:3000/
echo.

echo [4/4] 最近日志（最后10行）：
echo.
docker-compose logs --tail=10
echo.

echo ========================================
echo   状态检查完成
echo ========================================
echo.
echo 访问地址：
echo   - 前端首页:     http://localhost:8998/
echo   - 管理后台:     http://localhost:8998/app/
echo   - 后端API文档:  http://localhost:8999/docs
echo   - 音乐API:      http://localhost:3000/
echo   - 健康检查:     http://localhost:8999/api/music/health
echo.
pause
