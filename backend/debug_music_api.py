#!/usr/bin/env python3
"""
音乐API连接调试脚本
用于诊断生产环境中音乐API连接问题
"""

import httpx
import time
import os
from datetime import datetime

# 测试端点列表
ENDPOINTS = [
    "http://localhost:3000/",
    "http://127.0.0.1:3000/",
    "http://host.docker.internal:3000/",
    "http://107.174.140.100:3000/"
]

# 测试API路径
TEST_PATHS = [
    "?type=playlist&id=3778678&server=netease",  # 热门歌单
    "?type=search&s=周杰伦&server=netease",       # 搜索测试
]

def print_header(text):
    """打印标题"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60)

def check_environment():
    """检查运行环境"""
    print_header("环境检测")
    is_docker = os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')
    print(f"运行环境: {'Docker容器' if is_docker else '直接部署'}")
    print(f"推荐端点: {'http://host.docker.internal:3000/' if is_docker else 'http://localhost:3000/'}")
    return is_docker

def test_endpoint(endpoint, path="", timeout=10):
    """测试单个端点"""
    url = f"{endpoint.rstrip('/')}/{path.lstrip('/')}"
    
    print(f"\n测试: {url}")
    print(f"超时设置: {timeout}秒")
    
    start_time = time.time()
    
    try:
        # 创建客户端，设置超时
        timeout_config = httpx.Timeout(timeout, connect=5.0)
        
        with httpx.Client(timeout=timeout_config, follow_redirects=True) as client:
            response = client.get(url)
            elapsed = time.time() - start_time
            
            print(f"✅ 成功!")
            print(f"   状态码: {response.status_code}")
            print(f"   响应时间: {elapsed:.2f}秒")
            print(f"   响应大小: {len(response.content)} bytes")
            
            # 尝试解析JSON
            try:
                data = response.json()
                if isinstance(data, list):
                    print(f"   返回数据: {len(data)} 条记录")
                elif isinstance(data, dict):
                    print(f"   返回数据: {list(data.keys())}")
            except:
                print(f"   响应内容: {response.text[:100]}...")
            
            return True, elapsed
            
    except httpx.ConnectError as e:
        elapsed = time.time() - start_time
        print(f"❌ 连接失败 ({elapsed:.2f}秒)")
        print(f"   错误: {str(e)}")
        print(f"   原因: 无法连接到服务器，可能服务未启动或端口不可达")
        return False, elapsed
        
    except httpx.TimeoutException as e:
        elapsed = time.time() - start_time
        print(f"❌ 超时 ({elapsed:.2f}秒)")
        print(f"   错误: {str(e)}")
        print(f"   原因: 请求超过{timeout}秒未响应")
        return False, elapsed
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ 其他错误 ({elapsed:.2f}秒)")
        print(f"   错误类型: {type(e).__name__}")
        print(f"   错误信息: {str(e)}")
        return False, elapsed

def main():
    """主函数"""
    print_header(f"音乐API连接诊断工具")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 检查环境
    is_docker = check_environment()
    
    # 测试基础连接
    print_header("基础连接测试")
    results = {}
    
    for endpoint in ENDPOINTS:
        success, elapsed = test_endpoint(endpoint, timeout=10)
        results[endpoint] = (success, elapsed)
    
    # 测试API功能
    print_header("API功能测试")
    
    # 找出第一个成功的端点
    working_endpoint = None
    for endpoint, (success, _) in results.items():
        if success:
            working_endpoint = endpoint
            break
    
    if working_endpoint:
        print(f"\n使用端点: {working_endpoint}")
        for path in TEST_PATHS:
            test_endpoint(working_endpoint, path, timeout=15)
    else:
        print("\n⚠️  没有可用的端点，跳过API功能测试")
    
    # 总结
    print_header("诊断总结")
    
    success_count = sum(1 for success, _ in results.values() if success)
    
    print(f"\n测试端点数: {len(ENDPOINTS)}")
    print(f"成功: {success_count}")
    print(f"失败: {len(ENDPOINTS) - success_count}")
    
    print("\n详细结果:")
    for endpoint, (success, elapsed) in results.items():
        status = "✅ 可用" if success else "❌ 不可用"
        print(f"  {status} {endpoint} ({elapsed:.2f}秒)")
    
    # 建议
    print_header("建议")
    
    if success_count == 0:
        print("""
❌ 所有端点都无法连接！

可能的原因：
1. 音乐API服务(端口3000)未启动
2. 防火墙阻止了连接
3. Docker网络配置问题

解决方案：
1. 检查音乐API服务是否运行:
   docker ps | grep music
   或
   netstat -tlnp | grep 3000

2. 检查防火墙设置:
   sudo ufw status
   sudo firewall-cmd --list-all

3. 如果在Docker中，检查网络:
   docker network ls
   docker network inspect <network_name>
        """)
    elif working_endpoint:
        print(f"""
✅ 找到可用端点: {working_endpoint}

建议配置：
1. 在 deploy/.env 中设置:
   METING_API_URL={working_endpoint}

2. 重启后端服务:
   docker-compose restart backend
   或
   systemctl restart your-backend-service

3. 检查后端日志确认配置生效:
   docker logs backend | grep MUSIC-API-CONFIG
        """)
    else:
        print(f"""
⚠️  部分端点可用

成功的端点:
{chr(10).join(f"  - {ep}" for ep, (s, _) in results.items() if s)}

建议使用第一个成功的端点。
        """)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n中断测试")
    except Exception as e:
        print(f"\n\n脚本执行出错: {e}")
        import traceback
        traceback.print_exc()
