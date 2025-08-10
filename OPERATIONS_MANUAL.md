# YAMEYAME 운영 매뉴얼

## 📚 목차

1. [빠른 시작](#빠른-시작)
2. [명령어 레퍼런스](#명령어-레퍼런스)
3. [모니터링 사용법](#모니터링-사용법)
4. [트러블슈팅](#트러블슈팅)
5. [성능 최적화](#성능-최적화)
6. [보안 가이드](#보안-가이드)
7. [배포 가이드](#배포-가이드)

---

## 🚀 빠른 시작

### 신입 개발자 3분 가이드

```bash
# 1. 프로젝트 클론 후 이동
git clone <repository-url>
cd YAMEYAME

# 2. 원클릭 설치
npm run setup

# 3. 개발 서버 시작
npm run dev

# 4. 모니터링 대시보드 확인
npm run dashboard
```

### 주요 명령어

| 명령어 | 설명 | 사용 시기 |
|--------|------|-----------|
| `npm run dev` | 전체 시스템 시작 | 일반 개발 |
| `npm run dev:turbo` | 빠른 시작 | 시간 절약 필요시 |
| `npm run stop` | 모든 서비스 중지 | 작업 완료 후 |
| `npm run status` | 서비스 상태 확인 | 문제 진단시 |
| `npm run help` | 도움말 보기 | 명령어 확인 |

---

## 📋 명령어 레퍼런스

### 개발 명령어

#### 기본 개발 서버
```bash
# 표준 시작 (권장)
npm run dev

# 옵션별 시작
npm run dev:turbo        # 사전 검사 스킵으로 빠른 시작
npm run dev:mock         # 목업 데이터로 시작
npm run dev:sequential   # 순차적 서비스 시작
npm run dev:no-monitoring # 모니터링 없이 시작
```

#### 서비스 제어
```bash
npm run stop             # 모든 서비스 중지
npm run status           # 서비스 상태 확인
npm run health           # 헬스체크 실행
npm run dashboard        # 모니터링 대시보드 열기
```

### 설정 및 설치

```bash
npm run setup            # 원클릭 환경 설정
npm run setup:full       # 완전한 환경 설정 (워크트리 포함)
npm run setup:check      # 설치 상태 확인

npm run config:validate  # 설정 검증
npm run config:show      # 서비스 구성 보기
npm run config:ports     # 포트 구성 보기
```

### 품질 관리

```bash
npm run lint             # 코드 린트 체크
npm run lint:fix         # 자동 린트 수정
npm run format           # 코드 포맷팅
npm run quality          # 품질 검사 (린트 + 포맷)
npm run quality:fix      # 품질 문제 자동 수정

npm run test             # 테스트 실행
npm run test:watch       # 테스트 감시 모드
```

### 빌드 및 배포

```bash
npm run build            # 프로덕션 빌드
npm run build:prod       # 프로덕션 최적화 빌드
npm run build:analyze    # 빌드 분석

npm run docker:build     # Docker 이미지 빌드
npm run docker:up        # Docker 컨테이너 시작
npm run docker:down      # Docker 컨테이너 중지
```

---

## 📊 모니터링 사용법

### 모니터링 대시보드 접근

1. **자동 시작**: `npm run dev` 실행시 자동으로 모니터링 서버 시작
2. **수동 시작**: `npm run monitoring` 또는 `npm run dashboard`
3. **URL 접근**: http://localhost:9999

### 주요 모니터링 메트릭

#### 시스템 메트릭
- **CPU 사용률**: 서비스별 CPU 점유율
- **메모리 사용량**: RAM 사용 현황
- **디스크 I/O**: 파일 시스템 활동
- **네트워크**: 포트별 연결 상태

#### 애플리케이션 메트릭
- **요청 응답 시간**: API 엔드포인트별 성능
- **에러율**: 서비스별 에러 발생률
- **활성 연결**: WebSocket 연결 수
- **데이터베이스**: 쿼리 성능 및 연결 풀

#### 비즈니스 메트릭
- **사용자 활동**: 실시간 접속자 수
- **게임 진행**: 진행 중인 게임 수
- **메시지**: 채팅 메시지 처리량

### 알림 설정

모니터링 시스템은 다음 상황에서 알림을 제공합니다:

- **높은 CPU 사용률** (80% 이상 5분 지속)
- **메모리 부족** (90% 이상 사용)
- **서비스 다운** (헬스체크 실패)
- **높은 에러율** (분당 10회 이상)
- **느린 응답** (평균 응답시간 5초 초과)

---

## 🚨 트러블슈팅

### 일반적인 문제들

#### 1. 서비스 시작 실패

**증상**:
```
❌ 시작 실패: Port 3000 already in use
```

**해결책**:
```bash
# 포트 사용 프로세스 확인
netstat -ano | findstr :3000

# 강제 중지
npm run stop

# 또는 특정 포트만 해제
taskkill /F /PID <프로세스ID>

# 재시작
npm run dev:turbo
```

#### 2. 의존성 설치 오류

**증상**:
```
npm ERR! peer dep missing
```

**해결책**:
```bash
# 의존성 완전 재설치
npm run clean:node_modules

# 또는 개별 패키지 설치
npm install <missing-package>

# 설치 상태 확인
npm run setup:check
```

#### 3. 모니터링 접속 불가

**증상**: 
- http://localhost:9999 접속 안됨
- 대시보드가 로드되지 않음

**해결책**:
```bash
# 모니터링 서비스 상태 확인
npm run status

# 모니터링만 별도 시작
npm run monitoring

# 방화벽 확인 (Windows)
netsh advfirewall firewall show rule name="Node.js"
```

#### 4. 워크스페이스 오류

**증상**:
```
ENOENT: no such file or directory, scandir 'worktrees'
```

**해결책**:
```bash
# 워크트리 설정
npm run setup:worktrees

# 전체 재설정
npm run setup:full

# 수동 디렉토리 생성
mkdir worktrees
```

### 고급 진단

#### 로그 분석

```bash
# 서비스별 로그 확인 (개발 모드에서 콘솔 출력 확인)
npm run dev

# 시스템 로그 (Windows)
Get-EventLog -LogName Application -Source "Node.js" -Newest 10

# 프로세스 모니터링
tasklist | findstr node
```

#### 네트워크 진단

```bash
# 포트 상태 확인
netstat -an | findstr "3000\|9999\|8080"

# 연결 테스트
curl http://localhost:3000/health
curl http://localhost:9999/api/status
```

#### 성능 진단

```bash
# 성능 벤치마크
npm run benchmark

# 시스템 리소스 확인
wmic cpu get loadpercentage /value
wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value
```

---

## ⚡ 성능 최적화

### 시작 시간 최적화

#### 빠른 시작 옵션 활용
```bash
# 터보 모드 (30초 → 10초)
npm run dev:turbo

# 모니터링 제외 (추가 2초 단축)
npm run dev:no-monitoring

# 순차 시작 (안정성 우선)
npm run dev:sequential
```

#### 의존성 최적화
```bash
# 불필요한 패키지 제거
npm audit
npm prune

# 캐시 최적화
npm cache clean --force
npm install
```

### 런타임 성능 최적화

#### 메모리 관리
- **Node.js 메모리 제한 증가**: `NODE_OPTIONS="--max-old-space-size=4096"`
- **가비지 컬렉션 튜닝**: `--expose-gc` 플래그 사용
- **메모리 누수 감지**: 모니터링 대시보드에서 메모리 사용량 추적

#### CPU 최적화
- **워커 스레드**: CPU 집약적 작업을 워커 스레드로 분리
- **캐싱 전략**: Redis 또는 메모리 캐시 활용
- **연결 풀링**: 데이터베이스 연결 풀 최적화

### 네트워크 최적화

#### API 응답 시간 개선
```javascript
// 압축 활성화
app.use(compression());

// 캐시 헤더 설정
app.use(express.static('public', {
  maxAge: '1d'
}));

// 요청 크기 제한
app.use(express.json({ limit: '10mb' }));
```

#### WebSocket 최적화
```javascript
// 연결 풀링
io.engine.generateId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 압축 활성화
io.compression(true);
```

---

## 🔒 보안 가이드

### 개발 환경 보안

#### 환경 변수 관리
```env
# .env 파일 예시 (개발용)
JWT_SECRET=dev-secret-change-in-production
DATABASE_URL=sqlite:./dev.db
API_RATE_LIMIT=100

# 프로덕션에서는 더 강력한 값 사용
JWT_SECRET=<복잡한-랜덤-문자열>
DATABASE_URL=postgresql://user:pass@host:port/db
API_RATE_LIMIT=50
```

#### 의존성 보안 검사
```bash
# 취약점 스캔
npm audit

# 자동 수정
npm audit fix

# 고위험 취약점 강제 수정
npm audit fix --force

# 보안 업데이트
npm update
```

### 접근 제어

#### API 보안
```javascript
// 속도 제한
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // 요청 제한
}));

// CORS 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));

// 보안 헤더
app.use(helmet());
```

#### 데이터베이스 보안
- **SQL 인젝션 방지**: 파라미터화된 쿼리 사용
- **접근 권한 최소화**: 데이터베이스 사용자 권한 제한
- **암호화**: 민감한 데이터는 암호화 저장

---

## 🚢 배포 가이드

### 개발 환경에서 프로덕션 준비

#### 1. 환경 구성 확인
```bash
# 프로덕션 빌드 테스트
npm run build:prod

# 설정 검증
npm run config:validate

# 보안 검사
npm audit
```

#### 2. 성능 테스트
```bash
# 벤치마크 실행
npm run benchmark

# 부하 테스트 (선택적)
# Artillery, JMeter 등 사용
```

### Docker 배포

#### Dockerfile 준비
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose 실행
```bash
# 이미지 빌드
npm run docker:build

# 컨테이너 시작
npm run docker:up

# 로그 확인
npm run docker:logs

# 정리
npm run docker:down
```

### CI/CD 파이프라인

#### GitHub Actions 예시
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run quality
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # 배포 스크립트 실행
          ./deploy.sh
```

### 모니터링 설정

#### 프로덕션 모니터링
- **APM 도구**: New Relic, DataDog 등 연동
- **로그 수집**: ELK Stack 또는 CloudWatch 설정  
- **알림 시스템**: Slack, 이메일 알림 구성
- **백업 전략**: 정기 데이터베이스 백업 설정

---

## 🔧 유지보수

### 정기 작업

#### 주간 작업
- [ ] 의존성 보안 스캔: `npm audit`
- [ ] 성능 벤치마크: `npm run benchmark`
- [ ] 로그 파일 정리
- [ ] 백업 데이터 검증

#### 월간 작업
- [ ] 의존성 업데이트: `npm update`
- [ ] 디스크 공간 정리
- [ ] 모니터링 데이터 분석
- [ ] 보안 패치 적용

### 비상 상황 대응

#### 서비스 중단시
1. **즉시 조치**: `npm run stop && npm run dev:turbo`
2. **원인 파악**: `npm run status && npm run health`
3. **로그 분석**: 콘솔 출력 및 시스템 로그 확인
4. **복구 확인**: 모니터링 대시보드에서 상태 확인

#### 데이터 손실시
1. **서비스 중지**: `npm run stop`
2. **백업 복원**: 최근 백업에서 데이터 복원
3. **무결성 검사**: 데이터 일관성 확인
4. **서비스 재시작**: `npm run dev`

---

## 📞 지원 및 문의

### 빠른 도움말
- `npm run help` - 명령어 도움말
- `npm run scripts` - 모든 스크립트 목록
- `npm run status` - 시스템 상태 확인

### 추가 자료
- [README.md](./README.md) - 프로젝트 개요
- [AUTORUN_GUIDE.md](./AUTORUN_GUIDE.md) - AutoRun 상세 가이드
- [docs/](./docs/) - 기술 문서

### 문제 보고
- GitHub Issues를 통한 버그 리포트
- 성능 문제는 `npm run benchmark` 결과와 함께 제보
- 보안 문제는 비공개로 연락

---

**마지막 업데이트**: 2025-08-10
**버전**: 0.3.0