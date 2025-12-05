# SSL 证书配置说明

本文档说明如何为 `blog.mytype.top` 配置免费的 Let's Encrypt SSL 证书。

## 目录

- [前置要求](#前置要求)
- [证书申请](#证书申请)
- [自动续期](#自动续期)
- [验证配置](#验证配置)
- [故障排查](#故障排查)

---

## 前置要求

### 1. 域名解析

确保域名 `blog.mytype.top` 已正确解析到服务器 IP 地址：

```bash
# 检查域名解析
nslookup blog.mytype.top
# 或
dig blog.mytype.top
```

### 2. 安装 Certbot

在服务器上安装 certbot 工具：

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot -y
```

**CentOS/RHEL:**
```bash
sudo yum install certbot -y
```

### 3. 端口开放

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

### 4. 修改证书申请脚本

编辑 `deploy/scripts/get-ssl-cert.sh`，将邮箱地址修改为您的真实邮箱：

```bash
EMAIL="your-email@example.com"  # 修改为您的邮箱
```

---

## 证书申请

### 方法一：使用提供的脚本（推荐）

1. **确保服务已启动**

```bash
cd /www/Blog-code/deploy
docker-compose up -d
```

2. **运行证书申请脚本**

```bash
cd /www/Blog-code/deploy
./scripts/get-ssl-cert.sh
```

脚本会自动：
- 检查 certbot 是否安装
- 使用 standalone 模式申请证书（需要临时占用 80 端口）
- 将证书复制到 `deploy/ssl/` 目录
- 重启 Nginx 容器

### 方法二：手动申请（使用 webroot 模式）

如果您的服务已经在运行，可以使用 webroot 模式，无需停止服务：

```bash
# 进入项目目录
cd /www/Blog-code/deploy

# 申请证书
sudo certbot certonly \
    --webroot \
    -w ../Home \
    -d blog.mytype.top \
    --email your-email@example.com \
    --agree-tos \
    --non-interactive

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/blog.mytype.top/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/blog.mytype.top/privkey.pem ssl/
sudo chown -R $(whoami):$(whoami) ssl/

# 重启 Nginx
docker-compose restart nginx
```

### 方法三：使用 Docker 容器申请

如果服务器上没有安装 certbot，可以使用 Docker 容器：

```bash
# 停止 Nginx 容器（释放 80 端口）
cd /www/Blog-code/deploy
docker-compose stop nginx

# 使用 certbot 容器申请证书
docker run -it --rm \
    -v "$(pwd)/ssl:/etc/letsencrypt" \
    -v "$(pwd)/../Home:/var/www/html" \
    -p 80:80 \
    certbot/certbot certonly \
    --webroot \
    -w /var/www/html \
    -d blog.mytype.top \
    --email your-email@example.com \
    --agree-tos

# 启动 Nginx
docker-compose start nginx
```

---

## 自动续期

Let's Encrypt 证书有效期为 90 天，需要定期续期。建议配置自动续期。

### 配置自动续期

1. **测试续期脚本**

```bash
cd /www/Blog-code/deploy
./scripts/renew-ssl-cert.sh
```

2. **添加到 crontab**

编辑 crontab：

```bash
crontab -e
```

添加以下行（每天凌晨 3 点检查并续期）：

```cron
0 3 * * * /www/Blog-code/deploy/scripts/renew-ssl-cert.sh >> /var/log/ssl-renew.log 2>&1
```

或者使用 certbot 自带的续期命令：

```cron
0 3 * * * certbot renew --quiet --deploy-hook "cd /www/Blog-code/deploy && docker-compose restart nginx"
```

3. **测试自动续期**

```bash
# 测试续期（不会真正续期，只是检查）
sudo certbot renew --dry-run
```

---

## 验证配置

### 1. 检查证书文件

```bash
# 检查证书文件是否存在
ls -lh /www/Blog-code/deploy/ssl/

# 应该看到：
# - fullchain.pem
# - privkey.pem
```

### 2. 检查 Nginx 配置

```bash
# 测试 Nginx 配置
cd /www/Blog-code/deploy
docker-compose exec nginx nginx -t
```

### 3. 访问网站

在浏览器中访问：
- HTTP: `http://blog.mytype.top` （应该自动重定向到 HTTPS）
- HTTPS: `https://blog.mytype.top`

### 4. 检查 SSL 证书

使用在线工具检查：
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)

或使用命令行：

```bash
# 检查证书信息
openssl s_client -connect blog.mytype.top:443 -servername blog.mytype.top < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

---

## 故障排查

### 问题 1: 证书申请失败 - "Connection refused"

**原因**: 80 端口被占用或防火墙未开放

**解决方法**:
```bash
# 检查 80 端口占用
sudo netstat -tulpn | grep :80
sudo lsof -i :80

# 临时停止占用 80 端口的服务
# 或使用 webroot 模式申请证书
```

### 问题 2: 证书申请失败 - "DNS problem"

**原因**: 域名未正确解析到服务器

**解决方法**:
```bash
# 检查域名解析
nslookup blog.mytype.top
dig blog.mytype.top

# 确保 A 记录指向正确的服务器 IP
```

### 问题 3: Nginx 启动失败 - "SSL certificate not found"

**原因**: 证书文件不存在或路径错误

**解决方法**:
```bash
# 检查证书文件
ls -lh /www/Blog-code/deploy/ssl/

# 如果文件不存在，重新申请证书
cd /www/Blog-code/deploy
./scripts/get-ssl-cert.sh
```

### 问题 4: 浏览器显示 "不安全连接"

**可能原因**:
1. 证书未正确加载
2. 证书已过期
3. 证书域名不匹配

**解决方法**:
```bash
# 检查证书有效期
openssl x509 -in /www/Blog-code/deploy/ssl/fullchain.pem -noout -dates

# 检查证书域名
openssl x509 -in /www/Blog-code/deploy/ssl/fullchain.pem -noout -text | grep -A 1 "Subject Alternative Name"

# 如果证书过期或域名不匹配，重新申请
cd /www/Blog-code/deploy
./scripts/get-ssl-cert.sh
```

### 问题 5: HTTP 未重定向到 HTTPS

**原因**: Nginx 配置未正确加载

**解决方法**:
```bash
# 检查 Nginx 配置
cd /www/Blog-code/deploy
docker-compose exec nginx nginx -t

# 重新加载配置
docker-compose exec nginx nginx -s reload

# 或重启容器
docker-compose restart nginx
```

### 问题 6: 证书续期失败

**解决方法**:
```bash
# 手动测试续期
cd /www/Blog-code/deploy
./scripts/renew-ssl-cert.sh

# 查看详细错误信息
sudo certbot renew --verbose

# 如果续期失败，可以重新申请
./scripts/get-ssl-cert.sh
```

---

## 证书文件说明

- **fullchain.pem**: 完整证书链（包含服务器证书和中间证书）
- **privkey.pem**: 私钥文件

**重要**: 
- 私钥文件必须保密，不要泄露
- 定期备份证书文件
- 证书文件存储在 `deploy/ssl/` 目录

---

## 相关文件

- 证书申请脚本: `deploy/scripts/get-ssl-cert.sh`
- 证书续期脚本: `deploy/scripts/renew-ssl-cert.sh`
- Nginx 配置: `deploy/nginx/conf.d/default.conf`
- Docker Compose 配置: `deploy/docker-compose.prod.yml`
- 证书存储目录: `deploy/ssl/`

---

## 参考资源

- [Let's Encrypt 官网](https://letsencrypt.org/)
- [Certbot 文档](https://certbot.eff.org/)
- [Nginx SSL 配置指南](https://nginx.org/en/docs/http/configuring_https_servers.html)

---

## 更新日志

- 2025-01-XX: 初始版本，支持 Let's Encrypt 证书申请和自动续期

