# 账号管理系统 - Docker 部署指南

## 📋 目录

- [快速开始](#快速开始)
- [系统要求](#系统要求)
- [部署步骤](#部署步骤)
- [配置说明](#配置说明)
- [常用命令](#常用命令)
- [生产环境部署](#生产环境部署)
- [镜像部署（推荐）](#镜像部署推荐)
- [常见问题](#常见问题)

## 🚀 快速开始

### Windows

```cmd
cd deploy
scripts\start.cmd
```

### Linux / macOS

```bash
cd deploy
chmod +x scripts/*.sh
./scripts/start.sh
```

启动后访问：
- 欢迎页: http://localhost/
- 应用: http://localhost/app/
- API文档: http://localhost/docs

## 💻 系统要求

### 必需软件

| 软件 | 最低版本 | 说明 |
|------|----------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 容器编排工具 |

### 操作系统支持

- **Windows 10/11**: 需安装 Docker Desktop
- **macOS**: 需安装 Docker Desktop
- **Linux**: 原生支持 Docker

## 📦 部署步骤

### 1. 安装 Docker

#### Windows / macOS
下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. 配置环境变量

```bash
cd deploy
cp .env.example .env
```

编辑 `.env` 文件，根据需要修改配置。

### 3. 启动服务

```bash
# Windows
scripts\start.cmd

# Linux/macOS
./scripts/start.sh
```

## ⚙️ 配置说明

### 环境变量 (.env)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DOMAIN` | localhost | 部署域名 |
| `APP_PORT` | 80 | HTTP端口 |
| `APP_SSL_PORT` | 443 | HTTPS端口 |
| `BACKEND_PORT` | 8998 | 后端内部端口 |
| `SSL_ENABLED` | false | 是否启用SSL |
| `ADMIN_PASSWORD` | admin121 | 管理员密码 |

### 域名配置示例

本地开发：
```env
DOMAIN=localhost
APP_PORT=80
```

生产环境：
```env
DOMAIN=example.com
APP_PORT=80
SSL_ENABLED=true
```

## 🔧 常用命令

### 启动服务
```bash
# Windows
scripts\start.cmd

# Linux/macOS
./scripts/start.sh
```

### 停止服务
```bash
# Windows
scripts\stop.cmd

# Linux/macOS
./scripts/stop.sh
```

### 查看日志
```bash
# Windows
scripts\logs.cmd

# Linux/macOS
./scripts/logs.sh
```

### 手动 Docker 命令

```bash
# 查看运行状态
docker-compose ps

# 重启单个服务
docker-compose restart nginx
docker-compose restart backend

# 重新构建
docker-compose up -d --build

# 清理所有容器和镜像
docker-compose down --rmi all -v
```

## 🏭 生产环境部署

### 使用生产配置

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 启用 HTTPS

1. 准备SSL证书文件
2. 创建 `deploy/ssl/` 目录
3. 放入证书文件：`cert.pem` 和 `key.pem`
4. 修改 `.env`：
   ```env
   SSL_ENABLED=true
   ```
5. 取消 `docker-compose.prod.yml` 中SSL卷挂载的注释
6. 添加HTTPS配置到 `nginx/conf.d/default.conf`

## 🐳 镜像部署（推荐）

使用预构建的Docker镜像进行部署，无需在服务器上构建，部署更快更简单。

### 快速部署

在Linux服务器上：

```bash
# 1. 设置镜像环境变量
export BACKEND_IMAGE="docker.io/your-username/blog-backend:latest"
export FRONTEND_IMAGE="docker.io/your-username/blog-frontend:latest"

# 2. 一键部署（自动检查端口、拉取镜像、启动服务）
cd deploy
chmod +x scripts/*.sh
./scripts/quick-deploy.sh
```

### 镜像构建和推送（开发者端）

#### 1. 配置镜像仓库

```bash
cd deploy
cp .env.images.example .env.images
# 编辑 .env.images，设置 IMAGE_REGISTRY 和 IMAGE_USERNAME
```

#### 2. 构建镜像

```bash
# Linux/macOS
./scripts/build-images.sh

# Windows
scripts\build-images.cmd
```

#### 3. 推送镜像

```bash
# 先登录镜像仓库
docker login

# 推送镜像
./scripts/push-images.sh
```

### 详细文档

完整的镜像部署指南请参考：[镜像部署指南](../docs/镜像部署指南.md)

### 镜像部署优势

- ✅ **快速部署**: 无需构建环境，直接拉取运行
- ✅ **环境一致**: 镜像包含所有依赖，环境一致性好
- ✅ **易于更新**: 拉取新镜像即可更新
- ✅ **端口检查**: 自动检查并处理80/443端口占用
- ✅ **域名访问**: 支持域名直接访问，无需端口号

## ❓ 常见问题

### Q: 端口被占用怎么办？

修改 `.env` 文件中的 `APP_PORT`：
```env
APP_PORT=8080
```

### Q: 如何查看容器日志？

```bash
# 查看所有日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs nginx

# 实时跟踪日志
docker-compose logs -f
```

### Q: 数据库文件在哪里？

数据库文件位于 `backend/accounts.db`，通过卷挂载持久化。

### Q: 如何备份数据？

```bash
# 备份数据库
cp backend/accounts.db backup/accounts_$(date +%Y%m%d).db
```

### Q: 如何更新部署？

```bash
# 拉取最新代码后
cd deploy
docker-compose up -d --build
```

## 📁 目录结构

```
deploy/
├── docker-compose.yml          # 主编排文件（本地构建）
├── docker-compose.prod.yml     # 生产环境覆盖
├── docker-compose.images.yml   # 镜像部署配置（使用预构建镜像）
├── .env.example                # 环境变量模板
├── .env.images.example        # 镜像配置模板
├── Dockerfile.frontend         # 前端构建镜像
├── Dockerfile.backend          # 后端运行镜像
├── nginx/
│   ├── nginx.conf              # Nginx主配置
│   └── conf.d/
│       └── default.conf        # 站点配置
├── scripts/
│   ├── start.sh / start.cmd    # 启动脚本
│   ├── stop.sh / stop.cmd      # 停止脚本
│   ├── logs.sh / logs.cmd      # 日志脚本
│   ├── build-images.sh         # 构建镜像脚本
│   ├── push-images.sh          # 推送镜像脚本
│   ├── check-ports.sh          # 端口检查脚本
│   ├── pull-and-run.sh         # 拉取运行脚本
│   └── quick-deploy.sh         # 一键部署脚本
└── README.md                   # 本文档
```
