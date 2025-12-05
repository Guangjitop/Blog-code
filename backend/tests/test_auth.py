"""
测试用户端API授权验证
验证未授权访问被阻止，授权访问正常工作
"""
import requests

BASE_URL = "http://localhost:8000"

def test_unauthorized_access():
    """测试未授权访问应该被阻止"""
    print("=" * 50)
    print("测试1: 未授权访问应该被阻止")
    print("=" * 50)
    
    endpoints = [
        "/api/stats",
        "/api/get-account",
        "/api/query",
        "/api/query/password?email=test@example.com"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            if response.status_code == 401:
                print(f"✓ {endpoint} - 正确返回401未授权")
            else:
                print(f"✗ {endpoint} - 错误！返回状态码: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"✗ {endpoint} - 请求失败: {e}")
    
    print()

def test_authorized_access():
    """测试授权访问应该正常工作"""
    print("=" * 50)
    print("测试2: 测试授权访问（需要先登录）")
    print("=" * 50)
    print("提示：此测试需要手动登录后运行")
    print("1. 访问 http://localhost:8000/user")
    print("2. 使用授权码登录")
    print("3. 手动测试以下端点：")
    print("   - http://localhost:8000/api/stats")
    print("   - http://localhost:8000/api/get-account")
    print()

if __name__ == "__main__":
    print("开始测试用户端API授权验证...\n")
    test_unauthorized_access()
    test_authorized_access()
    print("测试完成！")
