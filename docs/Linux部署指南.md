# Linux 服务器部署指南

本文档详细说明如何在 Linux 服务器上部署账号管理系统。

## 系统要求

- **操作系统**: Linux (Ubuntu 18.04+, CentOS 7+, Debian 9+ 等)
- **Python**: 3.7 或更高版本
- **内存**: 最低 512MB
- **磁盘**: 最低 100MB

## 快速部署 (推荐)

### 方法一: 一键部署脚本

```bash
# 1. 进入项目目录
cd /path/to/message

# 2. 赋予执行权限
chmod +x scripts/quick-deploy.sh

# 3. 运行一键部署
bash scripts/quick-deploy.sh
```

这个脚本会自动完成:
- ✅ 检测 Python 环境
- ✅ 安装所有依赖
- ✅ 启动服务
- ✅ 显示访问地址

### 方法二: 手动部署

```bash
# 1. 进入项目目录
cd /path/to/message

# 2. 安装依赖
python3 -m pip install -r requirements.txt

# 3. 赋予脚本执行权限
chmod +x scripts/deploy.sh

# 4. 启动服务
./scripts/deploy.sh start
```

## 服务管理

### 启动服务
```bash
./scripts/deploy.sh start
```

### 停止服务
```bash
./scripts/deploy.sh stop
```

### 重启服务
```bash
./scripts/deploy.sh restart
```

### 查看状态
```bash
./scripts/deploy.sh status
```

### 查看日志
```bash
# 查看最近日志
./scripts/deploy.sh logs

# 实时查看日志
tail -f app.log

# 查看错误日志
./scripts/deploy.sh errors
```

## 常见问题排查

### 1. 启动失败: "未找到 Python"

**问题**: 系统未安装 Python 或版本过低

**解决方案**:

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install python3 python3-pip -y
```

**CentOS/RHEL**:
```bash
sudo yum install python3 python3-pip -y
```

### 2. 启动失败: "缺少必要的Python模块"

**问题**: 依赖未正确安装

**解决方案**:
```bash
# 手动安装依赖
python3 -m pip install -r requirements.txt

# 如果遇到权限问题
python3 -m pip install --user -r requirements.txt

# 或使用 sudo
sudo python3 -m pip install -r requirements.txt
```

### 3. 启动失败: "Permission denied"

**问题**: 脚本没有执行权限

**解决方案**:
```bash
chmod +x scripts/deploy.sh
chmod +x scripts/quick-deploy.sh
```

### 4. 端口被占用

**问题**: 8000 端口已被其他程序使用

**解决方案**:
```bash
# 查看占用端口的进程
lsof -i :8000
# 或
netstat -tulpn | grep :8000

# 终止占用进程 (替换 <PID> 为实际进程ID)
kill -9 <PID>

# 或修改 main.py 中的端口号
```

### 5. 查看详细错误信息

```bash
# 查看错误日志
cat error.log

# 查看最近20行错误
tail -n 20 error.log

# 实时监控错误日志
tail -f error.log
```

## 生产环境部署建议

### 1. 使用 systemd 服务 (推荐)

创建服务文件 `/etc/systemd/system/account-api.service`:

```ini
[Unit]
Description=Account Management API Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/message
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 /path/to/message/main.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/account-api/app.log
StandardError=append:/var/log/account-api/error.log

[Install]
WantedBy=multi-user.target
```

**注意**: 
- 将 `/path/to/message` 替换为实际项目路径
- 根据需要修改 `User` (建议不要使用 root)
- 创建日志目录: `sudo mkdir -p /var/log/account-api`

**管理命令**:
```bash
# 重新加载配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start account-api

# 停止服务
sudo systemctl stop account-api

# 重启服务
sudo systemctl restart account-api

# 查看状态
sudo systemctl status account-api

# 开机自启
sudo systemctl enable account-api

# 查看日志
sudo journalctl -u account-api -f
```

### 2. 使用 Nginx 反向代理

安装 Nginx:
```bash
# Ubuntu/Debian
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y
```

配置文件 `/etc/nginx/sites-available/account-api`:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持 (如果需要)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用配置:
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/account-api /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 3. 配置防火墙

**UFW (Ubuntu/Debian)**:
```bash
# 允许 HTTP
sudo ufw allow 80/tcp

# 允许 HTTPS (如果配置了SSL)
sudo ufw allow 443/tcp

# 如果直接访问8000端口
sudo ufw allow 8000/tcp

# 启用防火墙
sudo ufw enable
```

**firewalld (CentOS/RHEL)**:
```bash
# 允许 HTTP
sudo firewall-cmd --permanent --add-service=http

# 允许 HTTPS
sudo firewall-cmd --permanent --add-service=https

# 允许自定义端口
sudo firewall-cmd --permanent --add-port=8000/tcp

# 重载配置
sudo firewall-cmd --reload
```

### 4. 配置 HTTPS (可选但推荐)

使用 Let's Encrypt 免费证书:

```bash
# 安装 certbot
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 5. 日志轮转

创建配置文件 `/etc/logrotate.d/account-api`:
```
/path/to/message/app.log /path/to/message/error.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    create 0640 www-data www-data
}
```

手动测试:
```bash
sudo logrotate -f /etc/logrotate.d/account-api
```

### 6. 监控和健康检查

创建健康检查脚本 `/usr/local/bin/check-account-api.sh`:
```bash
#!/bin/bash

SERVICE_URL="http://localhost:8000/api/stats"

if curl -f -s "$SERVICE_URL" > /dev/null; then
    echo "$(date): Service is running" >> /var/log/account-api/health-check.log
    exit 0
else
    echo "$(date): Service is down, restarting..." >> /var/log/account-api/health-check.log
    systemctl restart account-api
    exit 1
fi
```

设置执行权限:
```bash
sudo chmod +x /usr/local/bin/check-account-api.sh
```

添加到 crontab (每5分钟检查):
```bash
sudo crontab -e

# 添加以下行
*/5 * * * * /usr/local/bin/check-account-api.sh
```

## 性能优化

### 1. 使用多进程

修改 `main.py` 底部:
```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        workers=4  # 根据CPU核心数调整
    )
```

### 2. 数据库优化

定期备份数据库:
```bash
# 创建备份脚本
cat > /usr/local/bin/backup-account-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/account-api"
mkdir -p "$BACKUP_DIR"
cp /path/to/message/accounts.db "$BACKUP_DIR/accounts-$(date +%Y%m%d-%H%M%S).db"
# 保留最近7天的备份
find "$BACKUP_DIR" -name "accounts-*.db" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-account-db.sh

# 添加到 crontab (每天凌晨2点备份)
sudo crontab -e
# 添加: 0 2 * * * /usr/local/bin/backup-account-db.sh
```

## 安全建议

1. **不要使用 root 用户运行服务**
2. **配置防火墙，只开放必要端口**
3. **使用 HTTPS 加密传输**
4. **定期更新系统和依赖包**
5. **限制数据库文件访问权限**:
   ```bash
   chmod 600 accounts.db
   ```
6. **考虑添加 API 认证机制**

## 卸载

```bash
# 1. 停止服务
./scripts/deploy.sh stop

# 或停止 systemd 服务
sudo systemctl stop account-api
sudo systemctl disable account-api
sudo rm /etc/systemd/system/account-api.service
sudo systemctl daemon-reload

# 2. 删除项目文件
rm -rf /path/to/message

# 3. 删除日志 (可选)
sudo rm -rf /var/log/account-api

# 4. 删除 Nginx 配置 (如果配置了)
sudo rm /etc/nginx/sites-enabled/account-api
sudo rm /etc/nginx/sites-available/account-api
sudo systemctl restart nginx
```

## 技术支持

如遇到问题:
1. 查看错误日志: `./scripts/deploy.sh errors`
2. 检查服务状态: `./scripts/deploy.sh status`
3. 查看系统日志: `sudo journalctl -xe`
