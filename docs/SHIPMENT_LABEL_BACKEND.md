# 发货内容标签 - 后端开发指南

## 1. 数据库设计

需要新增两张表来存储分类和内容数据。

### 1.1 分类表 (`shipment_categories`)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 主键，自增 |
| name | TEXT | 分类名称 |
| description | TEXT | 分类描述 |
| owner_key | TEXT | 所属用户的授权码 |
| created_at | TEXT | 创建时间 (ISO格式) |

### 1.2 内容表 (`shipment_contents`)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 主键，自增 |
| content | TEXT | 内容文本 (如快递单号) |
| category_id | INTEGER | 关联分类ID (外键) |
| owner_key | TEXT | 所属用户的授权码 |
| is_used | INTEGER | 是否已使用 (0/1) |
| created_at | TEXT | 创建时间 |
| used_at | TEXT | 使用时间 |

---

## 2. 核心逻辑实现

### 2.1 数据库初始化
在 `init_db()` 函数中添加新表的创建逻辑。

```python
# 创建发货标签分类表
cursor.execute('''
    CREATE TABLE IF NOT EXISTS shipment_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        owner_key TEXT,
        created_at TEXT NOT NULL
    )
''')

# 创建发货标签内容表
cursor.execute('''
    CREATE TABLE IF NOT EXISTS shipment_contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category_id INTEGER,
        owner_key TEXT,
        is_used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        used_at TEXT,
        FOREIGN KEY (category_id) REFERENCES shipment_categories(id)
    )
''')
```

### 2.2 API 路由实现
在 `main.py` 中添加新的路由组 `shipment`。

#### 关键函数
- `get_shipment_content(key, category_id)`: 获取并锁定一个未使用内容。
  - 需要使用事务确保并发安全。
  - 逻辑：`SELECT id, content FROM shipment_contents WHERE is_used=0 ... LIMIT 1` -> `UPDATE ... SET is_used=1`。

- `batch_add_shipment_contents(key, category_id, contents)`: 批量添加。
  - 循环插入，注意去重（可选）。

---

## 3. 注意事项
1. **权限控制**: 所有操作必须校验 `owner_key`，确保用户只能操作自己的数据。
2. **并发处理**: 获取内容时，避免多个请求获取到同一个内容。
3. **数据校验**: 添加内容时，检查内容是否为空。
