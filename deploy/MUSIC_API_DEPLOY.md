# NeteaseCloudMusicApi 镜像部署指南

## 快速开始

### 方式一：使用 docker-compose.yml（推荐）

```bash
cd deploy

# 1. 拉取最新镜像
docker-compose pull music-api

# 2. 启动所有服务（包括音乐API）
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看音乐API日志
docker-compose logs -f music-api
```

### 方式二：单独运行音乐API

```bash
# 拉取镜像
docker pull binaryify/netease_cloud_music_api:latest

# 运行容器
docker run -d \
  --name netease-music-api \
  --restart unless-stopped \
  -p 3000:3000 \
  binaryify/netease_cloud_music_api:latest

# 查看日志
docker logs -f netease-music-api
```

## 验证部署

### 1. 检查服务状态

```bash
# 检查容器是否运行
docker ps | grep music-api

# 应该看到类似输出：
# netease-music-api   binaryify/netease_cloud_music_api:latest   Up 2 minutes   0.0.0.0:3000->3000/tcp
```

### 2. 测试API接口

```bash
# 测试搜索接口
curl "http://localhost:3000/search?keywords=周杰伦"

# 测试歌单接口
curl "http://localhost:3000/playlist/detail?id=3778678"

# 测试歌曲URL接口
curl "http://localhost:3000/song/url?id=347230"
```

### 3. 在浏览器中测试

访问：http://localhost:3000

应该看到 NeteaseCloudMusicApi 的欢迎页面。

## 配置说明

### Docker Compose 配置

音乐API服务已添加到 `docker-compose.yml`：

```yaml
music-api:
  image: binaryify/netease_cloud_music_api:latest
  container_name: netease-music-api
  ports:
    - "3000:3000"
  environment:
    - PORT=3000
  networks:
    - app-network
  restart: unless-stopped
```

### 环境变量配置

后端服务会自动使用 Docker 内部服务名连接：

```bash
METING_API_URL=http://music-api:3000/,http://host.docker.internal:3000/
```

优先级：
1. `music-api:3000` - Docker 内部服务名（最快）
2. `host.docker.internal:3000` - 宿主机备用

## 常用命令

### 启动/停止服务

```bash
# 启动所有服务
docker-compose up -d

# 只启动音乐API
docker-compose up -d music-api

# 停止音乐API
docker-compose stop music-api

# 重启音乐API
docker-compose restart music-api

# 停止并删除容器
docker-compose down
```

### 查看日志

```bash
# 实时查看日志
docker-compose logs -f music-api

# 查看最后100行
docker-compose logs --tail=100 music-api

# 查看所有服务日志
docker-compose logs -f
```

### 更新镜像

```bash
# 拉取最新镜像
docker-compose pull music-api

# 重新创建容器
docker-compose up -d music-api
```

## 故障排查

### 问题1：容器无法启动

```bash
# 查看详细日志
docker-compose logs music-api

# 检查端口占用
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# 如果端口被占用，修改端口映射
# 在 docker-compose.yml 中改为：
# ports:
#   - "3001:3000"
```

### 问题2：API请求失败

```bash
# 1. 检查容器是否健康
docker-compose ps

# 2. 进入容器检查
docker exec -it netease-music-api sh

# 3. 测试内部连接
docker exec netease-music-api wget -O- http://localhost:3000

# 4. 检查网络连接
docker network inspect deploy_app-network
```

### 问题3：后端无法连接音乐API

```bash
# 1. 检查后端日志
docker-compose logs backend | grep MUSIC

# 2. 测试后端到音乐API的连接
docker exec account-backend curl http://music-api:3000

# 3. 检查环境变量
docker exec account-backend env | grep METING
```

## 性能优化

### 1. 资源限制

在 `docker-compose.images.yml` 中已配置：

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

### 2. 日志管理

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 3. 健康检查

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## 生产环境建议

1. **使用固定版本标签**
   ```yaml
   image: binaryify/netease_cloud_music_api:4.0.0
   ```

2. **配置反向代理**
   - 通过 Nginx 代理音乐API
   - 添加缓存和限流

3. **监控和告警**
   - 使用 Prometheus + Grafana 监控
   - 配置健康检查告警

4. **备份策略**
   - 定期备份配置文件
   - 记录镜像版本

## 相关链接

- [NeteaseCloudMusicApi GitHub](https://github.com/Binaryify/NeteaseCloudMusicApi)
- [Docker Hub](https://hub.docker.com/r/binaryify/netease_cloud_music_api)
- [API 文档](https://neteasecloudmusicapi.vercel.app/)
