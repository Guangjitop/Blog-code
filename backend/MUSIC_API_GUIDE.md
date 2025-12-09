# 在线音乐播放功能使用指南

## 功能概述

系统已成功切换到使用网易云官方API获取音乐播放链接，移除了对第三方Meting API的依赖。

## 当前状态

✅ **已完成**:
- 修改 `/api/meting` 端点，`type=url` 请求直接使用网易云官方API
- 移除对第三方 NeteaseCloudMusicApi 的依赖
- 添加详细的调试日志
- 搜索功能正常工作（已使用官方API）
- 歌词功能正常工作（已使用官方API）

✅ **测试验证**:
- 测试脚本 `backend/test_music_url.py` 证实网易云官方API可正常工作
- 成功获取320kbps高音质播放链接
- 网易云API响应正常（code: 200）

## 配置Cookie

### 为什么需要Cookie？

- **访问会员歌曲**: Cookie包含登录信息，可以获取会员权限的高音质音乐
- **绕过版权限制**: 某些歌曲需要登录才能播放
- **提升音质**: 会员可以获取320kbps的高音质链接

### 配置方法

#### 方法1: 环境变量（推荐用于服务器部署）

**Windows PowerShell**:
```powershell
$env:NETEASE_COOKIE="your_cookie_here"
cd backend
python main.py
```

**Linux/Mac**:
```bash
export NETEASE_COOKIE="your_cookie_here"
cd backend
python main.py
```

#### 方法2: 通过API接口配置（推荐用于本地开发）

前端页面已经有Cookie配置界面：
1. 访问 http://localhost:8080
2. 点击右上角的"网易云音乐登录"按钮
3. 粘贴Cookie并保存

或者直接调用API:
```bash
curl -X POST http://localhost:8999/api/netease/set-cookie \
  -H "Content-Type: application/json" \
  -d '{"cookie": "your_cookie_here"}'
```

### 如何获取Cookie？

1. 打开浏览器，访问 https://music.163.com
2. 登录你的网易云账号（建议使用会员账号）
3. 按 `F12` 打开开发者工具
4. 切换到 `Network` (网络) 标签
5. 刷新页面（F5）
6. 点击任意一个请求（如第一个请求）
7. 在右侧找到 `Request Headers` (请求头)
8. 找到 `Cookie:` 字段，复制整个值

**Cookie示例**（注意：这是示例，需要替换成你自己的）:
```
MUSIC_U=5a8ec7e7c...; __csrf=abc123...; NMTID=xyz...
```

**重要字段**:
- `MUSIC_U`: 用户标识，必需
- `__csrf`: 防CSRF令牌
- 其他字段也建议一起复制

## 测试功能

### 1. 测试网易云API连接

```bash
cd backend
python test_music_url.py
```

应该看到类似输出:
```
HTTP状态: 200
JSON解析成功!
Response code: 200
URL: http://m801.music.126.net/...
比特率: 320001
```

### 2. 测试完整流程

1. 启动后端: `cd backend && python main.py`
2. 启动前端: `cd Home && python -m http.server 8080`
3. 访问 http://localhost:8080
4. 搜索歌曲（如"周杰伦"）
5. 点击播放

## 已知问题与解决方案

### 问题1: 部分歌曲返回 `"url":null`

**原因**: 
- 版权限制：该歌曲在你的地区不可用
- 会员限制：需要会员才能播放
- 歌曲下架：该歌曲已被下架

**解决方案**:
- 配置有效的会员Cookie
- 尝试搜索其他歌曲
- 系统会自动跳过无法播放的歌曲

### 问题2: Cookie过期

**症状**: 
- 之前能播放的歌曲突然不能播放
- 日志显示 "未使用Cookie获取"

**解决方案**:
- 重新获取Cookie并配置
- Cookie通常有效期为几周到几个月

### 问题3: JSON解析失败（编码错误）

**当前状态**: 发现此问题，正在诊断中

**临时解决方案**:
- httpx应该自动处理gzip压缩
- 测试脚本证实API本身工作正常
- 可能需要检查后端代码中httpx客户端的配置

## API端点说明

### 搜索音乐
```
GET /api/meting?type=search&s=关键词&server=netease
```

### 获取播放链接
```
GET /api/meting?type=url&id=歌曲ID&server=netease
```

### 获取歌词
```
GET /api/meting?type=lrc&id=歌曲ID&server=netease
```

### 获取热门歌单 / 指定歌单
```
GET /api/meting?type=playlist&id=歌单ID&server=netease
```

- 默认首页热门歌单使用的歌单ID为 `3778678`（网易云官方热歌榜，可能会随时间调整）。
- 接口会调用网易云官方 `https://music.163.com/api/playlist/detail?id=...`，并将返回结果转换成前端播放器需要的精简格式。

**成功返回示例（数组）：**
```json
[
  {
    "id": 123456,
    "name": "一路向北",
    "artist": "周杰伦",
    "album": "十一月的萧邦",
    "pic": "https://p3.music.126.net/xxx.jpg"
  }
]
```

**失败返回示例（统一错误格式）：**
```json
{
  "error": "获取歌单失败: 网易云API返回错误 401",
  "code": 401,
  "details": {
    "playlist_id": "3778678",
    "netease_code": 401,
    "keys": ["code", "message"]
  }
}
```

前端会根据 `error` / `code` / `details` 字段给出更友好的提示信息。

### Cookie管理
```
# 设置Cookie
POST /api/netease/set-cookie
Body: {"cookie": "your_cookie_here"}

# 检查Cookie状态
GET /api/netease/cookie-status

# 清除Cookie
POST /api/netease/clear-cookie
```

## 技术架构

```
前端 (Home/index.html)
    ↓ 搜索/播放请求
后端 (/api/meting)
    ↓ 携带Cookie
网易云官方API (music.163.com)
    ↓ 返回播放链接
前端播放器
```

## 性能优化

- ✅ 使用官方API，速度更快
- ✅ 移除第三方API依赖，减少失败点
- ✅ Cookie缓存机制（5分钟缓存）
- ✅ 自动Cookie刷新（每12小时）

## 安全建议

1. **不要提交Cookie到代码仓库**
2. 生产环境使用环境变量配置
3. 定期更新Cookie
4. 使用HTTPS保护Cookie传输

## 热门歌单故障排查指南

当首页热门歌曲/歌单加载失败时，可以按以下步骤排查：

1. **检查后端日志**
   - 在后端日志中搜索 `[MUSIC-API] 获取歌单`、`网易云歌单API响应`、`歌单响应 code=` 等关键字。
   - 重点关注返回的 `status_code`、`code` 以及打印出来的 `keys`（网易云返回JSON的顶层字段）。

2. **使用诊断脚本**
   - 运行 `backend/diagnose_music_api.py`：
     ```bash
     cd backend
     python diagnose_music_api.py http://localhost:8999
     ```
   - 该脚本会直接请求 `/api/meting?type=playlist&id=3778678&server=netease` 并输出详细响应，帮助确认是后端解析问题还是网易云API本身返回错误。

3. **检查网易云Cookie**
   - 确认是否已经通过前端「网易云音乐登录」按钮或 `NETEASE_COOKIE` 环境变量配置了有效Cookie。
   - 如果日志中频繁出现「未使用Cookie」或网易云返回 401/403，可以尝试重新登录网易云并更新Cookie。

4. **测试替换歌单ID**
   - 可以临时替换为你自己的公开歌单ID，使用浏览器或脚本请求：
     ```bash
     curl "http://localhost:8999/api/meting?type=playlist&id=你的歌单ID&server=netease"
     ```
   - 如果自定义歌单可以正常返回，而默认 `3778678` 失败，可能是该歌单在你所在地区被屏蔽或结构发生变化。

5. **确认前端调用情况**
   - 在浏览器控制台查看 `[MUSIC-API]` / `[MUSIC-HOTLIST]` 日志：
     - 如果看到 `_error: true`，查看其中的 `code` 和 `details` 字段。
     - 如果返回是数组但长度为0，则说明接口正常，只是歌单内容为空或解析不到 `tracks`。

如仍无法定位问题，可以收集：
- 一段 `[MUSIC-API]` / `[MUSIC-HOTLIST]` 日志；
- `diagnose_music_api.py` 输出结果；
- 部分后端 `[MUSIC-API]` 日志片段；

再一起分析根因。

