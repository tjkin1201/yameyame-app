# YAMEYAME 통합 모니터링 시스템

## 📊 개요

YAMEYAME AutoRun 시스템을 위한 통합 모니터링 및 로깅 시스템입니다.
5개 마이크로서비스의 상태를 실시간으로 모니터링하고, 중앙집중식 로그 관리를 제공합니다.

## 🏗️ 시스템 구조

```
monitoring/
├── 📊 Core Components
│   ├── monitoring-server.js      # 메인 모니터링 서버
│   ├── log-collector.js         # 로그 수집기
│   ├── monitoring-middleware.js # 서비스 연동 미들웨어
│   └── dashboard.html          # 실시간 웹 대시보드
│
├── 🚀 Scripts
│   ├── start-monitoring.ps1    # Windows 시작 스크립트
│   └── package.json           # 의존성 관리
│
└── 📁 Data Directories
    ├── logs/                  # 서비스별 로그 파일
    ├── metrics/              # 성능 메트릭 데이터
    ├── health-reports/       # 헬스체크 리포트
    └── monitoring-queue/     # 모니터링 데이터 큐
```

## 🎯 주요 기능

### 1. 실시간 모니터링
- **서비스 상태**: 5개 마이크로서비스 실시간 상태 확인
- **성능 메트릭**: CPU, 메모리, 응답시간 추적
- **시스템 리소스**: 전체 시스템 리소스 사용률 모니터링

### 2. 중앙집중식 로깅
- **통합 로그 수집**: 모든 서비스 로그를 중앙에서 관리
- **구조화된 로그**: JSON 형태의 일관된 로그 포맷
- **로그 레벨 관리**: INFO, WARNING, ERROR, CRITICAL 분류
- **자동 보관**: 오래된 로그 자동 정리 (7일 보관)

### 3. 자동 알림 시스템
- **서비스 다운 감지**: 서비스 중단 시 즉시 알림
- **성능 임계치 모니터링**: CPU/메모리 사용률 초과 시 알림
- **브라우저 알림**: 웹 대시보드에서 실시간 알림 표시

### 4. 웹 대시보드
- **실시간 업데이트**: WebSocket을 통한 실시간 데이터 업데이트
- **직관적 UI**: 다크 테마 기반 모던 대시보드
- **모바일 반응형**: 모든 디바이스에서 최적 표시

## 🚀 빠른 시작

### 1. 모니터링 시스템 시작

```powershell
# 모니터링 서버 시작
cd monitoring
./start-monitoring.ps1
```

### 2. 대시보드 접속

브라우저에서 http://localhost:9999 접속

### 3. 서비스 상태 확인

- **백엔드 API**: localhost:3000 (포트 변경됨)
- **실시간 소켓**: localhost:3001  
- **밴드 연동**: localhost:3002
- **데이터베이스**: localhost:3003
- **프론트엔드**: localhost:8081

## 📊 모니터링 대상 서비스

| 서비스명 | 포트 | 설명 | 상태 |
|---------|------|------|------|
| **backend-api** | 3000 | 메인 API 서버 | ✅ 모니터링 적용 |
| **realtime-socket** | 3001 | WebSocket 서버 | 🔄 적용 예정 |
| **band-integration** | 3002 | 밴드 API 연동 | 🔄 적용 예정 |
| **database-layer** | 3003 | 데이터베이스 레이어 | 🔄 적용 예정 |
| **frontend-ui** | 8081 | React Native 앱 | 🔄 적용 예정 |

## 🔧 모니터링 미들웨어 사용법

각 서비스에서 모니터링 기능을 사용하려면:

```javascript
// 모니터링 미들웨어 import
const MonitoringMiddleware = require('../../monitoring/monitoring-middleware');

// 모니터링 초기화
const monitoring = new MonitoringMiddleware('service-name', {
  logToFile: true,
  logToConsole: true,
  sendToMonitoring: true,
  healthCheckInterval: 30000
});

// Express 앱에서 사용
app.use(monitoring.express());

// 수동 로깅
monitoring.log('INFO', 'Custom log message', { extra: 'data' });

// 커스텀 메트릭
monitoring.incrementMetric('custom_counter');
monitoring.setMetric('current_users', 42);
```

## 📈 API 엔드포인트

### 모니터링 API

```
GET  /api/status              # 전체 시스템 상태
GET  /api/services/:serviceId # 특정 서비스 상세 정보
GET  /api/logs               # 로그 조회 (필터링 지원)
GET  /api/metrics/history    # 메트릭 히스토리 (24시간)
GET  /api/alerts             # 알림 목록
POST /api/alerts             # 새 알림 생성
PUT  /api/alerts/:id/acknowledge # 알림 확인
GET  /health                 # 모니터링 서버 헬스체크
```

### 헬스체크 API (각 서비스)

```
GET  /health                 # 기본 헬스체크
GET  /api/health            # 상세 헬스체크 (모니터링 정보 포함)
```

## 🛠️ 설정 옵션

### monitoring-server.js 설정

```javascript
const server = new MonitoringServer({
  port: 9999,                    // 서버 포트
  logRetentionDays: 7,          // 로그 보관 기간
  metricsInterval: 60000,       // 메트릭 수집 간격 (ms)
  healthCheckInterval: 30000,   // 헬스체크 간격 (ms)
  maxLogBuffer: 1000           // 메모리 로그 버퍼 크기
});
```

### monitoring-middleware.js 설정

```javascript
const monitoring = new MonitoringMiddleware('service-name', {
  monitoringServerUrl: 'http://localhost:9999',
  logToFile: true,              // 파일 로깅 활성화
  logToConsole: true,           // 콘솔 로깅 활성화
  sendToMonitoring: true,       // 모니터링 서버 전송
  healthCheckInterval: 30000    // 헬스 리포트 간격
});
```

## 📊 메트릭 및 알림

### 자동 수집 메트릭

- **시스템 메트릭**: CPU 부하, 메모리 사용률, 업타임
- **서비스 메트릭**: 요청 수, 응답 시간, 에러율
- **프로세스 메트릭**: PID, 메모리 사용량, CPU 사용률

### 자동 알림 조건

- **CRITICAL**: 서비스 중단
- **WARNING**: CPU 사용률 > 80%, 메모리 사용률 > 85%
- **INFO**: 서비스 시작/종료

## 🔍 로그 포맷

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "backend-api",
  "level": "INFO",
  "message": "HTTP 200 GET /api/clubs - 45ms",
  "metadata": {
    "statusCode": 200,
    "responseTime": 45,
    "method": "GET",
    "path": "/api/clubs"
  },
  "pid": 12345,
  "memory": {
    "rss": 52428800,
    "heapTotal": 33554432,
    "heapUsed": 18874368
  }
}
```

## 🚨 문제 해결

### 자동 복구 시스템 🛠️

모니터링 서비스 다운 시 자동으로 복구하는 스크립트를 제공합니다:

#### PowerShell 버전 (Windows)
```powershell
# 상태 확인만
.\auto-recovery.ps1 -Status

# 강제 복구
.\auto-recovery.ps1 -Force

# 지속적 모니터링 (자동 복구 포함)
.\auto-recovery.ps1
```

#### Bash 버전 (Git Bash/WSL)
```bash
# 상태 확인만
bash auto-recovery.sh status

# 강제 복구
bash auto-recovery.sh force

# 지속적 모니터링 (자동 복구 포함)
bash auto-recovery.sh
```

### 일반적인 문제들

#### 1. 모니터링 서비스 다운
**증상**: 포트 9999 접근 불가, 대시보드 로드 실패

**해결책**:
```bash
# 즉시 복구
cd monitoring
bash auto-recovery.sh force

# 또는 수동 복구
npm install
node monitoring-server.js
```

#### 2. 포트 충돌

**증상**: "EADDRINUSE: address already in use" 에러

**해결책**:
```powershell
# Windows에서 포트 사용 프로세스 확인
netstat -ano | findstr :9999

# 프로세스 종료 (PID 확인 후)
taskkill /PID [PID_NUMBER] /F

# 다른 포트로 시작
$env:PORT = "9998"
node monitoring-server.js
```

#### 3. Backend API 연결 실패

**증상**: 모니터링 대시보드에서 "backend-api" 서비스가 "stopped" 상태

**해결책**:
1. Backend API 서버가 실행 중인지 확인: `http://localhost:3000/api/health`
2. 방화벽 설정 확인
3. 포트 번호 확인 (3000번 포트)

#### 4. 의존성 설치 실패

**증상**: `npm install` 명령어 실행 실패

**해결책**:
```bash
# 캐시 정리 후 재설치
npm cache clean --force
npm install

# Node.js 버전 확인 (14.0.0 이상 필요)
node --version
```

#### 5. 로그 파일 권한 문제

**증상**: 로그 파일 생성/쓰기 실패

**해결책**:
```powershell
# Windows
icacls "monitoring/logs" /grant Users:F

# 필요 디렉토리 수동 생성
mkdir logs, metrics, health-reports, monitoring-queue
```

### 응급 복구 체크리스트 ✅

모니터링 서비스가 다운되었을 때 다음 순서로 점검하세요:

1. **[ ]** Backend API 상태 확인: `curl http://localhost:3000/api/health`
2. **[ ]** 모니터링 포트 확인: `curl http://localhost:9999/health`
3. **[ ]** 자동 복구 스크립트 실행: `bash auto-recovery.sh force`
4. **[ ]** 의존성 설치 확인: `npm list --depth=0`
5. **[ ]** 로그 파일 확인: `tail -f monitoring/auto-recovery.log`
6. **[ ]** 대시보드 접근 테스트: 브라우저에서 `http://localhost:9999`
7. **[ ]** 실시간 데이터 확인: WebSocket 연결 상태 점검

## 📚 추가 정보

### 성능 고려사항

- 로그 버퍼 크기: 메모리 사용량과 성능의 균형점 조절
- 메트릭 수집 간격: 시스템 부하와 실시간성의 균형점 조절
- 파일 정리 주기: 디스크 사용량 관리

### 확장성

- **추가 서비스**: `monitoring-middleware.js`를 import하여 쉽게 추가
- **커스텀 메트릭**: 비즈니스 로직별 메트릭 수집 가능
- **외부 시스템**: Grafana, Prometheus 등과 연동 가능

### 보안

- **민감 정보**: 로그에 개인정보, 비밀번호 등 기록 금지
- **접근 제어**: 프로덕션에서는 대시보드 접근 제어 필요
- **데이터 보관**: GDPR 등 개인정보 규정 준수

## 🤝 기여하기

1. 버그 리포트: GitHub Issues 활용
2. 기능 제안: Feature Request 템플릿 사용
3. 코드 기여: Pull Request 환영

---

**YAMEYAME 개발팀** 🏸
*동배즐 - 동탄 배드민턴 동호회를 위한 통합 관리 시스템*