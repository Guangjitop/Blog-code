# Implementation Plan

- [x] 1. 修复主题切换下拉菜单可见性问题



  - [x] 1.1 重构 ThemeToggle 组件使用 Radix DropdownMenu


    - 导入 DropdownMenu 组件
    - 使用 collisionPadding 属性确保与视口边缘保持距离
    - 设置 side="bottom" align="end" 作为默认展开方向
    - 移除自定义的 isOpen 状态和点击外部关闭逻辑
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 实现账号导出工具函数



  - [x] 2.1 创建 export-utils.ts 文件

    - 在 frontend/src/lib/ 目录下创建文件
    - 实现 ExportAccount 接口定义
    - _Requirements: 2.3, 2.4, 2.5_
  - [x] 2.2 实现 CSV 导出函数

    - 实现 exportToCSV 函数
    - 处理逗号、引号、换行符的转义
    - 添加 CSV 头部行
    - _Requirements: 2.3, 3.1_
  - [ ]* 2.3 编写 CSV 导出属性测试
    - **Property 3: CSV 特殊字符转义正确性**
    - **Validates: Requirements 2.3, 3.1**
  - [x] 2.4 实现 TXT 导出函数

    - 实现 exportToTXT 函数
    - 使用 "邮箱----密码" 格式
    - _Requirements: 2.4_
  - [ ]* 2.5 编写 TXT 导出属性测试
    - **Property 4: TXT 格式一致性**
    - **Validates: Requirements 2.4, 3.2**
  - [x] 2.6 实现 JSON 导出函数

    - 实现 exportToJSON 函数
    - 输出格式化的 JSON 数组
    - _Requirements: 2.5_
  - [ ]* 2.7 编写 JSON 导出属性测试
    - **Property 2: 导出数据 Round-Trip 一致性**
    - **Validates: Requirements 2.5, 3.2**
  - [x] 2.8 实现文件下载和文件名生成函数

    - 实现 downloadFile 函数触发浏览器下载
    - 实现 generateFilename 函数生成包含日期和数量的文件名
    - _Requirements: 3.3_
  - [ ]* 2.9 编写文件名生成属性测试
    - **Property 5: 文件名格式正确性**
    - **Validates: Requirements 3.3**

- [x] 3. 在账号列表中添加导出功能


  - [x] 3.1 添加导出按钮和格式选择菜单


    - 在 selectedAccountIds.length > 0 时显示导出按钮
    - 使用 DropdownMenu 显示 CSV、TXT、JSON 三个选项
    - 导入 Download 图标
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 实现导出处理函数

    - 创建 handleExport 函数
    - 根据选中的账号 ID 获取账号数据
    - 调用对应格式的导出函数
    - 触发文件下载
    - _Requirements: 2.3, 2.4, 2.5, 3.2_

- [-] 4. Checkpoint - 确保所有功能正常

  - Ensure all tests pass, ask the user if questions arise.

