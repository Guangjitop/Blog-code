#!/usr/bin/env python3
"""
详细诊断音乐API问题
"""

import httpx
import json
import os
import sys

# 测试配置 - 默认使用生产环境地址
BACKEND_URL = sys.argv[1] if len(sys.argv) > 1 else "http://107.174.140.100:8999"
TEST_URL = f"{BACKEND_URL}/api/meting?type=playlist&id=3778678&server=netease"

print("="*70)
print("音乐API详细诊断 - 模拟外部访问")
print("="*70)
print(f"后端地址: {BACKEND_URL}")
print(f"测试URL: {TEST_URL}")
print(f"说明: 模拟外部用户访问生产环境后端API")
print()

# 1. 测试后端连接
print("1. 测试后端连接...")
try:
    health_check = httpx.get(f"{BACKEND_URL}/docs", timeout=5)
    print(f"   ✅ 后端服务运行正常 (状态码: {health_check.status_code})")
except Exception as e:
    print(f"   ❌ 后端服务无法访问: {e}")
    sys.exit(1)

# 2. 测试音乐API端点
print("\n2. 测试音乐API端点...")
try:
    response = httpx.get(TEST_URL, timeout=30, follow_redirects=True)
    print(f"   状态码: {response.status_code}")
    print(f"   响应头: {dict(response.headers)}")
    print(f"   响应体长度: {len(response.content)} bytes")
    
    # 尝试解析响应
    if response.content:
        try:
            data = response.json()
            print(f"   ✅ JSON响应:")
            print(f"   {json.dumps(data, ensure_ascii=False, indent=2)[:1000]}")
            
            # 检查错误信息
            if isinstance(data, dict) and "error" in data:
                print(f"\n   ❌ 错误信息: {data.get('error')}")
                print(f"   错误代码: {data.get('code')}")
                
                if "attempts" in data:
                    print(f"\n   尝试记录:")
                    for idx, attempt in enumerate(data.get("attempts", []), 1):
                        print(f"     尝试 {idx}:")
                        print(f"       端点: {attempt.get('endpoint')}")
                        print(f"       错误类型: {attempt.get('error_type')}")
                        print(f"       错误信息: {attempt.get('error_message')}")
                        print(f"       响应时间: {attempt.get('response_time', 0):.2f}秒")
                
                if "suggestion" in data:
                    print(f"   建议: {data.get('suggestion')}")
        except:
            print(f"   ⚠️  非JSON响应:")
            print(f"   {response.text[:500]}")
    else:
        print(f"   ❌ 响应体为空!")
        print(f"   这可能表示后端返回了错误但没有响应体")
        
except httpx.TimeoutException:
    print(f"   ❌ 请求超时 (30秒)")
except Exception as e:
    print(f"   ❌ 请求失败: {e}")
    import traceback
    traceback.print_exc()

# 3. 检查环境变量配置（如果在本地）
print("\n3. 检查配置...")
if os.path.exists('/.dockerenv'):
    print("   运行环境: Docker容器")
else:
    print("   运行环境: 直接部署")

# 检查环境变量
meting_url = os.getenv("METING_API_URL")
if meting_url:
    print(f"   METING_API_URL: {meting_url}")
    endpoints = [url.strip() for url in meting_url.split(",") if url.strip()]
    print(f"   配置的端点 ({len(endpoints)} 个):")
    for idx, ep in enumerate(endpoints, 1):
        print(f"     {idx}. {ep}")
else:
    print("   METING_API_URL: 未设置（将使用默认配置）")

# 4. 测试直接连接音乐API端点
print("\n4. 测试直接连接音乐API端点...")
test_endpoints = [
    "http://localhost:3000/",
    "http://127.0.0.1:3000/",
    "http://host.docker.internal:3000/",
    "http://107.174.140.100:3000/"
]

for endpoint in test_endpoints:
    test_path = "?type=playlist&id=3778678&server=netease"
    test_url = f"{endpoint.rstrip('/')}{test_path}"
    print(f"\n   测试: {endpoint}")
    try:
        timeout = httpx.Timeout(8.0, connect=3.0)
        r = httpx.get(test_url, timeout=timeout)
        print(f"     ✅ 连接成功 (状态码: {r.status_code})")
        if r.status_code == 200:
            try:
                data = r.json()
                if isinstance(data, list):
                    print(f"     ✅ 返回 {len(data)} 条数据")
                else:
                    print(f"     ✅ 返回数据: {type(data).__name__}")
            except:
                print(f"     ⚠️  响应不是JSON")
    except httpx.ConnectError as e:
        print(f"     ❌ 连接失败: {str(e)[:100]}")
    except httpx.TimeoutException:
        print(f"     ❌ 连接超时")
    except Exception as e:
        print(f"     ❌ 错误: {str(e)[:100]}")

print("\n" + "="*70)
print("诊断完成")
print("="*70)

