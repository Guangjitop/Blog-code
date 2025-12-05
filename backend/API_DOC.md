# 账号管理系统 API 文档

> 基础URL: `http://localhost:8000`
> 
> 交互式文档: `http://localhost:8000/docs`

---

## 分类管理

### 获取所有分类
```
GET /admin/categories
```
**响应示例:**
```json
[
  {
    "id": 1,
    "name": "Netflix",
    "description": "Netflix流媒体账号",
    "account_count": 5,
    "created_at": "2025-11-28T10:00:00"
  }
]
```

### 添加分类
```
GET /admin/categories/add?name=分类名&description=描述
```
| 参数 | 必填 | 说明 |
|------|------|------|
| name | 是 | 分类名称 |
| description | 否 | 分类描述 |

### 更新分类
```
GET /admin/categories/update?id=1&name=新名称&description=新描述
```

### 删除分类
```
GET /admin/categories/delete?id=1
```

---

## 账号管理

### 获取所有账号
```
GET /admin/accounts
GET /admin/accounts?category_id=1  # 按分类筛选
```

### 添加账号
```
GET /admin/accounts/add?email=xxx@email.com&password=xxx&category_id=1
```
| 参数 | 必填 | 说明 |
|------|------|------|
| email | 是 | 邮箱地址 |
| password | 是 | 密码 |
| category_id | 否 | 分类ID |

### 更新账号
```
GET /admin/accounts/update?id=1&email=new@email.com&password=newpwd&category_id=2
```

### 删除账号
```
GET /admin/accounts/delete?id=1
```

### 重置单个账号状态
```
GET /admin/accounts/reset?id=1
```

### 重置所有账号状态
```
GET /admin/accounts/reset-all
```

---

## 查询接口

### 按条件查询账号
```
GET /api/query?category_id=1&is_used=false&keyword=gmail
```
| 参数 | 必填 | 说明 |
|------|------|------|
| category_id | 否 | 分类ID |
| is_used | 否 | 是否已使用 (true/false) |
| keyword | 否 | 邮箱关键词 |

### 查询账号密码
```
GET /api/query/password?email=xxx@email.com
```
**响应示例:**
```json
{
  "success": true,
  "account": {
    "id": 1,
    "email": "xxx@email.com",
    "password": "yourpassword",
    "category_name": "Netflix",
    "is_used": false
  }
}
```

### 获取未使用账号（核心接口）
```
GET /api/get-account
GET /api/get-account?category_id=1  # 指定分类
```
**响应:** 纯文本格式
```
获取账号成功!
请及时使用并妥善保管
若24小时账号存在问题联系客服
分类：Netflix
账号：xxx@email.com
密码：yourpassword
时间：2025-11-28 10:00:00
```

---

## 统计信息

### 获取总体统计
```
GET /api/stats
```
**响应示例:**
```json
{
  "total_accounts": 100,
  "used_accounts": 30,
  "unused_accounts": 70,
  "category_count": 5,
  "usage_rate": "30.0%"
}
```

### 按分类统计
```
GET /api/stats/by-category
```
**响应示例:**
```json
{
  "categories": [
    {
      "category_id": 1,
      "category_name": "Netflix",
      "total": 50,
      "used": 20,
      "unused": 30
    }
  ]
}
```

---

## 快速开始

1. 启动服务: `python main.py`
2. 访问管理界面: `http://localhost:8000/index.html`
3. 查看API文档: `http://localhost:8000/docs`
