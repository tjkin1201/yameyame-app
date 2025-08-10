# 🚀 YameYame AutoRun 가이드

## 개요

YameYame 프로젝트의 전체 개발 환경을 한 번의 명령어로 자동 시작하는 시스템입니다.

## 🎯 주요 기능

- **순차적 서비스 시작**: 의존성을 고려한 단계별 서비스 시작
- **헬스체크 검증**: 각 서비스의 정상 동작 확인
- **자동 롤백**: 오류 발생 시 이미 시작된 서비스들 자동 정리
- **상태 모니터링**: 실시간 서비스 상태 확인

## 📋 서비스 시작 순서

1. **Database Layer** (포트 5000)
   - PostgreSQL 및 Redis 연결 관리
   - 헬스체크: `http://localhost:5000/health`

2. **Backend API** (포트 3001)
   - RESTful API 서버
   - 헬스체크: `http://localhost:3001/health`

3. **Realtime Socket** (포트 3002)
   - Socket.IO 실시간 통신 서버
   - 헬스체크: `http://localhost:3002/health`

4. **Band Integration** (포트 3003)
   - 네이버 밴드 API 통합 서버
   - 헬스체크: `http://localhost:3003/health`

5. **Frontend UI** (포트 8081)
   - React Native Expo 개발 서버
   - 메트로 번들러 상태 확인

## 🛠️ 사용법

### 전체 환경 시작
```bash
npm run autorun
```

### 상태 확인
```bash
# 전체 상태 확인
npm run dev:status

# 헬스체크 실행
npm run dev:health
```

### 전체 환경 중지
```bash
npm run autorun:stop
```

## 🔧 개별 서비스 관리

### 개별 서비스 시작
```bash
# 백엔드만 시작
npm run backend

# 프론트엔드만 시작  
npm run frontend
```

### 기존 개발 모드 (2개 서비스만)
```bash
# 기존 방식으로 백엔드 + 프론트엔드만 시작
npm run dev

# 중지
npm run dev:stop
```

## 📊 실행 결과 예시

```
🎯 Starting YameYame AutoRun Environment
================================================

📍 Phase 1/5: database-layer
🚀 Starting database-layer...
✅ database-layer started successfully on port 5000

📍 Phase 2/5: backend-api  
🚀 Starting backend-api...
✅ backend-api started successfully on port 3001

📍 Phase 3/5: realtime-socket
🚀 Starting realtime-socket...
✅ realtime-socket started successfully on port 3002

📍 Phase 4/5: band-integration
🚀 Starting band-integration...
✅ band-integration started successfully on port 3003

📍 Phase 5/5: frontend-ui
🚀 Starting frontend-ui...
✅ frontend-ui started successfully on port 8081

🎉 AutoRun Environment Started Successfully!
================================================
📍 Services Running:
   • database-layer → http://localhost:5000
   • backend-api → http://localhost:3001
   • realtime-socket → http://localhost:3002
   • band-integration → http://localhost:3003
   • frontend-ui → http://localhost:8081

🔧 Management Commands:
   npm run dev:status    → Check service status
   npm run dev:health    → Health check all services  
   npm run autorun:stop  → Stop all services
```

## 🚨 문제 해결

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3001

# 프로세스 종료
taskkill /PID [PID번호] /F
```

### 서비스 시작 실패
```bash
# 로그 확인 후 개별 서비스 시작 테스트
cd worktrees/backend-api
npm run dev

# 의존성 재설치
npm install
```

### 헬스체크 실패
- Database Layer: PostgreSQL/Redis 연결 상태 확인
- Backend API: 포트 충돌 또는 모듈 누락 확인  
- Realtime Socket: Redis 연결 상태 확인
- Band Integration: 네이버 밴드 API 설정 확인

## 📝 추가 명령어

```bash
# 코드 품질 검사
npm run quality

# 프로젝트 정리 (node_modules 삭제)
npm run clean

# 워크트리 설정
npm run setup
```

## 🔧 시스템 요구사항

- **Node.js**: 18.0.0 이상
- **npm**: 최신 버전 권장
- **PowerShell**: Windows 환경에서 필수
- **포트**: 5000, 3001, 3002, 3003, 8081 사용 가능

## 📁 프로젝트 구조

```
YAMEYAME/
├── package.json              # 메인 패키지 설정
├── dev-workflow.ps1          # AutoRun 스크립트
└── worktrees/               # Git 워크트리 구조
    ├── database-layer/      # 데이터베이스 계층
    ├── backend-api/         # RESTful API 서버
    ├── realtime-socket/     # Socket.IO 서버
    ├── band-integration/    # 네이버 밴드 통합
    └── frontend-ui/         # React Native 앱
        └── yameyame-app/    # Expo 프로젝트
```

## ✨ 업데이트 내역

- **v0.3.0**: AutoRun 시스템 구현
  - 5개 서비스 순차 시작
  - 헬스체크 자동 검증  
  - 에러 시 자동 롤백
  - 통합 상태 모니터링