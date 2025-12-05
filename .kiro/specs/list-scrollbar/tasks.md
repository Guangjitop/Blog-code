# Implementation Plan

- [x] 1. 创建 DropdownMenu 组件


  - [x] 1.1 安装 @radix-ui/react-dropdown-menu 依赖





    - 运行 npm install @radix-ui/react-dropdown-menu
    - _Requirements: 6.1, 6.4, 7.1_
  - [x] 1.2 创建 dropdown-menu.tsx 组件文件


    - 在 frontend/src/components/ui/ 目录下创建组件
    - 导出 DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
    - 使用与现有UI一致的样式（tailwind classes）
    - _Requirements: 6.1, 6.4, 7.1_

- [x] 2. 为账号列表添加滚动条和下拉菜单


  - [x] 2.1 为账号列表表格添加滚动容器


    - 在 CardContent 中添加 max-height 和 overflow-y-auto
    - 设置表头 sticky 定位
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 2.2 将账号列表操作按钮改为下拉菜单

    - 导入 DropdownMenu 组件和 MoreHorizontal 图标
    - 将编辑、禁用/启用、重置、删除按钮整合到下拉菜单
    - 保持原有的删除确认逻辑
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 2.3 编写账号操作下拉菜单的属性测试


    - **Property 1: 下拉菜单操作功能一致性**
    - **Validates: Requirements 6.3**

- [x] 3. 为分类管理添加滚动条和下拉菜单


  - [x] 3.1 为分类列表表格添加滚动容器


    - 在 CardContent 中添加 max-height 和 overflow-y-auto
    - 设置表头 sticky 定位
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.2 将分类列表操作按钮改为下拉菜单

    - 将删除按钮整合到下拉菜单
    - 保持原有的删除确认逻辑
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 3.3 编写分类操作下拉菜单的属性测试

    - **Property 2: 分类下拉菜单操作功能一致性**
    - **Validates: Requirements 7.3**

- [x] 4. 为获取账号Tab添加滚动条


  - [x] 4.1 为获取账号内容区域添加滚动容器


    - 在 CardContent 中添加 max-height 和 overflow-y-auto
    - _Requirements: 3.1, 3.2_

- [x] 5. 为API文档Tab添加滚动条


  - [x] 5.1 为API文档内容区域添加滚动容器


    - 在 CardContent 中添加 max-height 和 overflow-y-auto
    - _Requirements: 4.1, 4.2_



- [x] 6. 添加滚动条样式优化

  - [x] 6.1 添加自定义滚动条CSS样式

    - 在全局CSS或组件中添加滚动条样式
    - 确保与主题一致（支持深色/浅色模式）
    - 添加hover状态视觉反馈
    - _Requirements: 5.1, 5.2, 5.3_


- [x] 7. Checkpoint - 确保所有功能正常




  - Ensure all tests pass, ask the user if questions arise.

