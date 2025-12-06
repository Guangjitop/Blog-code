#!/usr/bin/env python3
"""
模拟外部访问测试脚本
用于诊断生产环境中从外部访问音乐API的问题
"""

import httpx
import time
import json
from datetime import datetime
from urllib.parse import urlencode

# 生产环境后端API地址（模拟外部访问）
# 可以根据实际情况修改
import sys
if len(sys.argv) > 1:
    BACKEND_API_BASE = sys.argv[1]
else:
    # 默认使用本地测试，如果后端在Docker中，可能需要使用 http://localhost:8999
    BACKEND_API_BASE = "http://localhost:8999"  # 本地测试
    # BACKEND_API_BASE = "http://107.174.140.100:8999"  # 生产环境

# 测试的API端点
TEST_ENDPOINTS = [
    {
        "name": "热门歌单（playlist）",
        "url": f"{BACKEND_API_BASE}/api/meting?type=playlist&id=3778678&server=netease",
        "timeout": 25  # 前端超时时间
    },
    {
        "name": "搜索歌曲",
        "url": f"{BACKEND_API_BASE}/api/meting?type=search&s=周杰伦&server=netease",
        "timeout": 25
    },
    {
        "name": "后端音乐搜索API",
        "url": f"{BACKEND_API_BASE}/api/music/search?keyword=周杰伦",
        "timeout": 25
    },
    {
        "name": "后端歌单API",
        "url": f"{BACKEND_API_BASE}/api/music/playlist?id=3778678",
        "timeout": 25
    }
]

def print_header(text):
    """打印标题"""
    print("\n" + "="*70)
    print(f"  {text}")
    print("="*70)

def test_api_endpoint(name, url, timeout):
    """测试单个API端点"""
    print(f"\n📡 测试: {name}")
    print(f"   URL: {url}")
    print(f"   超时: {timeout}秒")
    print(f"   开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    start_time = time.time()
    
    try:
        # 使用与前端相同的超时配置
        timeout_config = httpx.Timeout(timeout, connect=5.0)
        
        with httpx.Client(timeout=timeout_config, follow_redirects=True) as client:
            response = client.get(url)
            elapsed = time.time() - start_time
            
            # 检查状态码
            if response.status_code >= 400:
                print(f"\n⚠️  请求返回错误状态码!")
                print(f"   状态码: {response.status_code}")
                print(f"   响应时间: {elapsed:.2f}秒")
                print(f"   响应大小: {len(response.content)} bytes")
                print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
            else:
                print(f"\n✅ 请求成功!")
                print(f"   状态码: {response.status_code}")
                print(f"   响应时间: {elapsed:.2f}秒")
                print(f"   响应大小: {len(response.content)} bytes")
                print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
            
            # 尝试解析响应
            try:
                # 先尝试解析JSON（即使状态码是错误码）
                try:
                    data = response.json()
                    is_json = True
                except:
                    data = response.text
                    is_json = False
                
                if is_json and 'application/json' in response.headers.get('content-type', ''):
                    data = response.json()
                    
                    # 检查是否是错误响应
                    if isinstance(data, dict):
                        if "error" in data or response.status_code >= 400:
                            print(f"\n❌ API返回错误:")
                            print(f"   错误信息: {data.get('error', 'Unknown error') if isinstance(data, dict) else 'Empty response'}")
                            print(f"   错误代码: {data.get('code', response.status_code) if isinstance(data, dict) else response.status_code}")
                            
                            # 显示尝试记录（如果有）
                            if isinstance(data, dict) and "attempts" in data:
                                print(f"\n   尝试记录:")
                                for idx, attempt in enumerate(data.get("attempts", []), 1):
                                    print(f"     尝试 {idx}: {attempt.get('endpoint', 'N/A')}")
                                    print(f"       错误类型: {attempt.get('error_type', 'N/A')}")
                                    print(f"       错误信息: {attempt.get('error_message', 'N/A')}")
                                    print(f"       响应时间: {attempt.get('response_time', 0):.2f}秒")
                            
                            if isinstance(data, dict) and "suggestion" in data:
                                print(f"   建议: {data.get('suggestion')}")
                            
                            # 如果响应为空，显示原始响应
                            if not data or (isinstance(data, str) and not data.strip()):
                                print(f"   原始响应: {response.text[:500]}")
                            
                            return False, elapsed, data
                        else:
                            # 成功响应
                            if "results" in data:
                                results = data.get("results", [])
                                print(f"   返回结果数: {len(results)}")
                                if results:
                                    print(f"   示例: {results[0].get('name', 'N/A') if isinstance(results[0], dict) else str(results[0])[:50]}")
                            elif isinstance(data, list):
                                print(f"   返回结果数: {len(data)}")
                                if data:
                                    print(f"   示例: {data[0].get('name', 'N/A') if isinstance(data[0], dict) else str(data[0])[:50]}")
                            else:
                                print(f"   返回数据: {json.dumps(data, ensure_ascii=False)[:200]}...")
                            
                            return True, elapsed, data
                    elif isinstance(data, list):
                        print(f"   返回结果数: {len(data)}")
                        if data:
                            print(f"   示例: {data[0].get('name', 'N/A') if isinstance(data[0], dict) else str(data[0])[:50]}")
                        return True, elapsed, data
                    else:
                        print(f"   返回数据: {json.dumps(data, ensure_ascii=False)[:200]}...")
                        return True, elapsed, data
                else:
                    # 非JSON响应
                    text_preview = response.text[:200]
                    print(f"   响应内容预览: {text_preview}...")
                    return True, elapsed, response.text
                    
            except (ValueError, TypeError) as e:
                print(f"   ⚠️  JSON解析失败: {str(e)}")
                print(f"   响应内容: {response.text[:200]}...")
                return True, elapsed, response.text
            
    except httpx.TimeoutException as e:
        elapsed = time.time() - start_time
        print(f"\n❌ 请求超时!")
        print(f"   耗时: {elapsed:.2f}秒")
        print(f"   错误: {str(e)}")
        print(f"   原因: 请求超过{timeout}秒未响应")
        print(f"   可能的问题:")
        print(f"     1. 后端尝试多个端点，总时间超过前端超时时间")
        print(f"     2. 音乐API服务响应慢或不可用")
        print(f"     3. 网络连接问题")
        return False, elapsed, None
        
    except httpx.ConnectError as e:
        elapsed = time.time() - start_time
        print(f"\n❌ 连接失败!")
        print(f"   耗时: {elapsed:.2f}秒")
        print(f"   错误: {str(e)}")
        print(f"   原因: 无法连接到后端服务器")
        print(f"   可能的问题:")
        print(f"     1. 后端服务未启动")
        print(f"     2. 端口8999未开放")
        print(f"     3. 防火墙阻止连接")
        return False, elapsed, None
        
    except httpx.HTTPStatusError as e:
        elapsed = time.time() - start_time
        print(f"\n❌ HTTP错误!")
        print(f"   状态码: {e.response.status_code}")
        print(f"   耗时: {elapsed:.2f}秒")
        print(f"   错误: {str(e)}")
        return False, elapsed, None
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n❌ 未知错误!")
        print(f"   耗时: {elapsed:.2f}秒")
        print(f"   错误类型: {type(e).__name__}")
        print(f"   错误信息: {str(e)}")
        import traceback
        print(f"\n   堆栈跟踪:")
        traceback.print_exc()
        return False, elapsed, None

def main():
    """主函数"""
    print_header("模拟外部访问 - 音乐API调试工具")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"后端API地址: {BACKEND_API_BASE}")
    print(f"\n说明: 此脚本模拟外部用户访问后端API，测试音乐API连接")
    
    # 测试所有端点
    results = []
    for endpoint in TEST_ENDPOINTS:
        success, elapsed, data = test_api_endpoint(
            endpoint["name"],
            endpoint["url"],
            endpoint["timeout"]
        )
        results.append({
            "name": endpoint["name"],
            "success": success,
            "elapsed": elapsed,
            "data": data
        })
        time.sleep(1)  # 短暂延迟，避免请求过快
    
    # 总结
    print_header("测试总结")
    
    success_count = sum(1 for r in results if r["success"])
    total_count = len(results)
    
    print(f"\n总测试数: {total_count}")
    print(f"成功: {success_count} ✅")
    print(f"失败: {total_count - success_count} ❌")
    
    print(f"\n详细结果:")
    for result in results:
        status = "✅ 成功" if result["success"] else "❌ 失败"
        print(f"  {status} {result['name']} ({result['elapsed']:.2f}秒)")
    
    # 诊断建议
    print_header("诊断建议")
    
    if success_count == 0:
        print("""
❌ 所有API端点都失败！

可能的原因：
1. 后端服务未启动或无法访问
2. 音乐API服务（端口3000）未启动或不可达
3. 网络配置问题（防火墙、Docker网络等）
4. 超时配置不合理

解决步骤：
1. 检查后端服务状态:
   docker ps | grep backend
   或
   curl http://localhost:8999/docs

2. 检查音乐API服务:
   curl http://localhost:3000/
   或
   docker ps | grep music

3. 查看后端日志:
   docker logs backend | grep MUSIC-API
   或
   tail -f /path/to/backend/logs

4. 检查配置:
   docker exec backend env | grep METING_API_URL
        """)
    elif success_count < total_count:
        print(f"""
⚠️  部分API端点失败

成功的端点:
{chr(10).join(f"  ✅ {r['name']}" for r in results if r['success'])}

失败的端点:
{chr(10).join(f"  ❌ {r['name']}" for r in results if not r['success'])}

建议：
1. 检查失败的端点配置
2. 查看后端日志了解详细错误信息
3. 确认音乐API服务是否正常运行
        """)
    else:
        print("""
✅ 所有API端点测试成功！

系统运行正常。如果前端仍有问题，可能是：
1. 前端超时配置问题
2. CORS配置问题
3. 浏览器缓存问题

建议：
1. 清除浏览器缓存
2. 检查浏览器控制台错误信息
3. 查看网络请求详情
        """)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n测试中断")
    except Exception as e:
        print(f"\n\n脚本执行出错: {e}")
        import traceback
        traceback.print_exc()

