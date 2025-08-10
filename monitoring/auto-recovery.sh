#!/bin/bash

# YAMEYAME 모니터링 자동 복구 스크립트 (Bash 버전)
# 모니터링 서비스 상태를 확인하고 자동으로 복구합니다

set -e

# 설정
MONITORING_DIR="/c/Users/taejo/yameyame/monitoring"
BACKEND_API_URL="http://localhost:3000/api/health"
MONITORING_URL="http://localhost:9999/health"
LOG_FILE="$MONITORING_DIR/auto-recovery.log"
PORT=${PORT:-9999}
CHECK_INTERVAL=${CHECK_INTERVAL:-30}

# 로그 함수
log() {
    local level=${2:-INFO}
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_entry="[$timestamp] [$level] $message"
    
    # 색상 설정
    case $level in
        "ERROR") echo -e "\e[31m$log_entry\e[0m" ;;
        "WARN") echo -e "\e[33m$log_entry\e[0m" ;;
        "SUCCESS") echo -e "\e[32m$log_entry\e[0m" ;;
        *) echo "$log_entry" ;;
    esac
    
    # 로그 파일에 기록
    echo "$log_entry" >> "$LOG_FILE"
}

# 서비스 헬스체크
check_service_health() {
    local url="$1"
    local service_name="$2"
    
    if curl -s -f --connect-timeout 10 "$url" > /dev/null 2>&1; then
        log "✅ $service_name 정상 작동" "SUCCESS"
        return 0
    else
        log "❌ $service_name 응답 없음" "ERROR"
        return 1
    fi
}

# 포트 확인
check_port() {
    local port="$1"
    if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN" || ss -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        return 0
    else
        return 1
    fi
}

# 모니터링 서비스 시작
start_monitoring_service() {
    log "🚀 모니터링 서비스 복구 시작" "INFO"
    
    cd "$MONITORING_DIR"
    
    # 의존성 확인
    if [ ! -d "node_modules" ]; then
        log "📦 의존성 설치 중..." "INFO"
        npm install --silent
        if [ $? -ne 0 ]; then
            log "❌ 의존성 설치 실패" "ERROR"
            return 1
        fi
    fi
    
    # 필요한 디렉토리 생성
    for dir in logs metrics health-reports monitoring-queue; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log "📁 디렉토리 생성: $dir" "INFO"
        fi
    done
    
    # 환경 변수 설정
    export PORT=$PORT
    export NODE_ENV=development
    
    # 기존 프로세스 확인 및 정리
    local existing_pid=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$existing_pid" ]; then
        log "🔧 포트 $PORT의 기존 프로세스 종료: PID $existing_pid" "INFO"
        kill -TERM "$existing_pid" 2>/dev/null || true
        sleep 2
    fi
    
    # 모니터링 서버 시작 (백그라운드)
    log "🚀 모니터링 서버 시작 중... (포트: $PORT)" "INFO"
    
    nohup node monitoring-server.js > monitoring.out 2>&1 &
    local server_pid=$!
    
    # 잠시 대기 후 상태 확인
    sleep 5
    
    if check_service_health "$MONITORING_URL" "모니터링 서비스"; then
        log "✅ 모니터링 서비스 복구 완료 (PID: $server_pid)" "SUCCESS"
        log "📊 대시보드: http://localhost:$PORT" "SUCCESS"
        log "⚡ API: http://localhost:$PORT/api/status" "SUCCESS"
        echo "$server_pid" > monitoring.pid
        return 0
    else
        log "❌ 서비스 시작 후에도 헬스체크 실패" "ERROR"
        return 1
    fi
}

# 상태 확인
show_status() {
    log "📊 YAMEYAME 서비스 상태 점검" "INFO"
    log "================================" "INFO"
    
    if check_service_health "$BACKEND_API_URL" "Backend API"; then
        local backend_status="✅ 정상"
    else
        local backend_status="❌ 다운"
    fi
    
    if check_service_health "$MONITORING_URL" "모니터링"; then
        local monitoring_status="✅ 정상"
    else
        local monitoring_status="❌ 다운"
    fi
    
    log "Backend API (포트 3000): $backend_status" "INFO"
    log "모니터링 서비스 (포트 $PORT): $monitoring_status" "INFO"
    log "================================" "INFO"
}

# 지속적 헬스 모니터링
start_health_monitoring() {
    log "🔍 헬스 모니터링 시작 (체크 간격: ${CHECK_INTERVAL}초)" "INFO"
    
    while true; do
        local backend_healthy=0
        local monitoring_healthy=0
        
        if check_service_health "$BACKEND_API_URL" "Backend API" 2>/dev/null; then
            backend_healthy=1
        fi
        
        if check_service_health "$MONITORING_URL" "모니터링 서비스" 2>/dev/null; then
            monitoring_healthy=1
        fi
        
        # Backend API는 정상이지만 모니터링이 다운된 경우
        if [ $backend_healthy -eq 1 ] && [ $monitoring_healthy -eq 0 ]; then
            log "⚠️  모니터링 서비스 다운 감지 - 복구 시도" "WARN"
            
            if start_monitoring_service; then
                log "✅ 모니터링 서비스 자동 복구 성공" "SUCCESS"
            else
                log "❌ 모니터링 서비스 자동 복구 실패" "ERROR"
            fi
        fi
        
        # Backend API가 다운된 경우 알림만
        if [ $backend_healthy -eq 0 ]; then
            log "⚠️  Backend API 서비스 다운 - 수동 확인 필요" "WARN"
        fi
        
        # 모든 서비스가 정상인 경우
        if [ $backend_healthy -eq 1 ] && [ $monitoring_healthy -eq 1 ]; then
            if [ "${VERBOSE:-0}" -eq 1 ]; then
                log "✅ 모든 서비스 정상 작동" "SUCCESS"
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 메인 함수
main() {
    log "🚀 YAMEYAME 모니터링 자동 복구 시스템 시작" "INFO"
    
    # 초기 상태 점검
    show_status
    
    # 강제 복구 모드
    if [ "${FORCE:-0}" -eq 1 ]; then
        log "🔧 강제 복구 모드 실행" "INFO"
        start_monitoring_service
        exit $?
    fi
    
    # 상태만 확인하고 종료
    if [ "${STATUS_ONLY:-0}" -eq 1 ]; then
        exit 0
    fi
    
    # 모니터링 서비스가 다운되어 있으면 복구 시도
    if ! check_service_health "$MONITORING_URL" "모니터링 서비스" 2>/dev/null; then
        log "⚠️  모니터링 서비스 다운 감지 - 즉시 복구 시도" "WARN"
        start_monitoring_service
    fi
    
    # 지속적 헬스 모니터링 시작
    start_health_monitoring
}

# 신호 처리
cleanup() {
    log "🛑 자동 복구 시스템 종료" "INFO"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 스크립트 실행
case "${1:-}" in
    "status")
        STATUS_ONLY=1 main
        ;;
    "force")
        FORCE=1 main
        ;;
    "start")
        start_monitoring_service
        ;;
    *)
        main
        ;;
esac