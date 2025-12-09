@echo off
REM ===========================================
REM 构建Docker镜像脚本 - Windows
REM ===========================================

cd /d "%~dp0..\.."

echo ==========================================
echo   Docker 镜像构建
echo ==========================================
echo.

REM 检查.env.images文件
if not exist "deploy\.env.images" (
    echo [警告] 未找到 .env.images 文件
    echo 正在从模板创建...
    if exist "deploy\.env.images.example" (
        copy "deploy\.env.images.example" "deploy\.env.images"
        echo [完成] 已创建 .env.images 文件，请编辑配置后再运行此脚本
        pause
        exit /b 1
    ) else (
        echo [错误] 未找到 .env.images.example 模板文件
        pause
        exit /b 1
    )
)

echo [信息] 正在加载配置...
echo.

REM 注意: Windows批处理无法直接source .env文件
REM 需要手动设置环境变量或使用其他方式
echo [提示] 请确保已设置以下环境变量:
echo   IMAGE_REGISTRY - 镜像仓库地址
echo   IMAGE_USERNAME - 用户名/组织名
echo   IMAGE_TAG - 镜像标签 (可选，默认latest)
echo.

set /p IMAGE_REGISTRY="请输入镜像仓库地址 (默认: docker.io): "
if "%IMAGE_REGISTRY%"=="" set IMAGE_REGISTRY=docker.io

set /p IMAGE_USERNAME="请输入用户名/组织名: "
if "%IMAGE_USERNAME%"=="" (
    echo [错误] IMAGE_USERNAME 不能为空
    pause
    exit /b 1
)

set /p IMAGE_TAG="请输入镜像标签 (默认: latest): "
if "%IMAGE_TAG%"=="" set IMAGE_TAG=latest

set BACKEND_IMAGE=%IMAGE_REGISTRY%/%IMAGE_USERNAME%/blog-backend:%IMAGE_TAG%
set FRONTEND_IMAGE=%IMAGE_REGISTRY%/%IMAGE_USERNAME%/blog-frontend:%IMAGE_TAG%

echo.
echo [信息] 镜像配置:
echo   仓库: %IMAGE_REGISTRY%
echo   用户: %IMAGE_USERNAME%
echo   标签: %IMAGE_TAG%
echo.
echo   后端镜像: %BACKEND_IMAGE%
echo   前端镜像: %FRONTEND_IMAGE%
echo.
echo ==========================================
echo.

REM 构建后端镜像
echo [构建] 正在构建后端镜像...
docker build -f deploy\Dockerfile.backend -t %BACKEND_IMAGE% .
if errorlevel 1 (
    echo [错误] 后端镜像构建失败
    pause
    exit /b 1
)
echo [完成] 后端镜像构建完成: %BACKEND_IMAGE%
echo.

REM 构建前端镜像
echo [构建] 正在构建前端镜像...
docker build -f deploy\Dockerfile.frontend -t %FRONTEND_IMAGE% .
if errorlevel 1 (
    echo [错误] 前端镜像构建失败
    pause
    exit /b 1
)
echo [完成] 前端镜像构建完成: %FRONTEND_IMAGE%
echo.

echo ==========================================
echo [完成] 所有镜像构建完成！
echo.
echo [提示] 下一步: 运行 push-images.cmd 推送镜像到仓库
echo ==========================================
echo.

pause









