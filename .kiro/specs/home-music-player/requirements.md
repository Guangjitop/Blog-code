# Requirements Document

## Introduction

本功能为首页（Home/index.html）提供一个增强的音乐播放器，能够自动扫描并播放 `Home/musics` 目录下的所有音乐文件。播放器支持多种常见音乐格式（MP3、FLAC、WAV、OGG、AAC等），用户可以随时向该目录添加新音乐，播放器会自动识别并加入播放列表。

## Glossary

- **Music_Player**: 首页底部的音乐播放器组件，负责音乐的播放、暂停、切换等控制
- **Playlist**: 从 `Home/musics` 目录动态加载的音乐文件列表
- **Audio_Format**: 支持的音乐文件格式，包括 MP3、FLAC、WAV、OGG、AAC、M4A、WEBM
- **Music_Directory**: 存放音乐文件的目录路径 `Home/musics/`
- **Track_Info**: 音乐曲目信息，包含文件名、艺术家、歌曲名称等

## Requirements

### Requirement 1

**User Story:** As a 用户, I want 播放器能自动加载 musics 目录下的所有音乐文件, so that 我可以随时添加新音乐而无需修改代码。

#### Acceptance Criteria

1. WHEN Music_Player 初始化时 THEN Music_Player SHALL 扫描 Music_Directory 并加载所有支持的 Audio_Format 文件到 Playlist
2. WHEN Music_Directory 中存在新添加的音乐文件 THEN Music_Player SHALL 在刷新页面后将新文件加入 Playlist
3. WHEN 音乐文件名包含艺术家和歌曲名（格式：艺术家 - 歌曲名.格式）THEN Music_Player SHALL 解析并显示 Track_Info
4. WHEN Music_Directory 为空或不存在音乐文件 THEN Music_Player SHALL 显示"暂无音乐"提示并保持可用状态

### Requirement 2

**User Story:** As a 用户, I want 播放器支持多种音乐格式, so that 我可以播放各种来源的音乐文件。

#### Acceptance Criteria

1. WHEN 用户添加 MP3 格式文件到 Music_Directory THEN Music_Player SHALL 正确加载并播放该文件
2. WHEN 用户添加 FLAC 格式文件到 Music_Directory THEN Music_Player SHALL 正确加载并播放该文件（浏览器支持情况下）
3. WHEN 用户添加 WAV 格式文件到 Music_Directory THEN Music_Player SHALL 正确加载并播放该文件
4. WHEN 用户添加 OGG 格式文件到 Music_Directory THEN Music_Player SHALL 正确加载并播放该文件
5. WHEN 用户添加不支持的格式文件 THEN Music_Player SHALL 跳过该文件并继续加载其他文件

### Requirement 3

**User Story:** As a 用户, I want 完整的播放控制功能, so that 我可以方便地控制音乐播放。

#### Acceptance Criteria

1. WHEN 用户点击播放按钮 THEN Music_Player SHALL 开始播放当前曲目并显示暂停图标
2. WHEN 用户点击暂停按钮 THEN Music_Player SHALL 暂停播放并显示播放图标
3. WHEN 用户点击上一曲按钮 THEN Music_Player SHALL 切换到 Playlist 中的上一首曲目
4. WHEN 用户点击下一曲按钮 THEN Music_Player SHALL 切换到 Playlist 中的下一首曲目
5. WHEN 当前曲目播放结束 THEN Music_Player SHALL 自动播放 Playlist 中的下一首曲目
6. WHEN Playlist 播放到最后一首结束 THEN Music_Player SHALL 循环回到第一首继续播放

### Requirement 4

**User Story:** As a 用户, I want 查看当前播放列表, so that 我可以选择想听的歌曲。

#### Acceptance Criteria

1. WHEN 用户点击播放列表按钮 THEN Music_Player SHALL 展开显示完整的 Playlist
2. WHEN Playlist 展开时 THEN Music_Player SHALL 高亮显示当前正在播放的曲目
3. WHEN 用户点击 Playlist 中的某首曲目 THEN Music_Player SHALL 立即切换并播放该曲目
4. WHEN 用户再次点击播放列表按钮 THEN Music_Player SHALL 收起 Playlist 面板

### Requirement 5

**User Story:** As a 用户, I want 播放器界面美观且与首页风格一致, so that 整体视觉体验协调统一。

#### Acceptance Criteria

1. WHEN Music_Player 显示时 THEN Music_Player SHALL 采用与首页一致的深色主题和毛玻璃效果
2. WHEN 音乐正在播放时 THEN Music_Player SHALL 显示旋转的唱片动画效果
3. WHEN 鼠标悬停在控制按钮上 THEN Music_Player SHALL 显示高亮反馈效果
4. WHEN 显示 Track_Info 时 THEN Music_Player SHALL 以简洁方式展示艺术家和歌曲名称

### Requirement 6

**User Story:** As a 用户, I want 播放器记住我的播放状态, so that 刷新页面后可以继续之前的播放。

#### Acceptance Criteria

1. WHEN 用户切换曲目或调整音量 THEN Music_Player SHALL 将当前播放索引和音量保存到 localStorage
2. WHEN 页面重新加载 THEN Music_Player SHALL 从 localStorage 恢复上次的播放位置和音量设置
