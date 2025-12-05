# Implementation Plan

- [x] 1. 创建部署目录结构和基础配置




  - [x] 1.1 创建 `deploy/` 目录和子目录结构


    - 创建 `deploy/nginx/conf.d/` 目录
    - 创建 `deploy/scripts/` 目录


    - _Requirements: 2.1, 3.1, 3.2, 3.3_







  - [ ] 1.2 创建环境变量模板文件 `.env.example`
    - 定义 DOMAIN、APP_PORT、BACKEND_PORT、SSL_ENABLED 变量
    - 添加注释说明每个变量的用途


    - _Requirements: 2.4_






- [ ] 2. 创建Docker镜像配置
  - [x] 2.1 创建前端Dockerfile (`deploy/Dockerfile.frontend`)

    - 使用多阶段构建：Node构建 + Nginx运行


    - 配置构建参数支持环境变量
    - _Requirements: 2.3_



  - [ ] 2.2 创建后端Dockerfile (`deploy/Dockerfile.backend`)
    - 基于Python镜像


    - 安装依赖并配置启动命令
    - _Requirements: 2.2_

- [ ] 3. 创建Nginx配置
  - [x] 3.1 创建Nginx主配置 (`deploy/nginx/nginx.conf`)


    - 配置worker进程和连接数
    - 配置日志格式
    - _Requirements: 4.3_


  - [-] 3.2 创建站点配置 (`deploy/nginx/conf.d/default.conf`)

    - 配置欢迎页路由 (/)
    - 配置前端应用路由 (/app/)
    - 配置API代理 (/api/)

    - _Requirements: 1.2, 4.3_


- [ ] 4. 创建Docker Compose配置
  - [ ] 4.1 创建主编排文件 (`deploy/docker-compose.yml`)
    - 定义nginx、backend服务
    - 配置网络和数据卷
    - 配置健康检查
    - _Requirements: 2.1, 2.2_



  - [ ] 4.2 创建生产环境覆盖配置 (`deploy/docker-compose.prod.yml`)
    - 配置生产环境优化
    - 配置SSL支持（可选）


    - _Requirements: 4.2, 4.4_

- [ ] 5. 更新欢迎页配置
  - [ ] 5.1 修改 `Home/index.html` 支持动态URL配置
    - 添加配置脚本读取域名设置



    - 更新"托管商城"链接指向 `/app/`

    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 5.2 编写URL配置属性测试
    - **Property 1: URL Configuration Consistency**
    - **Validates: Requirements 1.3, 1.4, 2.4**

- [ ] 6. 创建跨平台部署脚本
  - [ ] 6.1 创建Linux/macOS脚本
    - `deploy/scripts/start.sh` - 启动所有服务
    - `deploy/scripts/stop.sh` - 停止所有服务
    - `deploy/scripts/logs.sh` - 查看日志
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ] 6.2 创建Windows脚本
    - `deploy/scripts/start.cmd` - 启动所有服务
    - `deploy/scripts/stop.cmd` - 停止所有服务
    - `deploy/scripts/logs.cmd` - 查看日志
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 7. 创建部署文档
  - [ ] 7.1 创建 `deploy/README.md` 部署指南
    - 快速开始说明
    - 各操作系统部署步骤
    - 环境变量配置说明
    - 常见问题解答
    - _Requirements: 3.4_

- [ ] 8. Checkpoint - 验证配置完整性
  - Ensure all tests pass, ask the user if questions arise.
