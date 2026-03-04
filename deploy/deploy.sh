#!/bin/bash
# ===========================================
# 统一部署脚本 - Linux / macOS
# 一个脚本完成所有部署工作
# ===========================================
#
# 用法:
#   ./deploy/deploy.sh                  # 交互式部署
#   ./deploy/deploy.sh --auto           # 全自动部署 (使用默认配置)
#   ./deploy/deploy.sh --domain xxx     # 指定域名
#   ./deploy/deploy.sh --mode direct    # 指定部署模式 (direct|proxy)
#   ./deploy/deploy.sh --no-ssl         # 跳过 SSL 证书
#   ./deploy/deploy.sh --status         # 查看服务状态
#   ./deploy/deploy.sh --stop           # 停止服务
#   ./deploy/deploy.sh --restart        # 重启服务
#   ./deploy/deploy.sh --logs           # 查看日志
#   ./deploy/deploy.sh --health         # 健康检查
#   ./deploy/deploy.sh --backup         # 备份数据库
#   ./deploy/deploy.sh --update         # 拉取代码并重新部署
#
# ===========================================

set -e

# ============================================
# 颜色与常量
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"
SSL_DIR="$DEPLOY_DIR/ssl"
BACKUP_DIR="$PROJECT_ROOT/backups"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
COMPOSE_PROD="$DEPLOY_DIR/docker-compose.prod.yml"

# 默认配置
DOMAIN=""
EMAIL=""
DEPLOY_MODE=""      # direct | proxy
SKIP_SSL=false
AUTO_MODE=false
COMPOSE_CMD=""

# ============================================
# 工具函数
# ============================================
log_info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()    { echo -e "\n${CYAN}${BOLD}=== $* ===${NC}"; }
log_success() { echo -e "${GREEN}${BOLD}[OK]${NC} $*"; }

confirm() {
    if [ "$AUTO_MODE" = true ]; then return 0; fi
    local msg="${1:-是否继续？}"
    read -p "$msg (y/n) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# 检测 docker compose 命令
detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        log_error "未安装 Docker Compose"
        echo "  安装方法: sudo apt install docker-compose-plugin -y"
        exit 1
    fi
}

compose() {
    $COMPOSE_CMD -f "$COMPOSE_FILE" "$@"
}

compose_prod() {
    $COMPOSE_CMD -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" "$@"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if command -v ss >/dev/null 2>&1; then
        ss -tuln 2>/dev/null | grep -q ":${port} " && return 1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln 2>/dev/null | grep -q ":${port} " && return 1
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i :"$port" >/dev/null 2>&1 && return 1
    fi
    return 0
}

# ============================================
# 子命令: 状态/停止/重启/日志/健康检查/备份
# ============================================
cmd_status() {
    detect_compose
    log_step "容器运行状态"
    compose ps
}

cmd_stop() {
    detect_compose
    log_step "停止所有服务"
    compose down
    log_success "服务已停止"
}

cmd_restart() {
    detect_compose
    log_step "重启服务"
    compose restart
    sleep 5
    cmd_health
}

cmd_logs() {
    detect_compose
    compose logs -f --tail=100
}

cmd_health() {
    log_step "健康检查"
    local ok=true

    if curl -sf http://localhost:8999/docs >/dev/null 2>&1; then
        log_success "后端服务正常 (port 8999)"
    else
        log_error "后端服务异常 (port 8999)"
        ok=false
    fi

    if curl -sf http://localhost:8998/ >/dev/null 2>&1; then
        log_success "前端/Nginx 正常 (port 8998)"
    else
        log_error "前端/Nginx 异常 (port 8998)"
        ok=false
    fi

    if [ "$ok" = false ]; then
        echo ""
        log_warn "部分服务异常，查看日志: $COMPOSE_CMD -f $COMPOSE_FILE logs"
    fi
}

cmd_backup() {
    log_step "备份数据库"
    mkdir -p "$BACKUP_DIR"
    local db_file="$PROJECT_ROOT/backend/accounts.db"
    if [ -f "$db_file" ]; then
        local backup_name="accounts_$(date +%Y%m%d_%H%M%S).db"
        cp "$db_file" "$BACKUP_DIR/$backup_name"
        log_success "已备份到 backups/$backup_name"
    else
        log_warn "未找到数据库文件: $db_file"
    fi
}

cmd_update() {
    log_step "更新部署"
    cd "$PROJECT_ROOT"
    log_info "拉取最新代码..."
    git pull
    log_info "重新部署..."
    cmd_deploy
}

# ============================================
# 核心: 部署流程
# ============================================
cmd_deploy() {
    local total_steps=6
    local step=0

    # ------------------------------------------
    # Step 1: 系统环境检查
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: 检查系统环境"

    # Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_error "未安装 Docker"
        echo "  安装: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log_success "Docker 已安装"

    # Docker 服务
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker 服务未运行"
        echo "  启动: sudo systemctl start docker"
        exit 1
    fi
    log_success "Docker 服务正在运行"

    # Docker Compose
    detect_compose
    log_success "Docker Compose 可用 ($COMPOSE_CMD)"

    # ------------------------------------------
    # Step 2: 端口检测 & 模式选择
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: 端口检测与模式选择"

    local port80_free=true
    local port443_free=true

    if ! check_port 80; then
        port80_free=false
        log_warn "端口 80 被占用"
    else
        log_success "端口 80 可用"
    fi

    if ! check_port 443; then
        port443_free=false
        log_warn "端口 443 被占用"
    else
        log_success "端口 443 可用"
    fi

    # 自动选择或用户指定模式
    if [ -z "$DEPLOY_MODE" ]; then
        if [ "$port80_free" = true ] && [ "$port443_free" = true ]; then
            DEPLOY_MODE="direct"
            echo ""
            log_info "80/443 端口空闲，推荐方案 A: Docker 直接监听 80/443"
        else
            DEPLOY_MODE="proxy"
            echo ""
            log_info "80/443 端口被占用，自动选择方案 B: 通过宿主机 Nginx 反向代理"
        fi
    fi

    echo ""
    echo -e "  ${BOLD}当前部署模式: $([ "$DEPLOY_MODE" = "direct" ] && echo "方案A - 直接模式" || echo "方案B - 反向代理模式")${NC}"
    echo ""
    echo "  方案A (direct): Docker 容器直接监听 80/443，适合干净服务器"
    echo "  方案B (proxy):  Docker 容器监听 8998/8999，由宿主机 Nginx 代理"
    echo ""

    if ! confirm "使用当前模式继续？"; then
        if [ "$DEPLOY_MODE" = "direct" ]; then
            DEPLOY_MODE="proxy"
        else
            DEPLOY_MODE="direct"
        fi
        log_info "已切换到: $([ "$DEPLOY_MODE" = "direct" ] && echo "方案A" || echo "方案B")"
    fi

    # ------------------------------------------
    # Step 3: 配置环境
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: 配置环境"

    cd "$DEPLOY_DIR"

    # 创建 .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "已从模板创建 .env"
        else
            log_warn ".env.example 不存在，创建最小配置"
            cat > .env <<EOF
DOMAIN=${DOMAIN:-localhost}
APP_PORT=80
APP_SSL_PORT=443
ADMIN_PASSWORD=admin121
SSL_ENABLED=false
EOF
        fi
    else
        log_success ".env 已存在"
    fi

    # 域名配置
    if [ -n "$DOMAIN" ]; then
        sed -i.bak "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env 2>/dev/null || true
        rm -f .env.bak
        log_info "域名已设置为: $DOMAIN"
    else
        DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | cut -d= -f2 || echo "localhost")
    fi

    # 端口配置
    if [ "$DEPLOY_MODE" = "proxy" ]; then
        sed -i.bak 's/^APP_PORT=.*/APP_PORT=8998/' .env 2>/dev/null || true
        rm -f .env.bak
        log_info "APP_PORT 已设为 8998 (代理模式)"
    fi

    # 确保必要目录
    mkdir -p "$SSL_DIR"
    log_success "环境配置完成"

    # ------------------------------------------
    # Step 4: SSL 证书
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: SSL 证书"

    if [ "$SKIP_SSL" = true ]; then
        log_info "已跳过 SSL 配置 (--no-ssl)"
    elif [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
        log_success "SSL 证书已存在"
    elif [ "$DOMAIN" != "localhost" ] && command -v certbot >/dev/null 2>&1; then
        if [ -z "$EMAIL" ]; then
            if [ "$AUTO_MODE" = false ]; then
                read -p "输入邮箱用于 SSL 证书申请 (留空跳过): " EMAIL
            fi
        fi
        if [ -n "$EMAIL" ]; then
            log_info "申请 Let's Encrypt 证书..."
            if [ "$DEPLOY_MODE" = "proxy" ]; then
                sudo certbot certonly --webroot \
                    -w "$PROJECT_ROOT/Home" \
                    -d "$DOMAIN" \
                    --email "$EMAIL" \
                    --agree-tos --non-interactive 2>&1 && \
                    log_success "证书申请成功" || \
                    log_warn "证书申请失败，可稍后手动申请"
            else
                log_info "方案A: 将在服务启动后申请证书"
            fi
        else
            log_info "未提供邮箱，跳过 SSL 证书申请"
        fi
    else
        log_info "跳过 SSL (本地环境或未安装 certbot)"
        if [ "$DOMAIN" != "localhost" ]; then
            echo "  安装 certbot: sudo apt install certbot -y"
            echo "  手动申请: sudo certbot certonly --webroot -w ./Home -d $DOMAIN"
        fi
    fi

    # ------------------------------------------
    # Step 5: 构建并启动
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: 构建并启动服务"

    cd "$DEPLOY_DIR"
    log_info "停止旧容器..."
    compose down 2>/dev/null || true

    log_info "构建并启动... (首次可能需要 3-5 分钟)"
    if [ "$DEPLOY_MODE" = "direct" ]; then
        compose_prod up -d --build
    else
        compose up -d --build
    fi

    if [ $? -ne 0 ]; then
        log_error "启动失败，查看日志:"
        compose logs --tail=30
        exit 1
    fi
    log_success "容器已启动"

    log_info "等待服务就绪..."
    sleep 8

    # ------------------------------------------
    # Step 6: 验证
    # ------------------------------------------
    step=$((step + 1))
    log_step "步骤 $step/$total_steps: 验证部署"

    compose ps
    echo ""
    cmd_health

    # ------------------------------------------
    # 部署完成
    # ------------------------------------------
    echo ""
    echo -e "${GREEN}${BOLD}=========================================="
    echo "  部署完成!"
    echo "==========================================${NC}"
    echo ""
    echo -e "${BOLD}部署信息:${NC}"
    echo "  模式: $([ "$DEPLOY_MODE" = "direct" ] && echo "方案A (直接模式 80/443)" || echo "方案B (反向代理 8998/8999)")"
    echo "  域名: $DOMAIN"
    echo ""
    echo -e "${BOLD}访问地址:${NC}"
    if [ "$DEPLOY_MODE" = "direct" ]; then
        echo "  前端:   http://$DOMAIN/"
        echo "  后台:   http://$DOMAIN/app/"
        echo "  API:    http://$DOMAIN/docs"
    else
        echo "  前端:   http://localhost:8998/"
        echo "  后台:   http://localhost:8998/app/"
        echo "  API:    http://localhost:8999/docs"
    fi
    echo ""
    echo -e "${BOLD}常用命令:${NC}"
    echo "  查看状态: $0 --status"
    echo "  查看日志: $0 --logs"
    echo "  健康检查: $0 --health"
    echo "  停止服务: $0 --stop"
    echo "  重启服务: $0 --restart"
    echo "  备份数据: $0 --backup"
    echo "  更新部署: $0 --update"
    echo ""

    if [ "$DEPLOY_MODE" = "proxy" ]; then
        echo -e "${YELLOW}${BOLD}[重要] 方案B 额外步骤:${NC}"
        echo "  需要配置宿主机 Nginx 将域名反向代理到 localhost:8998"
        echo "  参考配置: deploy/nginx/host-nginx-proxy.conf.example"
        echo ""
        echo "  1. sudo cp deploy/nginx/host-nginx-proxy.conf.example /etc/nginx/conf.d/$DOMAIN.conf"
        echo "  2. sudo nginx -t"
        echo "  3. sudo systemctl reload nginx"
        echo ""
    fi
}

# ============================================
# 参数解析
# ============================================
ACTION="deploy"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --auto)       AUTO_MODE=true; shift ;;
        --domain)     DOMAIN="$2"; shift 2 ;;
        --email)      EMAIL="$2"; shift 2 ;;
        --mode)       DEPLOY_MODE="$2"; shift 2 ;;
        --no-ssl)     SKIP_SSL=true; shift ;;
        --status)     ACTION="status"; shift ;;
        --stop)       ACTION="stop"; shift ;;
        --restart)    ACTION="restart"; shift ;;
        --logs)       ACTION="logs"; shift ;;
        --health)     ACTION="health"; shift ;;
        --backup)     ACTION="backup"; shift ;;
        --update)     ACTION="update"; shift ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "部署选项:"
            echo "  --auto          全自动部署 (使用默认配置)"
            echo "  --domain NAME   指定域名"
            echo "  --email ADDR    指定邮箱 (用于 SSL)"
            echo "  --mode MODE     部署模式: direct | proxy"
            echo "  --no-ssl        跳过 SSL 证书"
            echo ""
            echo "运维命令:"
            echo "  --status        查看服务状态"
            echo "  --stop          停止服务"
            echo "  --restart       重启服务"
            echo "  --logs          查看日志"
            echo "  --health        健康检查"
            echo "  --backup        备份数据库"
            echo "  --update        拉取代码并重新部署"
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            echo "使用 $0 --help 查看帮助"
            exit 1
            ;;
    esac
done

# ============================================
# 执行
# ============================================
case "$ACTION" in
    deploy)  cmd_deploy ;;
    status)  detect_compose; cmd_status ;;
    stop)    detect_compose; cmd_stop ;;
    restart) detect_compose; cmd_restart ;;
    logs)    detect_compose; cmd_logs ;;
    health)  cmd_health ;;
    backup)  cmd_backup ;;
    update)  detect_compose; cmd_update ;;
esac
