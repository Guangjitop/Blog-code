# 账号管理系统

基于 FastAPI + React 的账号管理系统，支持账号添加、获取和自动标记功能。

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
| 首页 | http://localhost:8080 | 开发者主页（带音乐播放器） |
| 前端应用 | http://localhost:5173 | React 管理界面 |
| 后端 API | http://localhost:8000 | FastAPI 接口 |
| API 文档 | http://localhost:8000/docs | Swagger UI |

### 首页音乐播放器

首页支持本地音乐播放，将音乐文件放入 `Home/musics/` 目录即可：

```bash
# 添加音乐后，运行脚本更新播放列表
cd Home
python generate_playlist.py
```

支持格式：MP3、FLAC、WAV、OGG、AAC、M4A、WEBM

文件命名建议：`艺术家 - 歌曲名.格式`（如 `周杰伦 - 晴天.mp3`）

---

## 功能特性

- ✅ 账号增删改查(CRUD)
- ✅ 自动标记已使用账号
- ✅ 获取未使用账号
- ✅ 重置使用标记
- ✅ 统计信息查询
- ✅ SQLite持久化存储
- ✅ 全部使用GET请求

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行服务器

```bash
python main.py
```

服务器将在 `http://localhost:8000` 启动,数据库文件 `accounts.db` 会自动创建。

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 📋 管理员接口

#### 1. 获取所有账号
```
GET http://localhost:8000/admin/accounts
```
返回所有账号列表(包含使用状态)

#### 2. 添加账号
```
GET http://localhost:8000/admin/accounts/add?email=test@example.com&password=123456
```

#### 3. 删除账号
```
GET http://localhost:8000/admin/accounts/delete?id=1
```

#### 4. 重置单个账号标记
```
GET http://localhost:8000/admin/accounts/reset?id=1
```
将指定账号的使用标记重置为未使用

#### 5. 重置所有账号标记
```
GET http://localhost:8000/admin/accounts/reset-all
```
将所有账号的使用标记重置为未使用

### 🔑 核心使用接口

#### 获取未使用账号(自动标记)
```
GET http://localhost:8000/api/get-account
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
    "email": "quachthikimthuy5cbxh@nkh.edu.vn",
    "password": "Phat3479",
    "used_at": "2025-11-27T09:05:00"
  }
}
```

#### 获取统计信息
```
GET http://localhost:8000/api/stats
```

返回示例:
```json
{
  "total_accounts": 10,
  "used_accounts": 3,
  "unused_accounts": 7,
  "usage_rate": "30.0%"
}
```

## 使用流程

### 场景1: 管理员添加账号
```bash
# 添加账号1
curl "http://localhost:8000/admin/accounts/add?email=user1@example.com&password=pass1"

# 添加账号2
curl "http://localhost:8000/admin/accounts/add?email=user2@example.com&password=pass2"

# 查看所有账号
curl "http://localhost:8000/admin/accounts"
```

### 场景2: 获取账号使用
```bash
# 第一次获取 - 返回账号1
curl "http://localhost:8000/api/get-account"

# 第二次获取 - 返回账号2(账号1已被标记)
curl "http://localhost:8000/api/get-account"

# 查看统计
curl "http://localhost:8000/api/stats"
```

### 场景3: 重置标记
```bash
# 重置所有账号
curl "http://localhost:8000/admin/accounts/reset-all"

# 或重置单个账号
curl "http://localhost:8000/admin/accounts/reset?id=1"
```

## 默认账号

系统启动时会自动添加一个默认账号:
- 邮箱: `quachthikimthuy5cbxh@nkh.edu.vn`
- 密码: `Phat3479`
- 状态: 未使用

## 部署到服务器

### Windows服务器

#### 启动服务
```bash
# 方法1: 后台运行 (基础)
start /B python main.py > app.log 2>&1

# 方法2: 使用 waitress (推荐生产环境)
pip install waitress
waitress-serve --host=0.0.0.0 --port=8000 main:app

# 方法3: 使用 PowerShell 后台运行
Start-Process python -ArgumentList "main.py" -WindowStyle Hidden -RedirectStandardOutput "app.log" -RedirectStandardError "error.log"
```

#### 查看进程
```bash
# 查找 Python 进程
tasklist | findstr python

# 查看端口占用
netstat -ano | findstr :8000
```

#### 停止服务
```bash
# 通过端口号查找并终止进程
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8000') do taskkill /F /PID %a

# 或直接通过进程名终止
taskkill /F /IM python.exe /FI "WINDOWTITLE eq main.py"

# 通过PID终止 (替换 <PID> 为实际进程ID)
taskkill /F /PID <PID>
```

#### 重启服务
```bash
# 先停止再启动
taskkill /F /IM python.exe /FI "WINDOWTITLE eq main.py" && timeout /t 2 && start /B python main.py > app.log 2>&1
```

#### 查看日志
```bash
# 实时查看日志
powershell Get-Content app.log -Wait -Tail 50

# 查看最后100行
powershell Get-Content app.log -Tail 100
```

---

### Linux服务器

#### 启动服务
```bash
# 方法1: 使用 nohup 后台运行
nohup python main.py > app.log 2>&1 &




```

#### 手动进程管理
```bash
# 查看进程
ps aux | grep "python main.py"

# 查看端口占用
lsof -i :8000
netstat -tulpn | grep :8000

# 停止服务 (通过进程名)
pkill -f "python main.py"

# 停止服务 (通过PID)
kill -9 <PID>

# 重启服务 (先停止再启动)
pkill -f "python main.py" && sleep 2 && nohup python main.py > app.log 2>&1 &
```

#### 查看日志
```bash
# 实时查看日志
tail -f app.log

# 查看最后100行
tail -n 100 app.log

# 使用 less 分页查看
less app.log

# 查看 systemd 日志
sudo journalctl -u account-api -n 100 -f
```

---

### 使用Docker

#### Dockerfile
```dockerfile
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用文件
COPY main.py .

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "main.py"]
```

#### 构建镜像
```bash
# 构建镜像
docker build -t account-api:latest .

# 查看镜像
docker images | grep account-api
```

#### 启动容器
```bash
# 基础运行
docker run -d \
  --name account-api \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  account-api:latest

# 带重启策略运行
docker run -d \
  --name account-api \
  --restart=always \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  -e TZ=Asia/Shanghai \
  account-api:latest
```

#### 容器管理
```bash
# 查看运行中的容器
docker ps

# 查看所有容器(包括停止的)
docker ps -a

# 停止容器
docker stop account-api

# 启动容器
docker start account-api

# 重启容器
docker restart account-api

# 删除容器 (需先停止)
docker stop account-api
docker rm account-api

# 强制删除运行中的容器
docker rm -f account-api
```

#### 查看日志
```bash
# 实时查看日志
docker logs -f account-api

# 查看最后100行
docker logs --tail 100 account-api

# 查看带时间戳的日志
docker logs -t account-api
```

#### 进入容器调试
```bash
# 进入容器 shell
docker exec -it account-api /bin/bash

# 查看容器内进程
docker exec account-api ps aux

# 查看容器资源使用
docker stats account-api
```

#### 清理资源
```bash
# 删除容器
docker rm -f account-api

# 删除镜像
docker rmi account-api:latest

# 清理未使用的镜像
docker image prune -a

# 清理所有未使用的资源
docker system prune -a
```

#### Docker Compose (可选)
创建 `docker-compose.yml`:
```yaml
version: '3.8'

services:
  account-api:
    build: .
    container_name: account-api
    restart: always
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

使用 Docker Compose:
```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 重新构建并启动
docker-compose up -d --build
```

---

### 生产环境建议

#### 使用 Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 日志轮转配置
创建 `/etc/logrotate.d/account-api`:
```
/var/log/account-api/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload account-api > /dev/null 2>&1 || true
    endscript
}
```

#### 监控脚本
```bash
#!/bin/bash
# check_service.sh - 服务健康检查

SERVICE_URL="http://localhost:8000/api/stats"

if curl -f -s "$SERVICE_URL" > /dev/null; then
    echo "Service is running"
    exit 0
else
    echo "Service is down, restarting..."
    systemctl restart account-api
    exit 1
fi
```

添加到 crontab (每5分钟检查一次):
```bash
*/5 * * * * /path/to/check_service.sh >> /var/log/account-api/health-check.log 2>&1
```

## 数据库说明

- 数据库文件: `accounts.db` (SQLite)
- 表结构:
  - `id`: 主键
  - `email`: 邮箱(唯一)
  - `password`: 密码
  - `is_used`: 是否已使用(0/1)
  - `created_at`: 创建时间
  - `used_at`: 使用时间

## 注意事项

⚠️ **重要提示**:
1. 密码以明文存储,请确保服务器安全
2. 建议添加管理员认证机制
3. 生产环境建议使用HTTPS
4. 定期备份 `accounts.db` 文件

## 技术栈

### 后端 (Backend)
- **框架**: FastAPI 0.104.1
- **服务器**: Uvicorn (ASGI服务器)
- **数据库**: SQLite (accounts.db)
- **数据验证**: Pydantic 2.5.0 (支持邮箱验证)
- **语言**: Python 3.x

### 前端 (Frontend)
- **框架**: React 19.2.0
- **构建工具**: Vite 7.2.4
- **语言**: TypeScript 5.9.3
- **路由**: React Router DOM 7.9.6
- **HTTP客户端**: Axios 1.13.2
- **UI组件库**: Radix UI (Dialog, Label, Select, Slot, Tabs)
- **样式**: Tailwind CSS 3.4.17
- **图标**: Lucide React 0.555.0
- **工具库**: clsx, tailwind-merge, class-variance-authority

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

### 项目文件结构

```
backend/
├── main.py                 # FastAPI主应用（包含所有API路由）
├── accounts.db            # SQLite数据库
├── requirements.txt       # Python依赖
├── static/               # 静态HTML页面
│   ├── admin.html        # 管理员界面
│   ├── user.html         # 用户界面
│   └── index.html        # 首页
├── tests/                # 测试文件
└── scripts/              # 部署脚本

frontend/
├── src/
│   ├── pages/           # 页面组件
│   │   ├── AdminDashboard.tsx    # 管理员仪表板
│   │   ├── AdminLogin.tsx        # 管理员登录
│   │   ├── UserDashboard.tsx     # 用户仪表板
│   │   ├── UserLogin.tsx         # 用户登录
│   │   └── LandingPage.tsx       # 落地页
│   ├── components/ui/   # UI组件（按钮、卡片、对话框等）
│   ├── contexts/        # React上下文（主题、Toast）
│   └── lib/            # 工具库（axios配置、utils）
├── dist/               # 构建输出
└── package.json        # 前端依赖

.kiro/specs/           # 功能规格文档
docs/                  # 项目文档（中文）
```

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

### API架构

- **管理员API**: `/api/admin/*` - 需要管理员密码认证（Cookie: admin_token）
- **用户API**: `/api/admin/*` (带授权码) - 需要授权码验证（Query参数或Cookie）
- **认证API**: `/api/admin/login`, `/api/user/login`
- **统计API**: `/api/stats/*`
- **备份API**: `/api/backup/*`

### 认证机制

1. **管理员认证**: Cookie-based (admin_token = "admin121")
2. **用户认证**: Cookie-based (user_key) 或 Query参数 (key)
3. **多租户隔离**: 通过owner_key字段实现数据隔离，每个授权码只能访问自己的数据
