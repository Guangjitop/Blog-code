# Implementation Plan

- [x] 1. 创建播放列表配置和扫描脚本




  - [ ] 1.1 创建 playlist.json 初始配置文件
    - 在 `Home/` 目录下创建 `playlist.json`


    - 包含当前 `musics/` 目录下已有的音乐文件
    - _Requirements: 1.1, 1.2_
  - [ ] 1.2 创建 Python 扫描脚本 generate_playlist.py
    - 实现 `scan_music_directory()` 函数扫描 musics 目录




    - 实现 `parse_filename()` 函数解析文件名提取艺术家和歌曲名
    - 实现 `generate_playlist_json()` 函数生成 JSON 文件
    - 支持格式：mp3, flac, wav, ogg, aac, m4a, webm
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. 实现前端播放器核心逻辑
  - [ ] 2.1 创建 MusicPlayer 工具函数
    - 实现 `parseTrackName(filename)` 解析文件名
    - 实现 `filterSupportedFormats(files)` 过滤支持的格式
    - 实现 `getNextIndex(current, total)` 和 `getPrevIndex(current, total)` 索引导航
    - _Requirements: 1.3, 2.5, 3.3, 3.4, 3.6_
  - [x]* 2.2 编写属性测试 - 文件名解析往返一致性

    - **Property 1: 文件名解析往返一致性**
    - **Validates: Requirements 1.3**
  - [ ]* 2.3 编写属性测试 - 格式过滤正确性
    - **Property 2: 格式过滤正确性**
    - **Validates: Requirements 1.1, 2.5**
  - [x]* 2.4 编写属性测试 - 索引导航循环正确性

    - **Property 3: 索引导航循环正确性**
    - **Validates: Requirements 3.3, 3.4, 3.6**




  - [ ] 2.5 实现播放列表加载和状态管理
    - 实现 `loadPlaylist()` 从 playlist.json 加载
    - 实现 `saveState()` 和 `restoreState()` 状态持久化

    - _Requirements: 1.1, 1.4, 6.1, 6.2_
  - [ ]* 2.6 编写属性测试 - 状态持久化往返一致性
    - **Property 4: 状态持久化往返一致性**
    - **Validates: Requirements 6.1, 6.2**


- [ ] 3. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. 更新首页 HTML 集成播放器
  - [x] 4.1 更新播放器 HTML 结构


    - 添加上一曲/下一曲按钮
    - 添加播放列表展开按钮
    - 添加播放列表面板容器
    - _Requirements: 3.3, 3.4, 4.1, 4.4_
  - [ ] 4.2 更新播放器 CSS 样式
    - 播放列表面板样式（毛玻璃效果、深色主题）
    - 当前播放曲目高亮样式
    - 控制按钮悬停效果
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 4.3 集成 JavaScript 播放器逻辑
    - 初始化 MusicPlayer 并加载播放列表
    - 绑定播放控制按钮事件
    - 实现播放列表 UI 交互
    - 处理音频播放结束自动下一曲
    - 处理错误情况（加载失败、空列表等）
    - _Requirements: 3.1, 3.2, 3.5, 4.2, 4.3, 1.4_

- [ ] 5. Final Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.
