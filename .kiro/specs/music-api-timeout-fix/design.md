# Design Document

## Overview

本设计文档描述了修复音乐API超时问题的技术方案。核心问题是后端当前配置使用外部IP地址（http://107.174.140.100:3000/）访问同服务器上的音乐API服务，导致网络路由效率低下和超时。解决方案是配置多个端点，优先使用本地地址（localhost或host.docker.internal），失败后自动fallback到外部IP。

## Architecture

### Current Architecture Issues

```
External User Browser
    ↓ HTTP Request
Main App Backend (107.174.140.100)
    ↓ HTTP Request to http://107.174.140.100:3000/
    ↓ (Goes out to internet and back - inefficient!)
Music API Service (107.174.140.100:3000)
```

**问题：** 后端访问同服务器上的服务却通过外部IP，导致：
- 网络路由路径长
- 受防火墙/网络策略影响
- 延迟高，容易超时

### Improved Architecture

```
External User Browser
    ↓ HTTP Request
Main App Backend (107.174.140.100)
    ↓ Try 1: localhost:3000 or host.docker.internal:3000 (fast!)
    ↓ Try 2 (if fail): http://107.174.140.100:3000/ (fallback)
Music API Service (107.174.140.100:3000)
```

**优势：**
- 本地访问速度快，延迟低
- 不受外部网络影响
- 有外部IP作为备用保证可用性

## Components and Interfaces

### 1. Environment Configuration Module

**Purpose:** 管理音乐API端点配置

**Configuration Variables:**
- `METING_API_URL`: 逗号分隔的API端点列表
- Default for Docker: `"http://host.docker.internal:3000/,http://107.174.140.100:3000/"`
- Default for Host: `"http://localhost:3000/,http://107.174.140.100:3000/"`

**Interface:**
```python
def get_music_api_endpoints() -> List[str]:
    """
    从环境变量读取并解析音乐API端点列表
    Returns: 端点URL列表，已去除空白和空值
    """
    pass
```

### 2. Music API Proxy Module

**Purpose:** 代理前端的音乐API请求，处理多端点fallback逻辑

**Endpoints:**
- `GET /api/music/search` - 搜索音乐
- `GET /api/music/playlist` - 获取歌单（热门歌曲）
- `GET /api/music/lyrics` - 获取歌词
- `GET /api/meting` - 通用Meting API代理

**Interface:**
```python
async def try_music_api_with_fallback(
    endpoints: List[str],
    request_path: str,
    params: dict,
    timeout: float = 10.0
) -> dict:
    """
    尝试多个端点直到成功
    
    Args:
        endpoints: API端点列表
        request_path: 请求路径（如 "?type=playlist&id=xxx"）
        params: 查询参数
        timeout: 单个请求超时时间（秒）
    
    Returns:
        API响应数据
    
    Raises:
        HTTPException: 所有端点都失败时
    """
    pass
```

### 3. Error Handling and Logging Module

**Purpose:** 统一的错误处理和日志记录

**Interface:**
```python
def log_api_attempt(endpoint: str, success: bool, error: Optional[str] = None):
    """记录API尝试结果"""
    pass

def create_error_response(attempts: List[dict]) -> dict:
    """
    创建包含所有尝试信息的错误响应
    
    Args:
        attempts: 尝试记录列表，每项包含 {endpoint, error, timestamp}
    
    Returns:
        格式化的错误响应
    """
    pass
```

## Data Models

### API Attempt Record

```python
class APIAttempt:
    endpoint: str          # 尝试的端点URL
    timestamp: datetime    # 尝试时间
    success: bool          # 是否成功
    error_type: Optional[str]  # 错误类型（timeout, connection, http_error）
    error_message: Optional[str]  # 错误详情
    response_time: Optional[float]  # 响应时间（毫秒）
```

### Music API Response

```python
# 搜索/歌单响应
class MusicTrack:
    id: str
    name: str
    artist: str
    album: str
    url: str
    cover: str
    lrc: str
    duration: int

# 错误响应
class ErrorResponse:
    error: str
    code: int
    attempts: List[APIAttempt]  # 所有尝试的详细信息
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, the following redundancies were identified:
- **3.2 and 5.4** are identical (sequential endpoint trying) - keeping 3.2
- **Logging properties (2.1-2.4)** can be consolidated into comprehensive logging property
- **1.1 and 3.1** both address endpoint prioritization - combining into single property

### Core Correctness Properties

Property 1: Endpoint order preservation
*For any* list of configured API endpoints, the system should attempt them in the exact order specified, starting with the first endpoint
**Validates: Requirements 1.1, 3.1, 3.2, 5.4**

Property 2: Automatic fallback on failure
*For any* endpoint that fails (timeout or connection error), the system should immediately attempt the next endpoint in the list without retrying the failed endpoint
**Validates: Requirements 1.2, 3.3, 3.5**

Property 3: CORS header injection
*For any* successful API response from the Music API Service, the Backend Proxy should add appropriate CORS headers (Access-Control-Allow-Origin: *) before forwarding to the Frontend Client
**Validates: Requirements 1.4**

Property 4: Comprehensive error response
*For any* request where all configured endpoints fail, the system should return an error response containing the list of attempted endpoints and their respective error types
**Validates: Requirements 1.5, 2.5**

Property 5: Complete attempt logging
*For any* API request, the system should log each connection attempt with timestamp, endpoint URL, success status, and error details (if failed)
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 6: Configuration parsing correctness
*For any* comma-separated string of endpoints, the configuration parser should produce a list where each endpoint is trimmed of whitespace and empty values are filtered out
**Validates: Requirements 5.1, 5.5**

Property 7: Frontend error handling
*For any* error response from the music API, the Frontend Client should store the error message and display it when the user switches to the online music tab
**Validates: Requirements 4.2**

Property 8: UI fallback to local music
*For any* state where online music loading fails and local music is available, the Frontend Client should automatically display the local music tab
**Validates: Requirements 4.1, 4.4**

Property 9: Retry UI element
*For any* timeout error, the Frontend Client should display a retry button that allows the user to re-attempt loading online music
**Validates: Requirements 4.3**

## Error Handling

### Error Types

1. **TimeoutError**: Request exceeds configured timeout (10 seconds per endpoint)
   - Action: Log timeout, try next endpoint
   - User message: "音乐服务响应超时，正在尝试备用服务..."

2. **ConnectionError**: Cannot establish connection to endpoint
   - Action: Log connection failure, immediately try next endpoint (no timeout wait)
   - User message: "无法连接到音乐服务，正在尝试备用服务..."

3. **HTTPError**: Endpoint returns non-200 status code
   - Action: Log HTTP error, try next endpoint
   - User message: "音乐服务返回错误，正在尝试备用服务..."

4. **AllEndpointsFailed**: All configured endpoints have failed
   - Action: Return comprehensive error response with all attempt details
   - User message: "音乐服务暂时不可用，请稍后重试或使用本地音乐"

### Error Response Format

```json
{
  "error": "All music API endpoints failed",
  "code": 503,
  "attempts": [
    {
      "endpoint": "http://localhost:3000/",
      "error_type": "connection",
      "error_message": "Connection refused",
      "timestamp": "2024-12-06T10:30:45Z"
    },
    {
      "endpoint": "http://107.174.140.100:3000/",
      "error_type": "timeout",
      "error_message": "Request timeout after 10s",
      "timestamp": "2024-12-06T10:30:55Z"
    }
  ],
  "suggestion": "请检查音乐API服务是否正常运行，或稍后重试"
}
```

### Logging Format

```
[MUSIC-API] Attempting endpoint 1/2: http://localhost:3000/
[MUSIC-API] Endpoint failed: connection refused (0.05s)
[MUSIC-API] Attempting endpoint 2/2: http://107.174.140.100:3000/
[MUSIC-API] Endpoint failed: timeout after 10s
[MUSIC-API] All endpoints failed for request: type=playlist, id=3778678
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific behaviors and edge cases:

1. **Configuration Parsing**
   - Test parsing valid comma-separated endpoint lists
   - Test handling of whitespace and empty values
   - Test default configuration for Docker vs host environments

2. **Error Response Generation**
   - Test error response format with various failure scenarios
   - Test error message content and structure

3. **CORS Header Addition**
   - Test that CORS headers are added to successful responses
   - Test that existing headers are preserved

### Property-Based Tests

Property-based tests will verify universal behaviors across many inputs using the `hypothesis` library for Python:

1. **Property 1: Endpoint order preservation**
   - Generate random lists of endpoint URLs
   - Verify they are attempted in the specified order
   - **Feature: music-api-timeout-fix, Property 1: Endpoint order preservation**

2. **Property 2: Automatic fallback on failure**
   - Generate random endpoint lists and simulate failures
   - Verify no endpoint is retried within the same request
   - Verify immediate fallback on connection errors
   - **Feature: music-api-timeout-fix, Property 2: Automatic fallback on failure**

3. **Property 3: CORS header injection**
   - Generate random API responses
   - Verify all responses have CORS headers added
   - **Feature: music-api-timeout-fix, Property 3: CORS header injection**

4. **Property 4: Comprehensive error response**
   - Generate random failure scenarios
   - Verify error responses contain all attempt details
   - **Feature: music-api-timeout-fix, Property 4: Comprehensive error response**

5. **Property 5: Complete attempt logging**
   - Generate random API requests
   - Verify all attempts are logged with required fields
   - **Feature: music-api-timeout-fix, Property 5: Complete attempt logging**

6. **Property 6: Configuration parsing correctness**
   - Generate random comma-separated strings
   - Verify parsing produces correct list with trimming and filtering
   - **Feature: music-api-timeout-fix, Property 6: Configuration parsing correctness**

### Integration Tests

Integration tests will verify end-to-end behavior:

1. Test actual connection to localhost:3000 (requires running music API service)
2. Test fallback behavior with real network conditions
3. Test frontend-backend integration with error scenarios

### Test Configuration

- Property-based tests should run minimum 100 iterations per property
- Timeout for unit tests: 5 seconds per test
- Timeout for integration tests: 30 seconds per test
- Mock external dependencies (httpx client) for unit tests
- Use real services for integration tests

## Implementation Notes

### Environment Variable Configuration

The system should read the `METING_API_URL` environment variable at startup:

```python
import os

# Default configuration based on environment
def get_default_endpoints():
    # Check if running in Docker (common indicator)
    if os.path.exists('/.dockerenv'):
        return "http://host.docker.internal:3000/,http://107.174.140.100:3000/"
    else:
        return "http://localhost:3000/,http://107.174.140.100:3000/"

METING_API_URLS = os.getenv("METING_API_URL", get_default_endpoints()).split(",")
METING_API_URLS = [url.strip() for url in METING_API_URLS if url.strip()]
```

### Timeout Configuration

- Connection timeout: 5 seconds (fast fail for connection issues)
- Read timeout: 10 seconds (allow time for API processing)
- Total timeout per endpoint: 10 seconds
- Total timeout for all endpoints: 10 * number_of_endpoints

### Frontend Changes

1. Update error handling to parse new error response format
2. Add retry button for timeout errors
3. Implement automatic fallback to local music tab
4. Store and display last error message when switching tabs

### Deployment Considerations

1. **Docker Deployment**: Ensure `host.docker.internal` is accessible (works by default on Docker Desktop, may need `--add-host` on Linux)
2. **Direct Deployment**: Ensure music API service is running on port 3000
3. **Firewall**: Ensure localhost/127.0.0.1 connections are not blocked
4. **Environment Variables**: Set `METING_API_URL` in deployment configuration if custom endpoints are needed

## Performance Considerations

1. **Fast Fail**: Connection errors should fail immediately without waiting for timeout
2. **Parallel Attempts**: Consider implementing parallel endpoint attempts in future (not in this version)
3. **Caching**: Consider caching successful endpoint for short duration (not in this version)
4. **Monitoring**: Log endpoint success rates for monitoring and optimization

## Security Considerations

1. **CORS**: Only allow necessary origins in production (currently allows all with `*`)
2. **Endpoint Validation**: Validate endpoint URLs to prevent SSRF attacks
3. **Error Messages**: Don't expose internal network details in user-facing error messages
4. **Rate Limiting**: Consider adding rate limiting to prevent abuse (not in this version)
