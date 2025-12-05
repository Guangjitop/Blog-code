@echo off
chcp 65001 >nul
title 账号提取脚本

echo ========================================
echo         账号提取自动化脚本
echo ========================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.x
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查 codes.txt 是否存在
if not exist "codes.txt" (
    echo [错误] 未找到激活码文件 codes.txt
    echo 请在当前目录创建 codes.txt 文件，每行一个激活码
    echo.
    echo 示例内容:
    echo UQ07-MR2B-O2OY-2LF5
    echo XXXX-XXXX-XXXX-XXXX
    pause
    exit /b 1
)

REM 检查 requests 库是否安装
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo [提示] 正在安装 requests 库...
    pip install requests
    echo.
)

echo [提示] 开始运行脚本...
echo [提示] 按 Ctrl+C 可随时中断
echo.

python account_extractor.py

echo.
echo ========================================
echo         脚本运行完成
echo ========================================
pause

