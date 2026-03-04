# 部署指南 - 账号管理系统

> **一句话部署**: Linux 运行 `bash deploy/deploy.sh`，Windows 运行 `.\deploy\deploy.ps1`

---

## 目录

- [项目架构](#项目架构)
- [快速开始](#快速开始)
- [部署方案总览](#部署方案总览)
- [方案A: Linux 服务器生产部署](#方案a-linux-服务器生产部署)
- [方案B: Windows 服务器部署](#方案b-windows-服务器部署)
- [方案C: 本地开发环境](#方案c-本地开发环境)
- [SSL 证书配置](#ssl-证书配置)
- [运维命令速查](#运维命令速查)
- [故障排查](#故障排查)
- [目录结构说明](#目录结构说明)

---

## 项目架构

```
┌─────────────────────────────────────────────────┐
│                   客户端浏览器                     │
└──────────────────────┬──────────────────────────┘
                       │
            ┌──────────▼──────────┐
            │   Nginx (:8998/80)  │   反向代理 + 静态文件
            │   - Home/ 欢迎页    │
            │   - /app/ 前端 SPA  │
            └─────┬─────────┬─────┘
                  │         │
         /api/*   │         │  静态资源
                  │         │
            ┌─────▼─────┐   │
            │  FastAPI   │   │
            │  (:8998)   │   │
            │  后端 API  │   │
            └─────┬──────┘   │
                  │          │
            ┌─────▼──────┐   │
            │  SQLite DB │   │
            │ accounts.db│   │
            └────────────┘   │
```

**技术栈:**
- **前端**: React 19 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **后端**: Python FastAPI + Uvicorn
- **数据库**: SQLite
- **代理**: Nginx
- **容器化**: Docker + Docker Compose

---

## 快速开始

### Linux (推荐)

```bash
# 1. 克隆项目
git clone <repo-url> && cd Blog-code

# 2. 一键部署 (交互式)
bash deploy/deploy.sh

# 或全自动部署
bash deploy/deploy.sh --auto --domain your-domain.com
```

### Windows

```powershell
# 1. 确保已安装 Docker Desktop 并启动
# 2. 一键部署
.\deploy\deploy.ps1

# 或指定参数
.\deploy\deploy.ps1 -Domain "your-domain.com" -Mode proxy
```

### 使用 Makefile (Linux/macOS)

```bash
make deploy         # 一键部署
make deploy-prod    # 生产环境部署
make status         # 查看状态
make logs           # 查看日志
make help           # 查看所有命令
```

---

## 部署方案总览

| 方案 | 适用场景 | 端口 | SSL | 复杂度 |
|------|---------|------|-----|--------|
| **A: 直接模式** | 干净 Linux 服务器, 80/443 空闲 | 80/443 | 容器内 Nginx | 低 |
| **B: 代理模式** | 已有 Nginx/Apache, 80/443 被占用 | 8998/8999 | 宿主机 Nginx | 中 |
| **C: 本地开发** | 本机开发调试 | 8998(前端) / 8999(后端) | 无 | 低 |

> 部署脚本会自动检测端口占用情况并推荐合适的方案。

---

## 方案A: Linux 服务器生产部署

**前置要求:** Docker、Docker Compose、80/443 端口空闲

### 步骤 1: 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# 将当前用户加入 docker 组 (免 sudo)
sudo usermod -aG docker $USER
# 重新登录生效
```

### 步骤 2: 克隆并配置

```bash
git clone <repo-url>
cd Blog-code

# 从模板创建环境配置
cp deploy/.env.example deploy/.env

# 编辑配置 (必改项: ADMIN_PASSWORD, DOMAIN)
vim deploy/.env
```

**`.env` 关键配置项:**

```env
DOMAIN=your-domain.com          # 你的域名
ADMIN_PASSWORD=your-password    # 管理员密码 (务必修改!)
```

### 步骤 3: 部署

```bash
# 方式一: 统一脚本 (推荐)
bash deploy/deploy.sh --domain your-domain.com --mode direct

# 方式二: Makefile
make deploy-prod

# 方式三: 手动 docker compose
cd deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 步骤 4: 配置 SSL (可选)

```bash
# 安装 certbot
sudo apt install certbot -y

# 申请证书
sudo certbot certonly --webroot -w ./Home -d your-domain.com --email your@email.com

# 复制证书到 deploy/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/ssl/

# 取消 deploy/nginx/conf.d/default.conf 中 HTTPS server 块的注释
# 重启 nginx 容器
docker compose -f deploy/docker-compose.yml restart nginx
```

---

## 方案B: Windows 服务器部署

### 前置要求

1. **Docker Desktop for Windows** ([下载](https://www.docker.com/products/docker-desktop/))
2. 启动 Docker Desktop 并确保正在运行
3. 如需域名访问，需要 Nginx 或 IIS 做反向代理

### 步骤 1: 配置

```powershell
# 从模板创建环境配置
Copy-Item deploy\.env.example deploy\.env

# 编辑 deploy\.env，修改 ADMIN_PASSWORD 等
notepad deploy\.env
```

### 步骤 2: 部署

```powershell
# 方式一: 统一脚本 (推荐)
.\deploy\deploy.ps1

# 方式二: 手动
cd deploy
docker compose up -d --build
```

### 步骤 3: 验证

```powershell
# 查看状态
.\deploy\deploy.ps1 -Action status

# 健康检查
.\deploy\deploy.ps1 -Action health

# 访问
# 前端: http://localhost:8998/
# 后台: http://localhost:8998/app/
# API:  http://localhost:8999/docs
```

### Windows IIS 反向代理 (可选)

如需通过域名访问，可配置 IIS ARR (Application Request Routing):

1. 安装 IIS + ARR 模块
2. 创建反向代理规则，将域名指向 `http://localhost:8998`
3. 配置 SSL 证书

---

## 方案C: 本地开发环境

```bash
# 后端 (终端 1)
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8999 --reload

# 前端 (终端 2)
cd frontend
npm install
npm run dev
# 访问 http://localhost:8998
```

或使用 Makefile:

```bash
make dev-back    # 终端 1
make dev-front   # 终端 2
```

---

## SSL 证书配置

### 方式 1: Let's Encrypt (免费, 推荐)

```bash
# 安装 certbot
sudo apt install certbot -y

# 申请证书 (需要域名已解析到服务器)
sudo certbot certonly --webroot -w ./Home -d your-domain.com

# 自动续期 (certbot 默认会设置 cron)
sudo certbot renew --dry-run
```

### 方式 2: Cloudflare (最简单)

1. 将域名 DNS 托管到 Cloudflare
2. 在 Cloudflare 面板开启 SSL (Flexible 或 Full)
3. 服务器端无需配置证书

### 方式 3: 自签名证书 (仅测试)

```bash
bash deploy/scripts/create-self-signed-cert.sh
```

---

## 运维命令速查

### 统一脚本方式

| 操作 | Linux | Windows |
|------|-------|---------|
| **部署** | `bash deploy/deploy.sh` | `.\deploy\deploy.ps1` |
| **状态** | `bash deploy/deploy.sh --status` | `.\deploy\deploy.ps1 -Action status` |
| **日志** | `bash deploy/deploy.sh --logs` | `.\deploy\deploy.ps1 -Action logs` |
| **停止** | `bash deploy/deploy.sh --stop` | `.\deploy\deploy.ps1 -Action stop` |
| **重启** | `bash deploy/deploy.sh --restart` | `.\deploy\deploy.ps1 -Action restart` |
| **健康检查** | `bash deploy/deploy.sh --health` | `.\deploy\deploy.ps1 -Action health` |
| **备份** | `bash deploy/deploy.sh --backup` | `.\deploy\deploy.ps1 -Action backup` |
| **更新** | `bash deploy/deploy.sh --update` | `.\deploy\deploy.ps1 -Action update` |

### Makefile 方式 (Linux/macOS)

```bash
make deploy       # 一键部署
make deploy-prod  # 生产部署
make up           # 启动
make down         # 停止
make restart      # 重启
make status       # 状态
make logs         # 全部日志
make logs-back    # 后端日志
make logs-nginx   # Nginx 日志
make health       # 健康检查
make backup       # 备份数据库
make clean        # 清理 Docker 缓存
make test         # 运行测试
make help         # 查看所有命令
```

### 原生 Docker Compose 方式

```bash
cd deploy

# 启动
docker compose up -d --build

# 生产环境 (含资源限制)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 停止
docker compose down

# 日志
docker compose logs -f

# 重启单个服务
docker compose restart backend
docker compose restart nginx

# 重建单个服务
docker compose up -d --build backend
```

---

## 故障排查

### 常见问题

**1. 端口被占用**

```bash
# 查看端口占用
lsof -i :8998    # Linux
netstat -ano | findstr 8998   # Windows

# 解决: 修改 deploy/.env 中的端口，或停止占用端口的服务
```

**2. 容器启动失败**

```bash
# 查看日志
docker compose -f deploy/docker-compose.yml logs --tail=50

# 查看特定容器
docker compose -f deploy/docker-compose.yml logs backend
docker compose -f deploy/docker-compose.yml logs nginx
```

**3. 后端 502 错误**

```bash
# 检查后端容器是否运行
docker ps | grep account-backend

# 查看后端日志
docker logs account-backend --tail=50

# 重启后端
docker compose -f deploy/docker-compose.yml restart backend
```

**4. 前端页面空白**

```bash
# 检查构建是否成功
docker logs account-nginx --tail=50

# 重新构建前端
docker compose -f deploy/docker-compose.yml up -d --build nginx
```

**5. 数据库文件权限**

```bash
# 确保 accounts.db 可写
chmod 666 backend/accounts.db

# 如果文件不存在, 后端会自动创建
```

### 诊断命令

```bash
# 查看所有容器状态
docker ps -a

# 进入后端容器调试
docker exec -it account-backend bash

# 进入 nginx 容器调试
docker exec -it account-nginx sh

# 查看容器资源使用
docker stats

# 查看 Docker 网络
docker network ls
docker network inspect deploy_app-network
```

---

## 目录结构说明

```
Blog-code/
├── Makefile                    # 统一命令入口 (make xxx)
├── DEPLOYMENT_GUIDE.md         # 本文档
├── Home/                       # 静态欢迎页
├── frontend/                   # React 前端
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/                    # FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   └── accounts.db             # SQLite 数据库 (运行时生成)
└── deploy/                     # 部署配置
    ├── deploy.sh               # Linux 统一部署脚本
    ├── deploy.ps1              # Windows 统一部署脚本
    ├── .env.example            # 环境变量模板
    ├── docker-compose.yml      # Docker 主编排文件
    ├── docker-compose.prod.yml # 生产环境覆盖 (资源限制+日志)
    ├── Dockerfile.backend      # 后端镜像
    ├── Dockerfile.frontend     # 前端镜像 (多阶段构建)
    ├── nginx/
    │   ├── nginx.conf          # Nginx 主配置
    │   ├── conf.d/default.conf # 站点配置
    │   └── host-nginx-proxy.conf.example  # 宿主机反向代理模板
    ├── ssl/                    # SSL 证书目录
    └── scripts/                # 辅助脚本 (SSL、诊断等)
```

---

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 / 8998 | Nginx | 前端页面 + API 反向代理 |
| 8999 | FastAPI | 后端 API (宿主机映射, 容器内 8998) |
| 443 | Nginx | HTTPS (启用 SSL 后) |
