# 音乐API配置说明

## 概述

本系统支持配置多个音乐API端点，实现自动fallback机制。当主端点失败时，系统会自动尝试备用端点，提高服务可用性。

## 配置方式

### 环境变量配置

在 `deploy/.env` 文件中配置 `METING_API_URL` 环境变量：

```bash
# 多个端点用逗号分隔，系统会按顺序尝试
METING_API_URL=http://host.docker.internal:3000/,http://107.174.140.100:3000/
```

### 默认配置

系统会根据运行环境自动选择默认配置：

#### Docker环境
```
http://host.docker.internal:3000/,http://107.174.140.100:3000/
```

#### 直接部署（非Docker）
```
http://localhost:3000/,http://127.0.0.1:3000/,http://107.174.140.100:3000/
```

## 端点优先级

**重要：** 端点顺序很重要！系统会按配置顺序依次尝试：

1. **本地端点优先**（localhost 或 host.docker.internal）
   - 速度快，延迟低
   - 不受外部网络影响
   - 推荐作为第一选择

2. **外部IP作为备用**（如 http://107.174.140.100:3000/）
   - 当本地访问失败时使用
   - 提供额外的可用性保障

## Docker部署配置

### 1. 确保 extra_hosts 配置

在 `docker-compose.yml` 中已包含：

```yaml
backend:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

这允许Docker容器访问宿主机上的服务。

### 2. 音乐API服务运行在宿主机

如果音乐API服务（端口3000）运行在宿主机上：

```bash
# 在宿主机上启动音乐API服务
cd /path/to/music-api
npm start  # 或其他启动命令，确保监听3000端口
```

### 3. 启动主应用

```bash
cd deploy
docker-compose up -d
```

## 直接部署配置

如果不使用Docker，直接在服务器上运行：

### 1. 设置环境变量

```bash
export METING_API_URL="http://localhost:3000/,http://107.174.140.100:3000/"
```

或在启动脚本中设置。

### 2. 启动后端

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8998
```

## 验证配置

### 1. 检查日志

启动后端时，会输出配置信息：

```
[MUSIC-API-CONFIG] Detected environment: Docker
[MUSIC-API-CONFIG] Configured endpoints: ['http://host.docker.internal:3000/', 'http://107.174.140.100:3000/']
```

### 2. 测试API

访问后端API测试端点：

```bash
# 测试搜索
curl "http://localhost:8999/api/music/search?keyword=周杰伦"

# 测试热门歌单
curl "http://localhost:8999/api/music/playlist?id=3778678"
```

### 3. 查看尝试日志

当请求音乐API时，后端会输出详细日志：

```
[MUSIC-API] Attempting endpoint 1/2: http://host.docker.internal:3000/
[MUSIC-API] ✓ Success with http://host.docker.internal:3000/ (0.15s)
```

或失败时：

```
[MUSIC-API] Attempting endpoint 1/2: http://host.docker.internal:3000/
[MUSIC-API] ✗ Connection failed: http://host.docker.internal:3000/ (0.05s)
[MUSIC-API] Attempting endpoint 2/2: http://107.174.140.100:3000/
[MUSIC-API] ✓ Success with http://107.174.140.100:3000/ (0.35s)
```

## 故障排查

### 问题1：所有端点都超时

**症状：** 前端显示"音乐服务暂时不可用"

**解决方案：**
1. 检查音乐API服务是否运行：`curl http://localhost:3000/`
2. 检查防火墙设置
3. 检查Docker网络配置（如果使用Docker）

### 问题2：本地端点失败，但外部IP可用

**症状：** 日志显示第一个端点失败，第二个成功

**解决方案：**
1. Docker环境：确保 `extra_hosts` 配置正确
2. 检查音乐API服务是否监听正确的地址（0.0.0.0 而不是 127.0.0.1）

### 问题3：外部IP端点也失败

**症状：** 两个端点都失败

**解决方案：**
1. 检查服务器防火墙是否允许3000端口
2. 检查音乐API服务是否对外暴露
3. 尝试从外部访问：`curl http://107.174.140.100:3000/`

## 性能优化建议

1. **优先使用本地端点**
   - 延迟低（通常 < 50ms）
   - 不占用外部带宽
   - 更可靠

2. **合理设置超时**
   - 连接超时：5秒（快速失败）
   - 读取超时：10秒（允许API处理时间）

3. **监控端点健康**
   - 定期检查日志中的端点成功率
   - 如果某个端点频繁失败，考虑调整配置

## 安全注意事项

1. **内网访问**
   - 本地端点（localhost/host.docker.internal）仅在内网可访问
   - 更安全，不暴露给外部

2. **外部端点**
   - 确保音乐API服务有适当的访问控制
   - 考虑使用防火墙限制访问来源

3. **环境变量**
   - 不要在代码中硬编码端点
   - 使用环境变量便于不同环境配置
