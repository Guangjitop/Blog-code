# 发货内容标签 - 前端开发指南

## 1. 页面结构

在 `UserDashboard.tsx` 中新增一个 Tab 页签 "发货标签"。

### 1.1 组件层级
- **Tabs**: 增加 `value="shipment"`
- **TabsContent**: `value="shipment"`
  - **StatsOverview**: 复用或新建统计组件
  - **Toolbar**:
    - 筛选器 (分类、状态)
    - 操作按钮 (添加内容、批量导入、分类管理)
  - **ContentTable**: 内容列表表格
  - **CategoryManager**: 分类管理弹窗

---

## 2. 新增状态管理

```typescript
// 发货标签相关状态
const [shipmentStats, setShipmentStats] = useState<ShipmentStats>(...)
const [shipmentContents, setShipmentContents] = useState<ShipmentContent[]>([])
const [shipmentCategories, setShipmentCategories] = useState<ShipmentCategory[]>([])

// 弹窗状态
const [isAddShipmentContentOpen, setIsAddShipmentContentOpen] = useState(false)
const [isShipmentCategoryManagerOpen, setIsShipmentCategoryManagerOpen] = useState(false)
```

---

## 3. 关键功能实现

### 3.1 分类管理
- 使用 `Dialog` 组件展示分类列表。
- 在弹窗内提供"添加分类"的输入框和按钮。
- 列表项支持"编辑"和"删除"操作。

### 3.2 内容列表
- 使用 `Table` 组件展示。
- 列定义：内容、分类、状态、创建时间、使用时间、操作。
- 操作列：删除、重置状态。

### 3.3 批量导入
- 复用现有的批量导入逻辑，调整 API 端点为 `/api/shipment/contents/batch-add`。
- 支持文本粘贴和文件导入。

### 3.4 获取内容 (模拟用户端)
- 提供一个"测试获取"按钮，调用 `/api/shipment/get` 接口，展示获取到的内容，并刷新列表状态。

---

## 4. API 调用封装
在 `fetchData` 中增加并发请求：
```typescript
const [shipmentStatsRes, shipmentContentsRes, shipmentCatsRes] = await Promise.all([
  api.get("/api/shipment/stats", { params: { key } }),
  api.get("/api/shipment/contents", { params: { key } }),
  api.get("/api/shipment/categories", { params: { key } })
])
```
