@echo off
REM ===========================================
REM 启动脚本 - Windows
REM ===========================================

cd /d "%~dp0.."

echo ==========================================
echo   账号管理系统 - Docker 部署
echo ==========================================

REM 检查.env文件
if not exist ".env" (
    echo [警告] 未找到 .env 文件，正在从模板创建...
    copy .env.example .env
    echo [完成] 已创建 .env 文件，请根据需要修改配置
)

echo.
echo [信息] 正在构建并启动容器...
echo.

REM 构建并启动
docker-compose up -d --build

echo.
echo ==========================================
echo [完成] 部署成功！
echo.
echo 访问地址:
echo   欢迎页: http://localhost/
echo   应用:   http://localhost/app/
echo   API文档: http://localhost/docs
echo.
echo 常用命令:
echo   查看日志: scripts\logs.cmd
echo   停止服务: scripts\stop.cmd
echo ==========================================

pause
