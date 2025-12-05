@echo off
chcp 65001 >nul
echo ========================================
echo   一键推送到 GitHub
echo   目标仓库: https://github.com/Guangjitop/Blog-code
echo ========================================
echo.

:: 检查是否已初始化 Git
if not exist ".git" (
    echo [INFO] 初始化 Git 仓库...
    git init
    echo.
)

:: 检查远程仓库配置
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [INFO] 添加远程仓库...
    git remote add origin https://github.com/Guangjitop/Blog-code.git
) else (
    echo [INFO] 更新远程仓库地址...
    git remote set-url origin https://github.com/Guangjitop/Blog-code.git
)
echo.

:: 添加所有文件
echo [INFO] 添加所有更改...
git add .
echo.

:: 提交更改
set /p commit_msg="请输入提交信息 (直接回车使用默认信息): "
if "%commit_msg%"=="" set commit_msg=Update %date% %time:~0,8%

echo [INFO] 提交更改: %commit_msg%
git commit -m "%commit_msg%"
echo.

:: 推送到远程仓库
echo [INFO] 推送到 GitHub...
git push -u origin main
if errorlevel 1 (
    echo [WARN] main 分支推送失败，尝试 master 分支...
    git push -u origin master
)
echo.

echo ========================================
echo   推送完成！
echo ========================================
pause
