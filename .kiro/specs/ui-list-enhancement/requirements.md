# Requirements Document

## Introduction

本功能旨在改进账号管理系统的用户界面，主要包括将"邮箱"字段标签改为"账号"以更准确反映字段用途，以及在列表项中添加图标以提升视觉美观度和用户体验。

## Glossary

- **账号列表 (Account List)**: 用户仪表板中显示所有托管账号的表格组件
- **分类列表 (Category List)**: 用户仪表板中显示所有分类的表格组件
- **列表图标 (List Icon)**: 显示在列表项左侧的小型视觉图标，用于美化界面和提供视觉提示

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望"邮箱"字段显示为"账号"，以便更准确地描述该字段的实际用途（因为不仅限于邮箱格式）。

#### Acceptance Criteria

1. WHEN 用户查看账号列表表头 THEN 系统 SHALL 显示"账号"而非"邮箱"作为列标题
2. WHEN 用户打开添加账号对话框 THEN 系统 SHALL 显示"账号"作为输入字段标签
3. WHEN 用户查看批量导入预览 THEN 系统 SHALL 使用"账号"术语描述相关字段

### Requirement 2

**User Story:** 作为用户，我希望账号列表每行左侧有图标，以便界面更美观且与分类列表风格一致。

#### Acceptance Criteria

1. WHEN 用户查看账号列表 THEN 系统 SHALL 在每行账号名称左侧显示用户图标
2. WHEN 用户查看分类列表 THEN 系统 SHALL 在每行分类名称左侧显示文件夹图标
3. WHEN 图标显示时 THEN 系统 SHALL 使用与现有UI风格一致的 lucide-react 图标库

### Requirement 3

**User Story:** 作为用户，我希望列表图标有适当的视觉样式，以便与整体界面协调。

#### Acceptance Criteria

1. WHEN 图标渲染时 THEN 系统 SHALL 使用 muted-foreground 颜色以保持视觉层次
2. WHEN 图标渲染时 THEN 系统 SHALL 使用 4x4 (h-4 w-4) 的标准尺寸
3. WHEN 图标与文本并排显示时 THEN 系统 SHALL 保持适当的间距 (gap-2)
