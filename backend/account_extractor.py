#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
账号提取自动化脚本
从激活码文件读取激活码，自动请求API获取账号信息并保存为JSON
"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

# ==================== 配置项 ====================
API_URL = "https://server.ilovebaipiao.online/api/client/accounts/extract"
PLATFORM = "antigravity"          # 平台类型
ACCOUNT_TYPE = "exclusive"        # 账号类型
CODES_FILE = "codes.txt"          # 激活码文件路径
OUTPUT_FILE = "accounts.json"     # 输出文件路径
INTERVAL_SECONDS = 60             # 请求间隔（秒）
USES_PER_CODE = 3                 # 每个激活码使用次数
# ================================================


def log(message: str):
    """打印带时间戳的日志"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def load_codes(filepath: str) -> list:
    """从文件加载激活码列表"""
    path = Path(filepath)
    if not path.exists():
        log(f"错误：激活码文件 {filepath} 不存在！")
        return []
    
    codes = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            code = line.strip()
            if code and not code.startswith("#"):  # 忽略空行和注释
                codes.append(code)
    
    log(f"已加载 {len(codes)} 个激活码")
    return codes


def load_existing_accounts(filepath: str) -> list:
    """加载已存在的账号数据"""
    path = Path(filepath)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_accounts(filepath: str, accounts: list):
    """保存账号数据到JSON文件"""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(accounts, f, ensure_ascii=False, indent=2)


def extract_account(code: str) -> dict | None:
    """
    使用激活码请求API获取账号
    返回账号信息字典，失败返回None
    """
    payload = {
        "code": code,
        "platform": PLATFORM,
        "accountType": ACCOUNT_TYPE
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("success"):
            account = data.get("data", {}).get("account", {})
            points = data.get("data", {}).get("points", {})
            
            log(f"✓ 提取成功: {data.get('message', '')}")
            log(f"  邮箱: {account.get('email', 'N/A')}")
            log(f"  积分: 已用 {points.get('spent', 0)}, 剩余 {points.get('remaining', 0)}")
            
            return account
        else:
            log(f"✗ 提取失败: {data.get('message', '未知错误')}")
            return None
            
    except requests.exceptions.Timeout:
        log("✗ 请求超时")
        return None
    except requests.exceptions.RequestException as e:
        log(f"✗ 网络错误: {e}")
        return None
    except json.JSONDecodeError:
        log("✗ 响应解析失败")
        return None


def main():
    """主函数"""
    log("=" * 50)
    log("账号提取脚本启动")
    log(f"API: {API_URL}")
    log(f"平台: {PLATFORM}, 类型: {ACCOUNT_TYPE}")
    log(f"每个激活码使用次数: {USES_PER_CODE}")
    log(f"请求间隔: {INTERVAL_SECONDS} 秒")
    log("=" * 50)
    
    # 加载激活码
    codes = load_codes(CODES_FILE)
    if not codes:
        log("没有可用的激活码，程序退出")
        return
    
    # 加载已有账号
    accounts = load_existing_accounts(OUTPUT_FILE)
    log(f"已有 {len(accounts)} 个账号记录")
    
    # 统计
    total_requests = 0
    successful_extracts = 0
    
    try:
        for code_index, code in enumerate(codes):
            log("-" * 40)
            log(f"当前激活码 [{code_index + 1}/{len(codes)}]: {code}")
            
            for use_count in range(USES_PER_CODE):
                log(f"  第 {use_count + 1}/{USES_PER_CODE} 次请求...")
                
                account = extract_account(code)
                total_requests += 1
                
                if account:
                    email = account.get("email", "")
                    password = account.get("password", "")
                    
                    if email and password:
                        # 检查是否已存在
                        exists = any(acc[0] == email for acc in accounts)
                        if not exists:
                            accounts.append([email, password])
                            save_accounts(OUTPUT_FILE, accounts)
                            successful_extracts += 1
                            log(f"  已保存新账号，当前共 {len(accounts)} 个")
                        else:
                            log(f"  账号已存在，跳过保存")
                
                # 如果不是最后一次请求，等待间隔
                is_last_code = (code_index == len(codes) - 1)
                is_last_use = (use_count == USES_PER_CODE - 1)
                
                if not (is_last_code and is_last_use):
                    log(f"  等待 {INTERVAL_SECONDS} 秒...")
                    time.sleep(INTERVAL_SECONDS)
        
        log("=" * 50)
        log("所有激活码已用完，程序结束")
        log(f"总请求次数: {total_requests}")
        log(f"成功提取: {successful_extracts} 个新账号")
        log(f"账号文件: {OUTPUT_FILE}")
        log("=" * 50)
        
    except KeyboardInterrupt:
        log("\n用户中断，正在保存数据...")
        save_accounts(OUTPUT_FILE, accounts)
        log(f"已保存 {len(accounts)} 个账号到 {OUTPUT_FILE}")
        log("程序退出")


if __name__ == "__main__":
    main()

