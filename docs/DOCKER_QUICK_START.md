# Docker 快速启动指南

## 前提条件

1. 安装 Docker Desktop
   - Windows: https://www.docker.com/products/docker-desktop
   - 确保 Docker Desktop 正在运行

2. 确保以下端口未被占用：
   - `8998` - 前端（Nginx）
   - `8999` - 后端API

## 快速启动

### 方法1：使用启动脚本（推荐）

```cmd
# 检查Docker环境
scripts\check-docker.cmd

# 启动所有服务
scripts\start-docker.cmd

# 查看日志
scripts\logs-docker.cmd

# 停止所有服务
scripts\stop-docker.cmd
```

### 方法2：手动启动

```cmd
# 进入deploy目录
cd deploy

# 启动服务（后台运行）
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 访问地址

启动成功后，可以访问以下地址：

- **前端首页**: http://localhost:8998/
- **管理后台**: http://localhost:8998/app/
- **后端API文档**: http://localhost:8999/docs

## 服务说明

### 1. backend (端口8999)
- FastAPI后端服务
- 提供账号管理API

### 2. nginx (端口8998)
- 前端静态文件服务
- 反向代理

## 常用命令

```cmd
# 查看容器状态
docker-compose ps

# 查看特定服务的日志
docker-compose logs backend
docker-compose logs nginx
# 重启特定服务
docker-compose restart backend

# 重新构建并启动
docker-compose up -d --build

# 停止并删除所有容器
docker-compose down

# 停止并删除所有容器和数据卷
docker-compose down -v
```

## 故障排查

### 1. 端口被占用

如果端口被占用，可以修改 `deploy/docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8998:80"  # 修改8998为其他端口
```

### 2. 容器启动失败

查看日志找出原因：
```cmd
docker-compose logs [service-name]
```

### 3. 前端无法连接后端

确保：
1. 后端服务正在运行：`docker-compose ps`
2. 检查后端日志：`docker-compose logs backend`
3. 访问后端API文档确认：http://localhost:8999/docs

## 开发模式

如果需要在开发时实时看到代码更改，可以使用卷挂载：

```yaml
# 在 docker-compose.yml 中添加
volumes:
  - ../backend:/app
```

然后重启服务：
```cmd
docker-compose restart backend
```

## 环境变量

可以在 `deploy/.env` 文件中配置环境变量：

```env
# 管理员密码
ADMIN_PASSWORD=your_password
```

## 数据持久化

数据库文件存储在：
- `backend/accounts.db` - 账号数据库

如果需要备份，直接复制此文件即可。

## 更新服务

```cmd
# 拉取最新代码
git pull

# 重新构建并启动
cd deploy
docker-compose up -d --build
```

## 完全清理

如果需要完全清理并重新开始：

```cmd
# 停止并删除所有容器、网络、卷
docker-compose down -v

# 删除镜像
docker-compose down --rmi all

# 重新构建
docker-compose up -d --build
```
