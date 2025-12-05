# Requirements Document

## Introduction

本功能旨在改进用户仪表板的两个方面：
1. 修复主题切换下拉菜单的可见性问题，确保下拉菜单内容始终在页面可视区域内显示
2. 为账号列表添加多选导出功能，支持将选中的账号导出为 CSV、TXT、JSON 三种格式

## Glossary

- **主题切换组件 (ThemeToggle)**: 位于页面右上角的主题选择下拉菜单组件
- **下拉菜单 (Dropdown Menu)**: 点击触发器后展开的选项列表
- **视口 (Viewport)**: 浏览器窗口的可视区域
- **账号列表 (Account List)**: 用户仪表板中显示所有账号的表格
- **多选 (Multi-select)**: 通过复选框选择多个账号的功能
- **导出格式 (Export Format)**: 账号数据的输出格式，包括 CSV、TXT、JSON

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望主题切换下拉菜单始终在页面可视区域内显示，以便我能看到并选择所有主题选项。

#### Acceptance Criteria

1. WHEN 主题切换下拉菜单展开时 THEN 系统 SHALL 确保下拉菜单内容完全在视口内可见
2. WHEN 下拉菜单接近页面边缘时 THEN 系统 SHALL 自动调整下拉菜单的展开方向或位置
3. WHEN 下拉菜单展开时 THEN 系统 SHALL 使用足够高的 z-index 确保不被其他元素遮挡

### Requirement 2

**User Story:** 作为用户，我希望能够选择多个账号并导出为不同格式的文件，以便我能备份或在其他系统中使用这些账号数据。

#### Acceptance Criteria

1. WHEN 用户选中一个或多个账号时 THEN 系统 SHALL 显示导出按钮
2. WHEN 用户点击导出按钮时 THEN 系统 SHALL 显示格式选择菜单（CSV、TXT、JSON）
3. WHEN 用户选择 CSV 格式导出时 THEN 系统 SHALL 生成包含邮箱和密码列的 CSV 文件并触发下载
4. WHEN 用户选择 TXT 格式导出时 THEN 系统 SHALL 生成每行一个账号（格式：邮箱----密码）的文本文件并触发下载
5. WHEN 用户选择 JSON 格式导出时 THEN 系统 SHALL 生成包含账号对象数组的 JSON 文件并触发下载

### Requirement 3

**User Story:** 作为用户，我希望导出的文件包含正确且完整的账号数据，以便我能准确地使用这些数据。

#### Acceptance Criteria

1. WHEN 导出 CSV 文件时 THEN 系统 SHALL 正确处理包含逗号或引号的账号数据
2. WHEN 导出任意格式文件时 THEN 系统 SHALL 包含所有选中账号的邮箱和密码信息
3. WHEN 导出完成时 THEN 系统 SHALL 使用有意义的文件名（包含日期和账号数量）

