# Requirements Document

## Introduction

本需求文档旨在解决从外部网络访问音乐播放器时，无法加载在线音乐（热门歌曲索引）的超时问题。当前系统在同一服务器（107.174.140.100）上部署了主应用和音乐API服务（端口3000），但后端配置错误地使用外部IP地址访问本地音乐API服务，导致从其他电脑访问时出现"获取热门歌曲失败: TimeoutError: signal timed out"错误。正确的做法是后端应该使用localhost或127.0.0.1访问同服务器上的音乐API。

## Glossary

- **Music API Service**: 部署在同一服务器端口3000的网易云音乐API代理服务
- **Backend Proxy**: 主应用后端的音乐API代理接口 (/api/music/*)
- **Frontend Client**: 用户浏览器中运行的前端应用
- **Localhost**: 本地回环地址（127.0.0.1），用于访问同一服务器上的服务
- **Internal Network**: Docker容器内部网络，使用host.docker.internal访问宿主机服务
- **External IP**: 服务器的公网IP地址（107.174.140.100）
- **CORS**: 跨域资源共享（Cross-Origin Resource Sharing）机制

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望从任何网络环境访问音乐播放器时都能成功加载在线音乐，以便我可以正常使用音乐播放功能。

#### Acceptance Criteria

1. WHEN the Backend Proxy needs to access Music API Service THEN the system SHALL first attempt the local endpoint (localhost:3000 or host.docker.internal:3000)
2. WHEN the local endpoint fails or times out THEN the system SHALL automatically fallback to the external IP endpoint (http://107.174.140.100:3000/)
3. WHEN a user accesses the music player from an external network THEN the system SHALL successfully load the hot songs playlist within 10 seconds
4. WHEN the Music API Service responds THEN the Backend Proxy SHALL forward the response to the Frontend Client with appropriate CORS headers
5. WHEN both endpoints fail THEN the system SHALL return a clear error message indicating the music service is unavailable

### Requirement 2

**User Story:** 作为系统管理员，我希望能够诊断音乐API连接问题，以便快速定位和解决服务故障。

#### Acceptance Criteria

1. WHEN the Backend Proxy attempts to connect to Music API Service THEN the system SHALL log the connection attempt with timestamp and endpoint URL
2. WHEN a connection fails THEN the system SHALL log the failure reason (timeout, connection refused, etc.)
3. WHEN the system switches to a fallback endpoint THEN the system SHALL log the fallback action
4. WHEN all endpoints fail THEN the system SHALL log a summary of all attempted connections
5. WHEN the Frontend Client receives an error THEN the error message SHALL include actionable information for troubleshooting

### Requirement 3

**User Story:** 作为开发者，我希望系统能够自动处理网络不稳定情况，以便提高服务的可用性和用户体验。

#### Acceptance Criteria

1. WHEN the Backend Proxy is configured THEN the system SHALL prioritize localhost endpoints over external IP addresses for same-server services
2. WHEN multiple API endpoints are configured THEN the system SHALL try each endpoint in sequence until one succeeds
3. WHEN an endpoint fails THEN the system SHALL not retry the same endpoint within the same request
4. WHEN the system uses Docker networking THEN the Backend Proxy SHALL correctly resolve host.docker.internal to access host machine services
5. WHEN the Backend Proxy detects a connection error THEN the system SHALL immediately try the next endpoint without waiting for full timeout

### Requirement 4

**User Story:** 作为用户，我希望在音乐服务暂时不可用时仍能使用本地音乐功能，以便不影响基本的音乐播放体验。

#### Acceptance Criteria

1. WHEN online music loading fails THEN the Frontend Client SHALL automatically switch to the local music tab
2. WHEN the user manually switches to online music tab THEN the system SHALL display the last error message
3. WHEN the Frontend Client detects a timeout THEN the system SHALL provide a retry button for the user
4. WHEN local music is available THEN the system SHALL prioritize showing local music over error messages
5. WHEN no music is available THEN the system SHALL display helpful guidance for adding music

### Requirement 5

**User Story:** 作为系统管理员，我希望能够配置音乐API的端点和超时策略，以便根据部署环境（Docker或直接部署）优化配置。

#### Acceptance Criteria

1. WHEN the Backend Proxy is configured THEN the system SHALL support configuring multiple Music API Service endpoints via environment variables as a comma-separated list
2. WHEN the system runs in Docker THEN the default configuration SHALL include both host.docker.internal:3000 and http://107.174.140.100:3000/ in that order
3. WHEN the system runs directly on the host THEN the default configuration SHALL include both localhost:3000 and http://107.174.140.100:3000/ in that order
4. WHEN endpoints are configured THEN the system SHALL try them in the order specified until one succeeds
5. WHEN the configuration is updated THEN the system SHALL apply the new values without requiring code changes
