# Nginx 配置重新加载指南

## 概述

当修改了nginx配置文件后，需要重新加载配置使其生效。本文档说明如何安全地重新加载nginx配置。

## 方法一：重新加载配置（推荐，无需停机）

### 1. 检查配置语法

在重新加载之前，先检查配置语法是否正确：

```bash
cd deploy
docker-compose exec nginx nginx -t
```

如果配置正确，会显示：
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 2. 重新加载配置

如果配置语法正确，执行重新加载：

```bash
docker-compose exec nginx nginx -s reload
```

或者：

```bash
docker-compose exec nginx nginx -s reload
```

## 方法二：重启nginx容器（如果重新加载失败）

如果重新加载失败，可以重启nginx容器：

```bash
cd deploy
docker-compose restart nginx
```

## 方法三：完全重启所有服务

如果需要完全重启所有服务（包括nginx和backend）：

```bash
cd deploy
docker-compose down
docker-compose up -d
```

## 验证配置是否生效

### 1. 检查nginx日志

```bash
docker-compose logs nginx
```

### 2. 测试访问

测试HTTP访问：
```bash
curl http://blog.mytype.top/music-api/
```

测试HTTPS访问：
```bash
curl https://blog.mytype.top/music-api/
```

### 3. 检查后端API

```bash
curl https://blog.mytype.top/api/meting?type=playlist&id=3778678&server=netease
```

## 常见问题

### 问题1：配置修改后仍然返回404

**原因**：nginx配置没有重新加载

**解决方法**：
```bash
docker-compose exec nginx nginx -s reload
```

### 问题2：重新加载失败

**原因**：配置语法错误

**解决方法**：
1. 检查配置语法：`docker-compose exec nginx nginx -t`
2. 修复配置错误
3. 重新加载：`docker-compose exec nginx nginx -s reload`

### 问题3：host.docker.internal 无法解析

**原因**：nginx容器没有配置extra_hosts

**解决方法**：
1. 检查 `deploy/docker-compose.yml` 中nginx服务是否包含：
   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```
2. 如果缺少，添加后重启nginx容器：
   ```bash
   docker-compose restart nginx
   ```

### 问题4：音乐API服务无法访问

**原因**：音乐API服务（3000端口）没有运行或无法访问

**解决方法**：
1. 检查音乐API服务是否运行：
   ```bash
   curl http://localhost:3000/
   ```
2. 检查nginx容器是否能访问宿主机：
   ```bash
   docker-compose exec nginx ping -c 2 host.docker.internal
   ```

## 生产环境部署步骤

在生产环境中应用nginx配置更改：

```bash
# 1. 进入部署目录
cd /path/to/Blog-code/deploy

# 2. 检查配置语法
docker-compose exec nginx nginx -t

# 3. 如果语法正确，重新加载配置
docker-compose exec nginx nginx -s reload

# 4. 验证配置生效
curl https://blog.mytype.top/music-api/
```

## 相关文件

- Nginx配置文件：`deploy/nginx/conf.d/default.conf`
- Docker Compose配置：`deploy/docker-compose.yml`
- 生产环境配置：`deploy/docker-compose.prod.yml`

