# 音乐API超时修复 - 部署验证清单

## 部署前检查

### 1. 代码检查
- [x] 后端代码无语法错误
- [x] 前端代码无语法错误
- [x] 配置解析逻辑测试通过
- [x] 后端模块导入成功

### 2. 配置文件检查
- [x] `.env` 文件包含 `METING_API_URL` 配置
- [x] `.env.example` 已更新文档
- [x] `docker-compose.yml` 包含环境变量传递
- [x] `docker-compose.yml` 包含 `extra_hosts` 配置

### 3. 文档检查
- [x] 创建 `MUSIC_API_CONFIG.md` 配置说明
- [x] 创建 `DEPLOYMENT_CHECKLIST.md` 部署清单

## 部署步骤

### Docker部署

1. **确保音乐API服务运行**
   ```bash
   # 在宿主机上检查音乐API服务
   curl http://localhost:3000/
   # 应该返回正常响应
   ```

2. **更新配置**
   ```bash
   cd deploy
   # 编辑 .env 文件，确认 METING_API_URL 配置正确
   nano .env
   ```

3. **重新构建并启动**
   ```bash
   # 停止现有容器
   docker-compose down
   
   # 重新构建（如果代码有更新）
   docker-compose build
   
   # 启动服务
   docker-compose up -d
   ```

4. **查看日志**
   ```bash
   # 查看后端日志，确认配置正确
   docker-compose logs backend | grep "MUSIC-API-CONFIG"
   
   # 应该看到类似输出：
   # [MUSIC-API-CONFIG] Detected environment: Docker
   # [MUSIC-API-CONFIG] Configured endpoints: ['http://host.docker.internal:3000/', 'http://107.174.140.100:3000/']
   ```

### 直接部署（非Docker）

1. **设置环境变量**
   ```bash
   export METING_API_URL="http://localhost:3000/,http://107.174.140.100:3000/"
   ```

2. **启动后端**
   ```bash
   cd backend
   python -m uvicorn main:app --host 0.0.0.0 --port 8998
   ```

3. **检查启动日志**
   应该看到：
   ```
   [MUSIC-API-CONFIG] Detected environment: Host
   [MUSIC-API-CONFIG] Configured endpoints: ['http://localhost:3000/', ...]
   ```

## 部署后验证

### 1. 后端API测试

```bash
# 测试搜索API
curl "http://localhost:8999/api/music/search?keyword=周杰伦&limit=5"

# 测试热门歌单API
curl "http://localhost:8999/api/music/playlist?id=3778678&limit=10"

# 测试歌词API
curl "http://localhost:8999/api/music/lyrics?id=186016&server=netease"
```

**预期结果：**
- 返回JSON格式的歌曲列表
- 如果失败，返回包含 `error` 和 `attempts` 字段的错误响应

### 2. 前端功能测试

1. **访问前端页面**
   - 打开浏览器访问 `http://localhost:8998` 或 `http://107.174.140.100:8998`

2. **测试本地音乐**
   - 点击播放列表按钮
   - 切换到"本地音乐"标签
   - 应该显示本地音乐列表或友好的空状态提示

3. **测试在线音乐**
   - 切换到"在线音乐"标签
   - 应该自动加载热门歌曲
   - 如果失败，应该显示错误信息和重试按钮

4. **测试搜索功能**
   - 在搜索框输入关键词（如"周杰伦"）
   - 点击搜索或按回车
   - 应该显示搜索结果或错误信息

5. **测试错误处理**
   - 如果音乐API不可用，应该：
     - 显示友好的错误消息
     - 提供重试按钮
     - 自动切换到本地音乐（如果有）

### 3. 日志监控

**Docker环境：**
```bash
# 实时查看后端日志
docker-compose logs -f backend

# 查看音乐API相关日志
docker-compose logs backend | grep "MUSIC-API"
```

**直接部署：**
查看终端输出的日志

**关键日志示例：**

成功情况：
```
[MUSIC-API] Attempting endpoint 1/2: http://localhost:3000/
[MUSIC-API] ✓ Success with http://localhost:3000/ (0.15s)
```

Fallback情况：
```
[MUSIC-API] Attempting endpoint 1/2: http://localhost:3000/
[MUSIC-API] ✗ Connection failed: http://localhost:3000/ (0.05s)
[MUSIC-API] Attempting endpoint 2/2: http://107.174.140.100:3000/
[MUSIC-API] ✓ Success with http://107.174.140.100:3000/ (0.35s)
```

全部失败：
```
[MUSIC-API] Attempting endpoint 1/2: http://localhost:3000/
[MUSIC-API] ✗ Connection failed: http://localhost:3000/ (0.05s)
[MUSIC-API] Attempting endpoint 2/2: http://107.174.140.100:3000/
[MUSIC-API] ✗ Timeout: http://107.174.140.100:3000/ (10.00s)
[MUSIC-API] All 2 endpoints failed for request: ?type=playlist&id=3778678
```

## 性能验证

### 1. 响应时间

使用本地端点时，响应时间应该 < 1秒：
```bash
time curl "http://localhost:8999/api/music/search?keyword=test"
```

### 2. Fallback速度

当第一个端点失败时，应该快速切换到第二个端点（连接错误 < 5秒）

### 3. 并发测试

```bash
# 使用 ab (Apache Bench) 测试
ab -n 100 -c 10 "http://localhost:8999/api/music/search?keyword=test"
```

## 故障排查

### 问题：所有端点都失败

**检查步骤：**
1. 确认音乐API服务运行：`curl http://localhost:3000/`
2. 检查防火墙设置
3. 检查Docker网络（如果使用Docker）
4. 查看详细错误日志

### 问题：本地端点失败，外部IP成功

**检查步骤：**
1. Docker环境：确认 `extra_hosts` 配置
2. 确认音乐API监听 `0.0.0.0` 而不是 `127.0.0.1`
3. 检查本地防火墙

### 问题：前端显示错误但后端正常

**检查步骤：**
1. 打开浏览器开发者工具查看网络请求
2. 检查CORS错误
3. 确认前端和后端版本匹配

## 回滚计划

如果部署出现问题，可以快速回滚：

### Docker环境
```bash
# 停止新版本
docker-compose down

# 恢复旧版本代码
git checkout <previous-commit>

# 重新启动
docker-compose up -d
```

### 直接部署
```bash
# 停止服务
pkill -f "uvicorn main:app"

# 恢复旧版本
git checkout <previous-commit>

# 重新启动
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8998 &
```

## 部署完成确认

- [ ] 后端服务正常启动
- [ ] 配置日志正确输出
- [ ] 本地音乐功能正常
- [ ] 在线音乐加载成功
- [ ] 搜索功能正常
- [ ] 错误处理正确显示
- [ ] 日志记录完整
- [ ] 性能满足要求
- [ ] 从外部网络访问正常

## 监控建议

部署后持续监控以下指标：

1. **端点成功率**
   - 统计每个端点的成功/失败次数
   - 如果某个端点成功率低，考虑调整配置

2. **响应时间**
   - 监控平均响应时间
   - 设置告警阈值（如 > 5秒）

3. **错误率**
   - 监控音乐API错误率
   - 设置告警（如错误率 > 10%）

4. **用户反馈**
   - 收集用户关于音乐加载的反馈
   - 及时处理问题

## 联系信息

如有问题，请查看：
- 配置说明：`deploy/MUSIC_API_CONFIG.md`
- 项目文档：`README.md`
- Spec文档：`.kiro/specs/music-api-timeout-fix/`
