#!/bin/bash

# YAMEYAME 프로덕션 배포 스크립트
# 이 스크립트는 CI/CD 파이프라인이나 수동 배포시 사용됩니다.

set -euo pipefail  # 엄격 모드

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 설정 변수
PROJECT_NAME="yameyame"
DEPLOY_DIR="/opt/yameyame"
BACKUP_DIR="/opt/backups/yameyame"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENVIRONMENT="${ENVIRONMENT:-production}"
DOCKER_TAG="${DOCKER_TAG:-latest}"

# 함수들
check_prerequisites() {
    log_info "사전 요구사항 확인 중..."
    
    # Docker 확인
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        exit 1
    fi
    
    # Docker Compose 확인
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        exit 1
    fi
    
    # 배포 디렉토리 확인
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        log_info "배포 디렉토리 생성: $DEPLOY_DIR"
        sudo mkdir -p "$DEPLOY_DIR"
        sudo chown $USER:$USER "$DEPLOY_DIR"
    fi
    
    # 백업 디렉토리 확인
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_info "백업 디렉토리 생성: $BACKUP_DIR"
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown $USER:$USER "$BACKUP_DIR"
    fi
    
    log_success "사전 요구사항 확인 완료"
}

backup_current_deployment() {
    log_info "현재 배포 백업 중..."
    
    if [[ -f "$DEPLOY_DIR/docker-compose.yml" ]]; then
        local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
        local backup_path="$BACKUP_DIR/backup_$backup_timestamp"
        
        mkdir -p "$backup_path"
        cp -r "$DEPLOY_DIR"/* "$backup_path/" 2>/dev/null || true
        
        # 데이터베이스 백업
        if docker ps | grep -q "${PROJECT_NAME}-db"; then
            log_info "데이터베이스 백업 중..."
            docker exec "${PROJECT_NAME}-db" pg_dump -U yameyame yameyame_db > "$backup_path/database_backup.sql"
        fi
        
        log_success "백업 완료: $backup_path"
    else
        log_warning "백업할 기존 배포가 없습니다."
    fi
}

stop_current_services() {
    log_info "기존 서비스 중지 중..."
    
    cd "$DEPLOY_DIR" 2>/dev/null || return 0
    
    if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        docker-compose down --remove-orphans || true
        log_success "기존 서비스 중지 완료"
    else
        log_warning "중지할 기존 서비스가 없습니다."
    fi
}

deploy_new_version() {
    log_info "새 버전 배포 중..."
    
    # 최신 소스 코드 가져오기 또는 Docker 이미지 사용
    if [[ -n "${CI:-}" ]]; then
        # CI 환경에서는 이미 소스코드가 준비됨
        log_info "CI 환경에서 배포 중..."
        cp -r . "$DEPLOY_DIR/"
    else
        # 수동 배포시 Git에서 최신 코드 가져오기
        log_info "Git에서 최신 코드 가져오기..."
        cd "$DEPLOY_DIR"
        git pull origin main || git clone https://github.com/username/yameyame.git .
    fi
    
    cd "$DEPLOY_DIR"
    
    # 환경 변수 파일 설정
    if [[ ! -f ".env" && -f ".env.example" ]]; then
        log_info ".env 파일 생성..."
        cp .env.example .env
        log_warning ".env 파일을 실제 값으로 수정하세요!"
    fi
    
    # Docker 이미지 업데이트
    log_info "Docker 이미지 업데이트 중..."
    docker-compose pull
    
    # 서비스 시작
    log_info "서비스 시작 중..."
    docker-compose up -d
    
    log_success "새 버전 배포 완료"
}

run_database_migrations() {
    log_info "데이터베이스 마이그레이션 실행 중..."
    
    # 데이터베이스가 준비될 때까지 대기
    log_info "데이터베이스 준비 대기 중..."
    sleep 30
    
    # 마이그레이션 실행
    if docker ps | grep -q "${PROJECT_NAME}-app"; then
        docker exec "${PROJECT_NAME}-app" npm run migrate || log_warning "마이그레이션 실패 또는 불필요"
        log_success "데이터베이스 마이그레이션 완료"
    else
        log_error "애플리케이션 컨테이너를 찾을 수 없습니다."
    fi
}

health_check() {
    log_info "헬스체크 실행 중..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log_success "헬스체크 통과 ($attempt/$max_attempts)"
            return 0
        fi
        
        log_info "헬스체크 대기 중... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    log_error "헬스체크 실패"
    return 1
}

cleanup_old_backups() {
    log_info "오래된 백업 정리 중..."
    
    # 7일 이상 된 백업 삭제
    find "$BACKUP_DIR" -type d -name "backup_*" -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    
    # Docker 정리
    docker system prune -af --volumes --filter "until=24h" > /dev/null 2>&1 || true
    
    log_success "정리 완료"
}

rollback() {
    log_error "배포 실패! 롤백 실행 중..."
    
    # 최신 백업 찾기
    local latest_backup=$(ls -t "$BACKUP_DIR" | head -n1)
    
    if [[ -n "$latest_backup" && -d "$BACKUP_DIR/$latest_backup" ]]; then
        log_info "백업에서 복원 중: $latest_backup"
        
        # 현재 서비스 중지
        cd "$DEPLOY_DIR"
        docker-compose down --remove-orphans || true
        
        # 백업 복원
        cp -r "$BACKUP_DIR/$latest_backup"/* "$DEPLOY_DIR/"
        
        # 데이터베이스 복원
        if [[ -f "$BACKUP_DIR/$latest_backup/database_backup.sql" ]]; then
            log_info "데이터베이스 복원 중..."
            docker-compose up -d postgres
            sleep 30
            docker exec -i "${PROJECT_NAME}-db" psql -U yameyame yameyame_db < "$BACKUP_DIR/$latest_backup/database_backup.sql"
        fi
        
        # 서비스 재시작
        docker-compose up -d
        
        log_success "롤백 완료"
    else
        log_error "복원할 백업을 찾을 수 없습니다."
        exit 1
    fi
}

send_notification() {
    local status=$1
    local message=$2
    
    # Slack 알림 (선택적)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 YAMEYAME 배포 $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # 이메일 알림 (선택적)
    if command -v mail &> /dev/null && [[ -n "${DEPLOY_EMAIL:-}" ]]; then
        echo "YAMEYAME 배포 $status: $message" | mail -s "배포 알림" "$DEPLOY_EMAIL" || true
    fi
}

# 메인 배포 프로세스
main() {
    log_info "YAMEYAME 프로덕션 배포 시작 ($ENVIRONMENT 환경)"
    local start_time=$(date +%s)
    
    # 트랩 설정 (에러 발생시 롤백)
    trap 'rollback; send_notification "실패" "배포 중 오류 발생"; exit 1' ERR
    
    # 배포 단계 실행
    check_prerequisites
    backup_current_deployment
    stop_current_services
    deploy_new_version
    run_database_migrations
    
    # 헬스체크
    if health_check; then
        cleanup_old_backups
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "배포 완료! (소요시간: ${duration}초)"
        send_notification "성공" "배포가 성공적으로 완료되었습니다 (${duration}초 소요)"
    else
        log_error "헬스체크 실패. 롤백합니다."
        rollback
        send_notification "실패" "헬스체크 실패로 인한 롤백"
        exit 1
    fi
}

# 스크립트 옵션 처리
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        rollback
        ;;
    health)
        health_check
        ;;
    backup)
        backup_current_deployment
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    *)
        echo "사용법: $0 {deploy|rollback|health|backup|cleanup}"
        echo ""
        echo "  deploy   - 새 버전 배포 (기본값)"
        echo "  rollback - 이전 버전으로 롤백"
        echo "  health   - 헬스체크 실행"
        echo "  backup   - 현재 상태 백업"
        echo "  cleanup  - 오래된 백업 및 이미지 정리"
        exit 1
        ;;
esac