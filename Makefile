# ===========================================
# Blog 账号管理系统 - Makefile
# 统一部署与运维命令入口
# ===========================================
#
# 使用方法:
#   make help        - 显示所有可用命令
#   make deploy      - 一键部署 (构建+启动)
#   make up          - 启动服务
#   make down        - 停止服务
#   make logs        - 查看日志
#   make status      - 查看状态
#
# ===========================================

.PHONY: help deploy up down restart build logs status health clean dev ssl backup update

# 默认目标
.DEFAULT_GOAL := help

# 变量
DEPLOY_DIR   := deploy
COMPOSE_FILE := $(DEPLOY_DIR)/docker-compose.yml
PROD_FILE    := $(DEPLOY_DIR)/docker-compose.prod.yml
COMPOSE      := docker compose -f $(COMPOSE_FILE)
COMPOSE_PROD := docker compose -f $(COMPOSE_FILE) -f $(PROD_FILE)

# 颜色 (兼容 Windows 的 make)
# ============================================

## help: 显示所有可用命令
help:
	@echo "=========================================="
	@echo "  Blog 账号管理系统 - 命令列表"
	@echo "=========================================="
	@echo ""
	@echo "  部署命令:"
	@echo "    make deploy       一键部署"
	@echo "    make deploy-prod  生产环境部署"
	@echo "    make build        仅构建 Docker 镜像"
	@echo "    make up           启动服务"
	@echo "    make down         停止并移除所有容器"
	@echo "    make restart      重启所有服务"
	@echo "    make update       拉取最新代码并重新部署"
	@echo ""
	@echo "  运维命令:"
	@echo "    make status       查看容器运行状态"
	@echo "    make logs         查看所有服务日志"
	@echo "    make logs-back    仅查看后端日志"
	@echo "    make logs-nginx   仅查看 Nginx 日志"
	@echo "    make health       执行健康检查"
	@echo ""
	@echo "  开发命令:"
	@echo "    make dev          启动本地开发环境"
	@echo "    make dev-front    仅启动前端开发服务器"
	@echo "    make dev-back     仅启动后端开发服务器"
	@echo "    make test         运行前端测试"
	@echo ""
	@echo "  维护命令:"
	@echo "    make ssl          申请或续期 SSL 证书"
	@echo "    make backup       备份数据库"
	@echo "    make clean        清理 Docker 缓存和悬挂镜像"
	@echo "    make env          从模板创建 .env 文件"
	@echo ""
	@echo "=========================================="

# ============================================
# 部署命令
# ============================================

## deploy: 一键部署 (构建+启动)
deploy: _check-docker env
	@echo [Deploy] 构建并启动服务...
	$(COMPOSE) up -d --build
	@$(MAKE) --no-print-directory _wait
	@$(MAKE) --no-print-directory health
	@$(MAKE) --no-print-directory _show-urls

## deploy-prod: 生产环境部署 (含资源限制)
deploy-prod: _check-docker env
	@echo [Deploy] 生产环境部署...
	$(COMPOSE_PROD) up -d --build
	@$(MAKE) --no-print-directory _wait
	@$(MAKE) --no-print-directory health
	@$(MAKE) --no-print-directory _show-urls

## build: 仅构建镜像
build: _check-docker
	@echo [Build] 构建 Docker 镜像...
	$(COMPOSE) build

## up: 启动服务 (不重新构建)
up: _check-docker
	@echo [Start] 启动服务...
	$(COMPOSE) up -d
	@$(MAKE) --no-print-directory _wait
	@$(MAKE) --no-print-directory _show-urls

## down: 停止服务
down:
	@echo [Stop] 停止所有容器...
	$(COMPOSE) down

## restart: 重启服务
restart:
	@echo [Restart] 重启所有服务...
	$(COMPOSE) restart
	@$(MAKE) --no-print-directory _wait
	@$(MAKE) --no-print-directory health

## update: 拉取最新代码并重新部署
update:
	@echo [Update] 拉取最新代码...
	git pull
	@echo [Update] 重新部署...
	@$(MAKE) --no-print-directory deploy

# ============================================
# 运维命令
# ============================================

## status: 查看容器运行状态
status:
	@echo [Status] 容器运行状态:
	@$(COMPOSE) ps

## logs: 查看所有日志
logs:
	$(COMPOSE) logs -f --tail=100

## logs-back: 查看后端日志
logs-back:
	$(COMPOSE) logs -f --tail=100 backend

## logs-nginx: 查看 Nginx 日志
logs-nginx:
	$(COMPOSE) logs -f --tail=100 nginx

## health: 健康检查
health:
	@echo [Health] 执行健康检查...
	@curl -sf http://localhost:8999/docs > /dev/null 2>&1 && echo "  [OK] 后端服务正常 (port 8999)" || echo "  [FAIL] 后端服务异常"
	@curl -sf http://localhost:8998/ > /dev/null 2>&1 && echo "  [OK] 前端服务正常 (port 8998)" || echo "  [FAIL] 前端服务异常"

# ============================================
# 开发命令
# ============================================

## dev: 启动本地开发环境
dev:
	@echo [Dev] 请在两个终端中分别运行:
	@echo   终端1 (后端): make dev-back
	@echo   终端2 (前端): make dev-front

## dev-front: 启动前端开发服务器
dev-front:
	cd frontend && npm install && npm run dev

## dev-back: 启动后端开发服务器
dev-back:
	cd backend && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8999 --reload

## test: 运行前端测试
test:
	cd frontend && npm run test

# ============================================
# 维护命令
# ============================================

## ssl: 申请 SSL 证书
ssl:
	@echo [SSL] 申请 Let's Encrypt 证书...
	@if [ -f $(DEPLOY_DIR)/scripts/get-ssl-cert.sh ]; then \
		bash $(DEPLOY_DIR)/scripts/get-ssl-cert.sh; \
	else \
		echo "  请运行: sudo certbot certonly --webroot -w ./Home -d YOUR_DOMAIN"; \
	fi

## backup: 备份数据库
backup:
	@echo [Backup] 备份数据库...
	@mkdir -p backups
	@cp backend/accounts.db "backups/accounts_$$(date +%Y%m%d_%H%M%S).db" 2>/dev/null && \
		echo "  [OK] 已备份到 backups/ 目录" || \
		echo "  [WARN] 未找到数据库文件"

## clean: 清理 Docker 缓存
clean:
	@echo [Clean] 清理 Docker 悬挂镜像和缓存...
	docker image prune -f
	docker builder prune -f

## env: 创建 .env 文件
env:
	@if [ ! -f $(DEPLOY_DIR)/.env ]; then \
		cp $(DEPLOY_DIR)/.env.example $(DEPLOY_DIR)/.env; \
		echo "[Env] 已从模板创建 $(DEPLOY_DIR)/.env"; \
		echo "  请编辑 $(DEPLOY_DIR)/.env 修改配置"; \
	fi

# ============================================
# 内部目标
# ============================================

_check-docker:
	@docker info > /dev/null 2>&1 || (echo "[Error] Docker 未运行，请先启动 Docker" && exit 1)

_wait:
	@echo [Wait] 等待服务启动...
	@sleep 8

_show-urls:
	@echo "=========================================="
	@echo "  服务已启动"
	@echo "=========================================="
	@echo "  前端首页:    http://localhost:8998/"
	@echo "  管理后台:    http://localhost:8998/app/"
	@echo "  后端API:     http://localhost:8999/docs"
	@echo "  健康检查:    http://localhost:8999/docs"
	@echo "=========================================="
