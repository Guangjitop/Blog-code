# 音乐API调试指南

## 问题描述
生产环境出现 "获取热门歌曲失败: TimeoutError: signal timed out" 错误

## 快速诊断

### 步骤1: 运行诊断脚本

在服务器上执行：

```bash
cd /path/to/your/project/backend
python3 debug_music_api.py
```

这个脚本会：
- ✅ 检测运行环境（Docker或直接部署）
- ✅ 测试所有可能的端点连接
- ✅ 测试API功能（热门歌单、搜索）
- ✅ 提供详细的诊断报告和建议

### 步骤2: 检查音乐API服务状态

#### 如果使用Docker:
```bash
# 查看所有运行的容器
docker ps

# 查看音乐API容器（假设名称包含music或meting）
docker ps | grep -E "music|meting|3000"

# 查看容器日志
docker logs <container_name>

# 进入容器测试
docker exec -it <container_name> curl http://localhost:3000/
```

#### 如果直接部署:
```bash
# 检查3000端口是否被监听
netstat -tlnp | grep 3000
# 或
ss -tlnp | grep 3000

# 测试本地连接
curl http://localhost:3000/

# 检查进程
ps aux | grep -E "music|meting|node.*3000"
```

### 步骤3: 检查网络和防火墙

```bash
# 检查防火墙状态（Ubuntu/Debian）
sudo ufw status

# 检查防火墙状态（CentOS/RHEL）
sudo firewall-cmd --list-all

# 如果需要开放3000端口
sudo ufw allow 3000
# 或
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

### 步骤4: 检查后端配置

```bash
# 查看后端日志中的配置信息
docker logs backend | grep MUSIC-API-CONFIG

# 应该看到类似输出：
# [MUSIC-API-CONFIG] Detected environment: Docker
# [MUSIC-API-CONFIG] Configured endpoints: ['http://host.docker.internal:3000/', 'http://107.174.140.100:3000/']
```

## 常见问题和解决方案

### 问题1: 所有端点都超时

**原因：** 音乐API服务未启动

**解决：**
```bash
# 启动音乐API服务
cd /path/to/music-api
docker-compose up -d
# 或
npm start
```

### 问题2: localhost连接失败，但外部IP可以

**原因：** 服务只监听外部IP，未监听localhost

**解决：** 修改音乐API服务配置，确保监听 `0.0.0.0:3000` 而不是 `107.174.140.100:3000`

### 问题3: Docker环境中host.docker.internal无法解析

**原因：** Linux上的Docker需要额外配置

**解决：**
```bash
# 方法1: 在docker-compose.yml中添加extra_hosts
extra_hosts:
  - "host.docker.internal:host-gateway"

# 方法2: 使用宿主机IP
# 在.env文件中设置
METING_API_URL=http://172.17.0.1:3000/,http://107.174.140.100:3000/
```

### 问题4: 连接成功但返回空数据

**原因：** 音乐API服务运行正常但无法访问网易云

**解决：**
1. 检查音乐API服务的日志
2. 确认服务器可以访问外网
3. 检查是否需要配置代理

## 配置优化建议

### 推荐配置（Docker环境）

在 `deploy/.env` 中：
```env
# 优先使用Docker内部网络，然后fallback到外部IP
METING_API_URL=http://host.docker.internal:3000/,http://107.174.140.100:3000/
```

在 `deploy/docker-compose.yml` 中：
```yaml
services:
  backend:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - METING_API_URL=${METING_API_URL}
```

### 推荐配置（直接部署）

在环境变量或 `.env` 中：
```env
METING_API_URL=http://localhost:3000/,http://127.0.0.1:3000/,http://107.174.140.100:3000/
```

## 验证修复

修改配置后，验证是否生效：

```bash
# 1. 重启后端服务
docker-compose restart backend

# 2. 查看日志确认配置
docker logs backend | grep MUSIC-API-CONFIG

# 3. 测试API
curl http://107.174.140.100/api/music/playlist?id=3778678

# 4. 在浏览器中测试
# 打开 http://107.174.140.100
# 点击播放列表 -> 在线音乐
# 应该能看到热门歌曲加载成功
```

## 需要更多帮助？

如果以上步骤都无法解决问题，请收集以下信息：

1. 诊断脚本的完整输出
2. 后端日志（最近100行）：`docker logs backend --tail 100`
3. 音乐API服务日志
4. Docker网络配置：`docker network inspect <network_name>`
5. 系统信息：`uname -a`

然后联系技术支持或在GitHub上提issue。
