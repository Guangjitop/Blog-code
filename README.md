# 账号管理系统

基于 FastAPI + React 的账号管理系统，支持账号添加、获取和自动标记功能。

---

## 📋 目录

- [快速开始](#快速开始)
- [功能特性](#功能特性)
- [项目架构](#项目架构)
- [Docker 部署指南](#docker-部署指南)
- [SSL 证书申请](#ssl-证书申请)
- [端口配置说明](#端口配置说明)
- [从零开始部署](#从零开始部署)
- [API 接口说明](#api-接口说明)
- [域名配置指南](#域名配置指南)
- [Make 命令参考](#make-命令参考)
- [开发环境](#开发环境)

---

## 🚀 快速开始

### 一键启动（开发环境）

```bash
# 1. 启动后端 (端口 8000)
cd backend
pip install -r requirements.txt
python main.py

# 2. 启动前端 (端口 5173)
cd frontend
npm install
npm run dev

# 3. 启动首页 (端口 8080，可选)
cd Home
python -m http.server 8080
```

### 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 首页 | http://localhost:8080 | 开发者主页 |
| 前端应用 | http://localhost:5173 | React 管理界面 |
| 后端 API | http://localhost:8000 | FastAPI 接口 |
| API 文档 | http://localhost:8000/docs | Swagger UI |

### Docker 一键部署（生产环境）

```bash
# Linux/macOS
cd deploy
chmod +x scripts/*.sh
./scripts/deploy-from-zero.sh

# Windows
cd deploy
.\scripts\deploy-from-zero.ps1
```

部署后访问：
- 生产环境: `https://blog.mytype.top`（通过域名，不暴露端口）
- 本地测试: `http://localhost:8998`（仅内部访问）

---

## 功能特性

- ✅ 账号增删改查(CRUD)
- ✅ 自动标记已使用账号
- ✅ 获取未使用账号
- ✅ 重置使用标记
- ✅ 统计信息查询
- ✅ SQLite持久化存储
- ✅ 授权码系统（多租户隔离）
- ✅ 分类管理
- ✅ 批量导入账号

---

## 项目架构

### 核心功能模块

**1. 授权码系统**
- 管理员可生成/删除/启用/禁用授权码
- 用户通过授权码登录访问自己的账号和分类
- 支持自定义授权码或自动生成

**2. 分类管理**
- 创建、编辑、删除账号分类（如Netflix、Spotify等）
- 每个分类关联到特定授权码（多租户隔离）

**3. 账号管理**
- CRUD操作：添加、删除、更新、查询账号
- 批量导入账号功能
- 账号使用状态标记（已使用/未使用）
- 重置账号使用状态

**4. 统计与备份**
- 按分类统计账号使用情况
- 导出账号和分类数据

### 技术栈

**后端 (Backend)**
- **框架**: FastAPI 0.104.1
- **服务器**: Uvicorn (ASGI服务器)
- **数据库**: SQLite (accounts.db)
- **数据验证**: Pydantic 2.5.0
- **语言**: Python 3.x

**前端 (Frontend)**
- **框架**: React 19.2.0
- **构建工具**: Vite 7.2.4
- **语言**: TypeScript 5.9.3
- **路由**: React Router DOM 7.9.6
- **HTTP客户端**: Axios 1.13.2
- **UI组件库**: Radix UI
- **样式**: Tailwind CSS 3.4.17

### 数据库表结构

**auth_keys** - 授权码表
- `id`: 主键
- `key`: 授权码（唯一）
- `name`: 备注名称
- `is_enabled`: 是否启用（0/1）
- `created_at`: 创建时间

**categories** - 分类表
- `id`: 主键
- `name`: 分类名称
- `description`: 分类描述
- `owner_key`: 所属授权码
- `created_at`: 创建时间

**accounts** - 账号表
- `id`: 主键
- `email`: 邮箱（唯一）
- `password`: 密码
- `category_id`: 所属分类ID
- `owner_key`: 所属授权码
- `is_used`: 是否已使用（0/1）
- `created_at`: 创建时间
- `used_at`: 使用时间

---

## Docker 部署指南

### 系统要求

| 软件 | 最低版本 | 说明 |
|------|----------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 容器编排工具 |

### 快速启动

```bash
# Linux/macOS
cd deploy
chmod +x scripts/*.sh
./scripts/start.sh

# Windows
cd deploy
scripts\start.cmd
```

### Docker Compose 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f nginx
```

### 容器管理

```bash
# 进入容器调试
docker exec -it account-backend /bin/bash
docker exec -it account-nginx /bin/sh

# 查看容器资源使用
docker stats

# 清理未使用的资源
docker system prune -a
```

---

## SSL 证书申请

本文档说明如何为 `blog.mytype.top` 配置免费的 Let's Encrypt SSL 证书。

### 前置要求

#### 1. 域名解析

确保域名 `blog.mytype.top` 已正确解析到服务器 IP 地址：

```bash
# 检查域名解析
nslookup blog.mytype.top
# 或
dig blog.mytype.top
```

#### 2. 安装 Certbot

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot -y
```

**CentOS/RHEL:**
```bash
sudo yum install certbot -y
```

#### 3. 端口开放

确保服务器防火墙已开放 80 和 443 端口：

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 证书申请方法

#### 方法一：使用部署脚本自动申请（推荐）

部署脚本会自动检测端口占用情况，并选择合适的证书申请方式：

```bash
cd deploy
chmod +x scripts/*.sh
./scripts/deploy-from-zero.sh
```

脚本会自动：
- 检查 certbot 是否安装
- 根据端口占用情况选择申请方式
- 将证书复制到正确位置
- 配置 Nginx

#### 方法二：使用提供的证书申请脚本

```bash
# 1. 修改脚本中的邮箱地址
vim deploy/scripts/get-ssl-cert.sh
# 将 EMAIL="your-email@example.com" 修改为您的真实邮箱

# 2. 运行证书申请脚本
cd deploy
./scripts/get-ssl-cert.sh
```

脚本会自动：
- 检查 certbot 是否安装
- 使用 standalone 模式申请证书（需要临时占用 80 端口）
- 将证书复制到 `deploy/ssl/` 目录
- 重启 Nginx 容器

#### 方法三：手动申请（使用 webroot 模式）

如果您的服务已经在运行，可以使用 webroot 模式，无需停止服务：

```bash
# 进入项目目录
cd deploy

# 申请证书
sudo certbot certonly \
    --webroot \
    -w ../Home \
    -d blog.mytype.top \
    --email your-email@example.com \
    --agree-tos \
    --non-interactive

# 复制证书到项目目录（方案A：容器内使用）
sudo cp /etc/letsencrypt/live/blog.mytype.top/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/blog.mytype.top/privkey.pem ssl/
sudo chown -R $(whoami):$(whoami) ssl/

# 或保留在系统目录（方案B：宿主机Nginx使用）
# 证书已存储在 /etc/letsencrypt/live/blog.mytype.top/

# 重启 Nginx
docker-compose restart nginx
# 或重启宿主机Nginx（方案B）
sudo systemctl restart nginx
```

### 自动续期

Let's Encrypt 证书有效期为 90 天，需要定期续期。建议配置自动续期。

#### 配置自动续期

1. **测试续期脚本**

```bash
cd deploy
./scripts/renew-ssl-cert.sh
```

2. **添加到 crontab**

编辑 crontab：
```bash
crontab -e
```

添加以下行（每天凌晨 3 点检查并续期）：
```cron
0 3 * * * /path/to/Blog-code/deploy/scripts/renew-ssl-cert.sh >> /var/log/ssl-renew.log 2>&1
```

或者使用 certbot 自带的续期命令：
```cron
0 3 * * * certbot renew --quiet --deploy-hook "cd /path/to/Blog-code/deploy && docker-compose restart nginx"
```

3. **测试自动续期**

```bash
# 测试续期（不会真正续期，只是检查）
sudo certbot renew --dry-run
```

### 验证配置

#### 1. 检查证书文件

```bash
# 方案A：容器内使用
ls -lh deploy/ssl/
# 应该看到：fullchain.pem 和 privkey.pem

# 方案B：宿主机使用
ls -lh /etc/letsencrypt/live/blog.mytype.top/
```

#### 2. 检查 Nginx 配置

```bash
# 容器内Nginx（方案A）
cd deploy
docker-compose exec nginx nginx -t

# 宿主机Nginx（方案B）
sudo nginx -t
```

#### 3. 访问网站

在浏览器中访问：
- HTTP: `http://blog.mytype.top` （应该自动重定向到 HTTPS）
- HTTPS: `https://blog.mytype.top`

#### 4. 检查 SSL 证书

使用在线工具检查：
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)

或使用命令行：
```bash
openssl s_client -connect blog.mytype.top:443 -servername blog.mytype.top < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### 故障排查

详细故障排查请参考：[SSL证书配置说明](deploy/SSL证书配置说明.md)

---

## 端口配置说明

### 端口映射架构

本项目采用 Docker Compose 部署，端口配置如下：

| 服务 | 容器内端口 | 宿主机端口 | 说明 |
|------|-----------|-----------|------|
| 后端 API | 8998 | 8999 | 仅内部访问，不对外暴露 |
| 前端 Nginx | 80 | 8998 | 仅内部访问，不对外暴露 |
| 用户访问 | - | 80/443 | 通过域名访问，不暴露端口号 |

**重要**：用户通过域名 `blog.mytype.top` 访问，地址栏不会显示端口号。

### 端口占用处理方案

如果 80/443 端口被占用（如已有 Nginx 服务），提供两种部署方案：

#### 方案A：直接使用 80/443（端口可用时）

**适用场景**：80/443 端口未被占用

**配置**：
- Docker 容器直接监听 80/443 端口
- SSL 证书配置在容器内 Nginx
- 证书存储在 `deploy/ssl/` 目录

**端口映射**：
```yaml
nginx:
  ports:
    - "80:80"    # HTTP
    - "443:443"  # HTTPS
```

#### 方案B：使用现有 Nginx 反向代理（端口被占用时）

**适用场景**：80/443 端口被系统 Nginx 或其他服务占用

**配置**：
- Docker 容器使用 8998 端口（前端）和 8999 端口（后端）
- 宿主机上的 Nginx 反向代理到 `localhost:8998`
- SSL 证书配置在宿主机 Nginx
- 证书存储在 `/etc/letsencrypt/` 目录
- 用户仍通过 `blog.mytype.top` 访问，不暴露端口

**端口映射**：
```yaml
nginx:
  ports:
    - "8998:80"  # 仅内部访问
backend:
  ports:
    - "8999:8998"  # 仅内部访问
```

**宿主机 Nginx 配置**：
部署脚本会自动生成配置模板 `deploy/nginx/host-nginx-proxy.conf.example`，需要手动复制到宿主机 Nginx 配置目录：

```bash
# 复制配置模板
sudo cp deploy/nginx/host-nginx-proxy.conf.example /etc/nginx/sites-available/blog.mytype.top
# 或
sudo cp deploy/nginx/host-nginx-proxy.conf.example /etc/nginx/conf.d/blog.mytype.top.conf

# 创建符号链接（如果使用 sites-available）
sudo ln -s /etc/nginx/sites-available/blog.mytype.top /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载配置
sudo systemctl reload nginx
```

### 自动检测和选择

部署脚本 `deploy-from-zero.sh` 会自动：
1. 检查 80/443 端口占用情况
2. 根据端口占用情况自动选择方案 A 或方案 B
3. 生成相应的配置文件
4. 提供清晰的部署说明

---

## 从零开始部署

### 一键部署脚本

项目提供了完整的从零部署脚本，自动处理所有配置：

#### Linux/macOS

```bash
cd deploy
chmod +x scripts/*.sh
./scripts/deploy-from-zero.sh
```

#### Windows

```powershell
cd deploy
.\scripts\deploy-from-zero.ps1
```

### 部署脚本功能

部署脚本会自动执行以下步骤：

1. **环境检查**
   - 检查 Docker 和 Docker Compose 是否安装
   - 检查必要的系统工具

2. **端口检查**
   - 检查 80、443、8998、8999 端口占用情况
   - 自动选择部署方案（A 或 B）

3. **SSL 证书申请**
   - 检查 certbot 是否安装
   - 根据部署方案选择证书申请方式
   - 自动申请 Let's Encrypt 证书

4. **配置文件生成**
   - 自动生成 `.env` 文件（如果不存在）
   - 根据端口占用情况调整 Docker Compose 配置
   - 生成宿主机 Nginx 配置模板（方案 B）

5. **服务启动**
   - 构建 Docker 镜像
   - 启动所有服务
   - 健康检查

6. **部署验证**
   - 检查服务是否正常运行
   - 提供访问地址和后续步骤说明

### 手动部署步骤

如果不想使用自动脚本，可以按照以下步骤手动部署：

#### 1. 安装 Docker 和 Docker Compose

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install docker-compose-plugin -y
```

**Windows/macOS:**
下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### 2. 克隆项目

```bash
git clone <repository-url>
cd Blog-code
```

#### 3. 检查端口占用

```bash
# 检查 80/443 端口
sudo lsof -i :80
sudo lsof -i :443

# 或使用 netstat
sudo netstat -tulpn | grep -E ':(80|443) '
```

#### 4. 配置环境变量

```bash
cd deploy
cp .env.example .env
vim .env  # 根据需要修改配置
```

#### 5. 申请 SSL 证书

参考 [SSL 证书申请](#ssl-证书申请) 章节。

#### 6. 启动服务

**方案A（80/443 可用）：**
```bash
docker-compose up -d --build
```

**方案B（80/443 被占用）：**
```bash
# 1. 启动 Docker 服务（使用 8998 端口）
docker-compose up -d --build

# 2. 配置宿主机 Nginx 反向代理
sudo cp nginx/host-nginx-proxy.conf.example /etc/nginx/conf.d/blog.mytype.top.conf
sudo vim /etc/nginx/conf.d/blog.mytype.top.conf  # 根据需要修改
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 测试访问
curl http://localhost:8998
# 或
curl https://blog.mytype.top
```

### 部署后配置

#### 1. 配置自动续期

参考 [SSL 证书申请 - 自动续期](#自动续期) 章节。

#### 2. 配置防火墙

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8998/tcp  # 方案B需要
sudo ufw allow 8999/tcp  # 方案B需要

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 3. 配置域名解析

确保域名 `blog.mytype.top` 的 A 记录指向服务器 IP 地址。

#### 4. 备份数据

```bash
# 备份数据库
cp backend/accounts.db backup/accounts_$(date +%Y%m%d).db

# 备份 SSL 证书（方案A）
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz deploy/ssl/
```

---

## 域名配置指南

本项目使用 Cloudflare 作为 DNS 和 CDN 服务，域名 `blog.mytype.top` 通过 Cloudflare 代理访问源服务器。

### 前置条件

- 一台公网服务器（已部署本项目）
- 一个域名（如 `mytype.top`）
- Cloudflare 账号

### 步骤一：将域名托管到 Cloudflare

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击 **Add a site**，输入你的域名 `mytype.top`
3. 选择计划（Free 即可）
4. Cloudflare 会扫描现有 DNS 记录
5. 到域名注册商处，将 **Nameserver** 修改为 Cloudflare 提供的 NS 记录：
   ```
   例如：
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
6. 等待 NS 生效（通常几分钟到 48 小时）

### 步骤二：添加 DNS 记录

在 Cloudflare Dashboard → DNS → Records 中添加：

| 类型 | 名称 | 内容 | 代理状态 | TTL |
|------|------|------|----------|-----|
| A | `blog` | `你的服务器IP` | 已代理（橙色云朵） | Auto |

> **注意**：开启代理（Proxied）后，Cloudflare 会自动提供 SSL 证书和 CDN 加速，外部无法直接看到源服务器 IP。

### 步骤三：配置 SSL/TLS

1. 进入 Cloudflare Dashboard → SSL/TLS
2. 加密模式选择 **Flexible**（源服务器无需 SSL 证书）或 **Full**（源服务器有自签名证书）
   - 推荐使用 **Flexible**：Cloudflare → 用户之间 HTTPS，Cloudflare → 源服务器之间 HTTP
   - 如需端到端加密，选择 **Full (Strict)** 并在源服务器配置 SSL 证书

### 步骤四：服务器部署

```bash
# 1. SSH 连接服务器
ssh root@你的服务器IP

# 2. 安装 Docker（Ubuntu/Debian）
curl -fsSL https://get.docker.com | sh

# 3. 安装 make（如未安装）
apt install make -y

# 4. 克隆项目
mkdir -p /root/tool && cd /root/tool
git clone https://github.com/Guangjitop/Blog-code.git
cd Blog-code

# 5. 一键部署
make deploy
```

### 步骤五：验证访问

部署完成后，通过以下地址验证：

| 服务 | 地址 | 说明 |
|------|------|------|
| 首页 | `https://blog.mytype.top/` | 通过 Cloudflare 代理访问 |
| 管理后台 | `https://blog.mytype.top/app/` | React 管理界面 |
| API 文档 | `https://blog.mytype.top/docs` | Swagger UI |
| 直连测试 | `http://服务器IP:8998/` | 绕过 Cloudflare 直连 |

### Cloudflare 常用优化配置

- **Speed → Optimization**：开启 Auto Minify（JS/CSS/HTML）
- **Caching → Configuration**：Browser Cache TTL 设为 4 小时
- **Security → Settings**：Security Level 设为 Medium
- **Network**：开启 HTTP/3 (QUIC) 和 WebSockets

### 故障排查

```bash
# 检查域名是否解析到 Cloudflare
nslookup blog.mytype.top

# 检查源服务器是否正常
curl -sI http://服务器IP/

# 检查容器运行状态
make status

# 查看服务日志
make logs
```

---

## Make 命令参考

项目根目录提供了统一的 `Makefile`，封装所有部署和运维操作。在项目根目录下执行 `make <命令>` 即可。

### 部署命令

| 命令 | 说明 |
|------|------|
| `make deploy` | **一键部署**（构建镜像 + 启动服务 + 健康检查） |
| `make deploy-prod` | 生产环境部署（含资源限制） |
| `make build` | 仅构建 Docker 镜像，不启动 |
| `make up` | 启动服务（不重新构建） |
| `make down` | 停止并移除所有容器 |
| `make restart` | 重启所有服务 |
| `make update` | 拉取最新代码并重新部署（git pull + deploy） |

### 运维命令

| 命令 | 说明 |
|------|------|
| `make status` | 查看容器运行状态 |
| `make logs` | 查看所有服务日志（实时跟踪） |
| `make logs-back` | 仅查看后端日志 |
| `make logs-nginx` | 仅查看 Nginx 日志 |
| `make health` | 执行健康检查（后端 + 前端） |

### 开发命令

| 命令 | 说明 |
|------|------|
| `make dev` | 显示本地开发启动说明 |
| `make dev-front` | 启动前端开发服务器（npm run dev） |
| `make dev-back` | 启动后端开发服务器（uvicorn --reload） |
| `make test` | 运行前端测试 |

### 维护命令

| 命令 | 说明 |
|------|------|
| `make ssl` | 申请或续期 SSL 证书 |
| `make backup` | 备份数据库到 backups/ 目录 |
| `make clean` | 清理 Docker 悬挂镜像和构建缓存 |
| `make env` | 从 `.env.example` 创建 `.env` 配置文件 |
| `make help` | 显示所有可用命令列表 |

### 常用操作示例

```bash
# 首次部署
make deploy

# 代码更新后重新部署
make update

# 查看服务状态和健康检查
make status
make health

# 查看后端日志排查问题
make logs-back

# 停止所有服务
make down

# 清理 Docker 缓存释放磁盘空间
make clean
```

---

## API 接口说明

### 认证机制

1. **管理员认证**: Cookie-based (admin_token = "admin121")
2. **用户认证**: Cookie-based (user_key) 或 Query参数 (key)
3. **多租户隔离**: 通过owner_key字段实现数据隔离，每个授权码只能访问自己的数据

### 管理员接口

#### 获取所有账号
```
GET /api/admin/accounts
```

#### 添加账号
```
GET /api/admin/accounts/add?email=test@example.com&password=123456
```

#### 删除账号
```
GET /api/admin/accounts/delete?id=1
```

#### 重置账号标记
```
GET /api/admin/accounts/reset?id=1
GET /api/admin/accounts/reset-all
```

### 核心使用接口

#### 获取未使用账号(自动标记)
```
GET /api/get-account
```

**重要**: 此接口会:
1. 返回第一个未使用的账号(包含邮箱和密码)
2. 自动将该账号标记为已使用
3. 记录使用时间
4. 下次调用时不会再返回该账号

**返回示例**:
```json
{
  "success": true,
  "message": "获取账号成功",
  "account": {
    "id": 1,
    "email": "user@example.com",
    "password": "password123",
    "used_at": "2025-01-27T09:05:00"
  }
}
```

#### 获取统计信息
```
GET /api/stats
```

**返回示例**:
```json
{
  "total_accounts": 10,
  "used_accounts": 3,
  "unused_accounts": 7,
  "usage_rate": "30.0%"
}
```

### API 文档

访问 Swagger UI 查看完整的 API 文档：
- 开发环境: http://localhost:8000/docs
- 生产环境: https://blog.mytype.top/docs

---

## 开发环境

### 本地开发启动

```bash
# 1. 启动后端
cd backend
pip install -r requirements.txt
python main.py

# 2. 启动前端
cd frontend
npm install
npm run dev

# 3. 访问
# 前端: http://localhost:5173
# 后端API: http://localhost:8000
# API文档: http://localhost:8000/docs
```

## 注意事项

⚠️ **重要提示**:
1. 密码以明文存储，请确保服务器安全
2. 生产环境建议使用 HTTPS
3. 定期备份 `accounts.db` 文件
4. 定期备份 SSL 证书文件
5. 配置自动续期，避免证书过期

---

## 相关文档

- [Docker 部署详细指南](deploy/README.md)
- [SSL 证书配置说明](deploy/SSL证书配置说明.md)
- [API 文档](backend/API_DOC.md)

---

## 更新日志

- 2025-01-XX: 添加 Docker 部署支持、SSL 证书自动申请、端口占用自动处理
