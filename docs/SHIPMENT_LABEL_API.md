# 发货内容标签 API 文档

> 基础URL: `http://localhost:8000`

---

## 1. 标签分类管理

### 获取所有分类
```
GET /api/shipment/categories
```
**响应示例:**
```json
[
  {
    "id": 1,
    "name": "快递单号",
    "description": "用于存储快递单号",
    "content_count": 150,
    "created_at": "2025-01-27T10:00:00"
  }
]
```

### 添加分类
```
GET /api/shipment/categories/add?name=分类名&description=描述
```
| 参数 | 必填 | 说明 |
|------|------|------|
| name | 是 | 分类名称 |
| description | 否 | 分类描述 |

### 更新分类
```
GET /api/shipment/categories/update?id=1&name=新名称&description=新描述
```

### 删除分类
```
GET /api/shipment/categories/delete?id=1
```
> 注意：删除分类会将该分类下的所有内容标记为"未分类"。

---

## 2. 内容管理

### 获取内容列表
```
GET /api/shipment/contents
GET /api/shipment/contents?category_id=1  # 按分类筛选
GET /api/shipment/contents?is_used=false  # 按使用状态筛选
```

### 添加单个内容
```
GET /api/shipment/contents/add?content=内容文本&category_id=1
```

### 批量添加内容
```
POST /api/shipment/contents/batch-add
```
**请求体:**
```json
{
  "key": "user-auth-key",
  "category_id": 1,
  "contents": [
    "内容1",
    "内容2",
    "内容3"
  ]
}
```

### 删除内容
```
GET /api/shipment/contents/delete?id=1
```

### 重置内容状态
```
GET /api/shipment/contents/reset?id=1
```

---

## 3. 获取/使用内容 (核心接口)

### 获取并标记为已使用
```
GET /api/shipment/get
GET /api/shipment/get?category_id=1
```
**功能描述:**
随机获取一个该分类下(或任意分类下)未使用的内容，并将其标记为"已使用"。

**响应 (纯文本):**
```
内容文本
```
如果无可用内容，返回 404 错误。

---

## 4. 统计信息

### 获取统计概览
```
GET /api/shipment/stats
```
**响应示例:**
```json
{
  "total_contents": 1000,
  "used_contents": 200,
  "unused_contents": 800,
  "category_stats": [
    {
      "category_id": 1,
      "category_name": "快递单号",
      "total": 500,
      "used": 100,
      "unused": 400
    }
  ]
}
```
