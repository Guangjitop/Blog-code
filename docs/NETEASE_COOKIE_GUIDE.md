# 网易云音乐Cookie配置指南

## 简介

本系统支持通过配置网易云音乐Cookie来播放会员歌曲，无需账号密码登录。Cookie会自动保存并定期刷新，保持长效有效性。

## 获取Cookie的方法

### 方法1：从浏览器开发者工具复制（推荐）

1. 打开浏览器，访问 [https://music.163.com](https://music.163.com)
2. 登录你的网易云音乐账号
3. 按 `F12` 打开开发者工具
4. 切换到 **Application**（应用）标签页
   - Chrome/Edge: Application → Storage → Cookies
   - Firefox: Storage → Cookies
5. 在左侧找到 `https://music.163.com`
6. 在右侧Cookie列表中找到 `MUSIC_U`（最重要的字段）
7. 复制 `MUSIC_U` 的值

**完整格式**（推荐）：
```
MUSIC_U=xxx; __csrf=yyy; NMTID=zzz
```

**最简格式**（仅复制MUSIC_U的值）：
```
MUSIC_U=xxx
```

### 方法2：一键复制所有Cookie（Chrome扩展）

可以安装 "EditThisCookie" 或 "Cookie-Editor" 扩展，一键导出所有Cookie。

## 配置Cookie

### 方式1：通过Web界面配置

1. 访问音乐播放页面
2. 点击右上角 **"配置Cookie"** 按钮
3. 粘贴从浏览器复制的Cookie
4. 点击 **"保存Cookie"**

### 方式2：通过环境变量配置

在 `deploy/.env` 文件中添加：

```bash
# 网易云音乐Cookie
NETEASE_COOKIE="MUSIC_U=xxx; __csrf=yyy"

# 可选：指定 NeteaseCloudMusicApi 地址（Docker 默认自动指向 music-api 服务）
# NETEASE_API_BASE=http://music-api:3000
```

重启后端服务即可自动加载。

> Docker Compose 已将 `NETEASE_COOKIE` 和 `NETEASE_API_BASE` 映射到后端容器，填好 `deploy/.env` 后重新 `docker-compose up -d` 即可生效。

## Cookie自动刷新机制

系统会自动刷新Cookie以保持有效性：

- **刷新间隔**：默认每12小时检查一次（可配置）
- **自动刷新**：调用网易云API刷新Cookie
- **长效保持**：无需频繁重新登录

### 配置刷新间隔

在 `deploy/.env` 中修改：

```bash
# Cookie自动刷新间隔（小时）
COOKIE_REFRESH_INTERVAL=12
```

## 手动刷新Cookie

如果Cookie失效或想立即刷新，可以调用API：

```bash
curl -X POST http://localhost:8998/api/netease/refresh-cookie
```

## Cookie状态查询

查看当前Cookie状态：

```bash
curl http://localhost:8998/api/netease/cookie-status
```

返回示例：
```json
{
  "has_cookie": true,
  "cookie_count": 3,
  "need_refresh": false,
  "last_refresh": "2025-12-07T10:30:00",
  "message": "Cookie已配置"
}
```

## 安全说明

1. **本地存储**：Cookie仅保存在后端服务器的本地文件中
2. **不上传**：不会上传到任何第三方服务器
3. **加密传输**：生产环境建议启用HTTPS
4. **定期刷新**：自动刷新机制确保Cookie长期有效

## 清除Cookie

### 通过Web界面清除

1. 点击右上角头像区域的 **"退出"** 按钮
2. 确认清除

### 通过API清除

```bash
curl -X POST http://localhost:8998/api/netease/clear-cookie
```

## 常见问题

### Q: Cookie多久会过期？

A: Cookie本身有效期通常为1年，但系统每12小时（可配置）自动刷新一次，可以保持长期有效。

### Q: 只复制MUSIC_U可以吗？

A: 可以的，MUSIC_U是最重要的字段。但如果播放有问题，建议复制完整Cookie。

### Q: 多个账号可以切换吗？

A: 可以，通过"配置Cookie"界面重新设置新账号的Cookie即可切换。

### Q: Cookie会被盗用吗？

A: Cookie仅保存在你自己的服务器上，不会上传到其他地方。但请注意：
- 不要将Cookie分享给他人
- 生产环境启用HTTPS
- 定期更换Cookie

### Q: 为什么不使用账号密码登录？

A: 网易云音乐的登录API可能存在限制或验证码问题。使用Cookie更稳定可靠：
- 无需处理验证码
- 无需担心密码安全
- 更容易实现自动刷新

## API参考

### 设置Cookie

```http
POST /api/netease/set-cookie
Content-Type: application/json

{
  "cookie_string": "MUSIC_U=xxx; __csrf=yyy"
}
```

### 检查Cookie状态

```http
GET /api/netease/cookie-status
```

### 刷新Cookie

```http
POST /api/netease/refresh-cookie
```

### 清除Cookie

```http
POST /api/netease/clear-cookie
```

## 故障排除

### 问题：会员歌曲仍然只能播放30秒

**可能原因**：
1. Cookie未正确配置
2. Cookie已过期
3. MUSIC_U字段缺失

**解决方法**：
1. 检查Cookie状态：`/api/netease/cookie-status`
2. 尝试手动刷新：`/api/netease/refresh-cookie`
3. 重新获取并配置Cookie

### 问题：Cookie刷新失败

**可能原因**：
1. 网易云API服务不可用
2. Cookie已完全失效

**解决方法**：
1. 检查 `NeteaseCloudMusicApi` 是否运行：`http://localhost:3000`
2. 重新从浏览器获取新的Cookie

## 技术实现

- **后端存储**：`backend/cookies/netease_cookies.json`
- **自动刷新**：APScheduler定时任务
- **刷新API**：NeteaseCloudMusicApi `/login/refresh`
- **Cookie传递**：所有音乐API请求自动携带Cookie
