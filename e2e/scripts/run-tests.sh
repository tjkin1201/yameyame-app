#!/bin/bash
# Bash script to run E2E tests locally
# 로컬 환경에서 E2E 테스트 실행을 위한 스크립트

set -e  # Exit on any error

# Default parameters
TEST_SUITE="all"
HEADED=false
DEBUG=false
BROWSER="chromium"
DEVICE="mobile"
CLEAN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
log() {
    echo -e "${2}$1${NC}"
}

# Function to cleanup background processes
cleanup() {
    log "🧹 정리 작업 중..." $YELLOW
    
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        log "✅ 백엔드 서버 종료 완료" $GREEN
    fi
    
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        log "✅ 프론트엔드 서버 종료 완료" $GREEN
    fi
    
    # Kill any remaining processes on our ports
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    
    log "🎭 테스트 실행 완료" $CYAN
}

# Set up cleanup trap
trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -d|--device)
            DEVICE="$2"
            shift 2
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -s, --suite      Test suite to run (all, smoke, auth, features, performance, etc.)"
            echo "  --headed         Run tests in headed mode"
            echo "  --debug          Run tests in debug mode"
            echo "  -b, --browser    Browser to use (chromium, firefox, webkit)"
            echo "  -d, --device     Device type (mobile, tablet)"
            echo "  --clean          Clean test results before running"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            log "Unknown option: $1" $RED
            exit 1
            ;;
    esac
done

log "🎭 YameYame E2E Test Runner" $CYAN
log "===============================================" $CYAN

# Set environment variables
export API_URL="http://localhost:3000"
export BASE_URL="http://localhost:8081"
export NODE_ENV="test"

# Clean test results if requested
if [ "$CLEAN" = true ]; then
    log "🧹 테스트 결과 정리 중..." $YELLOW
    rm -rf test-results/ playwright-report/ test-results-json/
    log "✅ 테스트 결과 정리 완료" $GREEN
fi

# Check if required directories exist
if [ ! -d "../worktrees/backend-api" ]; then
    log "❌ 백엔드 디렉토리를 찾을 수 없습니다: ../worktrees/backend-api" $RED
    exit 1
fi

if [ ! -d "../worktrees/frontend-ui/yameyame-app" ]; then
    log "❌ 프론트엔드 디렉토리를 찾을 수 없습니다: ../worktrees/frontend-ui/yameyame-app" $RED
    exit 1
fi

# Check for existing processes on our ports
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log "⚠️  포트 3000이 사용 중입니다. 기존 백엔드 서버를 종료해주세요." $YELLOW
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log "⚠️  포트 8081이 사용 중입니다. 기존 프론트엔드 서버를 종료해주세요." $YELLOW
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
fi

# Start backend server
log "🚀 백엔드 서버 시작 중..." $GREEN
cd ../worktrees/backend-api

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    log "📦 백엔드 의존성 설치 중..." $YELLOW
    npm ci
fi

npm run dev:mock &
BACKEND_PID=$!
cd - > /dev/null

# Wait for backend to be ready
log "⏳ 백엔드 서버 준비 대기 중..." $YELLOW
max_wait=30
waited=0

while [ $waited -lt $max_wait ]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log "✅ 백엔드 서버가 준비되었습니다!" $GREEN
        break
    fi
    sleep 2
    waited=$((waited + 2))
    echo -n "."
done

if [ $waited -ge $max_wait ]; then
    log "\n❌ 백엔드 서버 시작 실패 (${waited}초 대기)" $RED
    exit 1
fi

# Start frontend server
log "📱 프론트엔드 서버 시작 중..." $GREEN
cd ../worktrees/frontend-ui/yameyame-app

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    log "📦 프론트엔드 의존성 설치 중..." $YELLOW
    npm ci
fi

# Check if Expo CLI is installed
if ! command -v expo &> /dev/null; then
    log "📦 Expo CLI 설치 중..." $YELLOW
    npm install -g @expo/cli
fi

EXPO_USE_DEV_SERVER=true npx expo start --web --non-interactive &
FRONTEND_PID=$!
cd - > /dev/null

# Wait for frontend to be ready
log "⏳ 프론트엔드 서버 준비 대기 중..." $YELLOW
max_wait=60
waited=0

while [ $waited -lt $max_wait ]; do
    if curl -f http://localhost:8081 > /dev/null 2>&1; then
        log "✅ 프론트엔드 서버가 준비되었습니다!" $GREEN
        break
    fi
    sleep 2
    waited=$((waited + 2))
    echo -n "."
done

if [ $waited -ge $max_wait ]; then
    log "\n❌ 프론트엔드 서버 시작 실패 (${waited}초 대기)" $RED
    exit 1
fi

# Install E2E dependencies
log "🌐 Playwright 설정 중..." $GREEN
if [ ! -d "node_modules" ]; then
    log "📦 E2E 테스트 의존성 설치 중..." $YELLOW
    npm ci
fi

# Install Playwright browsers
npx playwright install $BROWSER --with-deps

# Run tests
log "🎯 테스트 실행 중..." $GREEN
log "테스트 스위트: $TEST_SUITE" $CYAN
log "브라우저: $BROWSER" $CYAN
log "디바이스: $DEVICE" $CYAN

# Build test command
TEST_COMMAND="npx playwright test"

if [ "$HEADED" = true ]; then
    TEST_COMMAND="$TEST_COMMAND --headed"
fi

if [ "$DEBUG" = true ]; then
    TEST_COMMAND="$TEST_COMMAND --debug"
fi

# Add suite-specific options
case $TEST_SUITE in
    "smoke")
        TEST_COMMAND="$TEST_COMMAND --grep smoke"
        ;;
    "auth")
        TEST_COMMAND="$TEST_COMMAND tests/auth/"
        ;;
    "navigation")
        TEST_COMMAND="$TEST_COMMAND tests/navigation/"
        ;;
    "features")
        TEST_COMMAND="$TEST_COMMAND tests/features/"
        ;;
    "api")
        TEST_COMMAND="$TEST_COMMAND tests/api/"
        ;;
    "performance")
        TEST_COMMAND="$TEST_COMMAND tests/performance/"
        ;;
    "cross-platform")
        TEST_COMMAND="$TEST_COMMAND tests/cross-platform/"
        ;;
    "mobile")
        if [ "$DEVICE" = "tablet" ]; then
            TEST_COMMAND="$TEST_COMMAND --project=\"Tablet - iPad\""
        else
            TEST_COMMAND="$TEST_COMMAND --project=\"Mobile Chrome - Portrait\""
        fi
        ;;
    "all")
        # Run all tests (default)
        ;;
    *)
        log "❌ 알 수 없는 테스트 스위트: $TEST_SUITE" $RED
        exit 1
        ;;
esac

log "실행 명령: $TEST_COMMAND" $BLUE

# Execute tests
eval $TEST_COMMAND
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    log "✅ 모든 테스트가 성공했습니다!" $GREEN
else
    log "❌ 일부 테스트가 실패했습니다." $RED
fi

# Show report information
if [ -f "playwright-report/index.html" ]; then
    log "📊 테스트 리포트가 생성되었습니다!" $GREEN
    log "리포트 보기: npx playwright show-report" $CYAN
fi

# Show results folder information
if [ -d "test-results" ]; then
    RESULT_FILES=$(find test-results -type f | wc -l)
    log "📁 테스트 결과 파일: ${RESULT_FILES}개" $CYAN
fi

log "===============================================" $CYAN

exit $TEST_RESULT