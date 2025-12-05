"""
账号管理系统 - 测试脚本
演示如何使用API接口
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    """美化打印响应"""
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print(f"{'='*60}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

def main():
    print("🚀 账号管理系统测试")
    
    # 1. 查看统计信息
    response = requests.get(f"{BASE_URL}/api/stats")
    print_response("统计信息", response)
    
    # 2. 查看所有账号
    response = requests.get(f"{BASE_URL}/admin/accounts")
    print_response("所有账号列表", response)
    
    # 3. 获取一个未使用的账号
    response = requests.get(f"{BASE_URL}/api/get-account")
    print_response("获取账号(自动标记)", response)
    
    # 4. 再次查看统计
    response = requests.get(f"{BASE_URL}/api/stats")
    print_response("更新后的统计信息", response)
    
    # 5. 添加新账号
    response = requests.get(
        f"{BASE_URL}/admin/accounts/add",
        params={"email": "newuser@example.com", "password": "newpass123"}
    )
    print_response("添加新账号", response)
    
    # 6. 重置所有标记
    response = requests.get(f"{BASE_URL}/admin/accounts/reset-all")
    print_response("重置所有账号标记", response)
    
    print("\n✅ 测试完成!")

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("❌ 错误: 无法连接到服务器,请确保服务器正在运行!")
        print("运行命令: python main.py")
    except Exception as e:
        print(f"❌ 错误: {e}")
