# YameYame E2E Tests

동배즐(동탄 배드민턴 동호회) React Native 앱을 위한 포괄적인 End-to-End 테스트 시스템입니다.

## 🎯 테스트 개요

이 E2E 테스트 시스템은 React Native Expo 앱과 Node.js 백엔드 API 간의 통합을 검증하며, 다양한 모바일 디바이스에서의 사용자 경험을 테스트합니다.

### 🔍 테스트 범위

- **인증 플로우**: 로그인, 회원가입, 세션 관리
- **네비게이션**: 탭 네비게이션 및 화면 전환
- **게임 관리**: 배드민턴 게임 생성, 참여, 관리
- **API 통합**: 백엔드 API와의 데이터 동기화
- **모바일 성능**: 로딩 시간, 메모리 사용량, 스크롤 성능
- **크로스 플랫폼**: 다양한 디바이스 및 브라우저 호환성

## 🚀 빠른 시작

### 전제 조건

- Node.js 18.0.0 이상
- npm 또는 yarn
- 백엔드 서버 (포트 3000)
- React Native Expo 개발 서버 (포트 8081)

### 설치

```bash
# E2E 테스트 디렉토리로 이동
cd e2e

# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install --with-deps
```

### 서버 준비

테스트 실행 전에 백엔드와 프론트엔드 서버가 실행되고 있어야 합니다:

```bash
# 백엔드 서버 시작 (다른 터미널)
cd worktrees/backend-api
npm run dev:mock

# 프론트엔드 서버 시작 (다른 터미널)
cd worktrees/frontend-ui/yameyame-app
npx expo start --web
```

### 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 스위트 실행
npm run test:auth          # 인증 테스트
npm run test:navigation    # 네비게이션 테스트
npm run test:features      # 기능 테스트
npm run test:performance   # 성능 테스트
npm run test:cross-platform # 크로스 플랫폼 테스트

# 모바일 디바이스별 테스트
npm run test:mobile        # 모바일 테스트
npm run test:tablet        # 태블릿 테스트

# 헤드리스 모드 해제 (UI 확인)
npm run test:headed

# 디버그 모드
npm run test:debug
```

## 📱 자동화 스크립트

편의를 위해 자동화된 테스트 실행 스크립트를 제공합니다:

### Windows (PowerShell)

```powershell
# 모든 테스트 (서버 자동 시작/종료)
.\scripts\run-tests.ps1

# 특정 테스트 스위트
.\scripts\run-tests.ps1 -TestSuite auth
.\scripts\run-tests.ps1 -TestSuite performance

# 헤드 모드로 실행
.\scripts\run-tests.ps1 -Headed

# 디버그 모드
.\scripts\run-tests.ps1 -Debug

# 태블릿 테스트
.\scripts\run-tests.ps1 -TestSuite mobile -Device tablet
```

### Linux/macOS (Bash)

```bash
# 실행 권한 부여
chmod +x scripts/run-tests.sh

# 모든 테스트 (서버 자동 시작/종료)
./scripts/run-tests.sh

# 특정 테스트 스위트
./scripts/run-tests.sh --suite auth
./scripts/run-tests.sh --suite performance

# 헤드 모드로 실행
./scripts/run-tests.sh --headed

# 디버그 모드
./scripts/run-tests.sh --debug

# 태블릿 테스트
./scripts/run-tests.sh --suite mobile --device tablet
```

## 🐳 Docker 실행

```bash
# Docker 이미지 빌드
npm run docker:build

# Docker로 테스트 실행
npm run docker:run
```

## 📊 테스트 구조

```
e2e/
├── tests/
│   ├── auth/                 # 인증 관련 테스트
│   │   └── authentication-flow.spec.ts
│   ├── navigation/           # 네비게이션 테스트
│   │   └── tab-navigation.spec.ts
│   ├── features/             # 주요 기능 테스트
│   │   └── game-management.spec.ts
│   ├── api/                  # API 통합 테스트
│   │   └── backend-integration.spec.ts
│   ├── performance/          # 성능 테스트
│   │   └── mobile-performance.spec.ts
│   └── cross-platform/       # 크로스 플랫폼 테스트
│       └── device-compatibility.spec.ts
├── setup/                    # 설정 파일
│   ├── global-setup.ts       # 글로벌 설정
│   └── global-teardown.ts    # 글로벌 정리
├── scripts/                  # 실행 스크립트
│   ├── run-tests.ps1         # Windows용
│   └── run-tests.sh          # Linux/macOS용
├── playwright.config.ts      # Playwright 설정
├── package.json              # 패키지 설정
└── README.md                 # 이 문서
```

## 🎭 테스트 시나리오

### 인증 플로우 테스트
- 로그인 화면 표시 확인
- 유효한 자격 증명으로 로그인
- 잘못된 자격 증명 처리
- 회원가입 프로세스
- 세션 유지 및 로그아웃

### 게임 관리 테스트
- 게임 목록 표시
- 새 게임 생성
- 게임 참여/탈퇴
- 게임 필터링 및 검색
- 실시간 참가자 업데이트

### 성능 테스트
- 앱 로딩 시간 측정
- Core Web Vitals 검증
- 메모리 사용량 모니터링
- 스크롤 성능 평가
- 네트워크 최적화 확인

### 크로스 플랫폼 테스트
- 다양한 모바일 디바이스 지원
- 반응형 레이아웃 검증
- 터치 제스처 동작
- 화면 회전 처리
- 접근성 표준 준수

## 📈 성능 벤치마크

### 목표 성능 지표

| 메트릭 | 목표 | 임계값 |
|--------|------|--------|
| LCP (Largest Contentful Paint) | < 2.5초 | < 4초 |
| FID (First Input Delay) | < 100ms | < 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 |
| 초기 로딩 시간 | < 3초 (3G) | < 5초 |
| 탭 전환 시간 | < 300ms | < 500ms |
| API 응답 시간 | < 200ms | < 500ms |

### 디바이스별 성능 기준

| 디바이스 | 로딩 시간 | 메모리 사용량 |
|----------|-----------|---------------|
| iPhone 14 Pro | < 2초 | < 100MB |
| Samsung Galaxy S23 | < 2.5초 | < 120MB |
| iPad Pro | < 1.5초 | < 150MB |
| 저사양 디바이스 | < 5초 | < 80MB |

## 🔧 설정 커스터마이징

### 환경 변수

```bash
# .env 파일 생성
API_URL=http://localhost:3000    # 백엔드 API URL
BASE_URL=http://localhost:8081   # 프론트엔드 URL
NODE_ENV=test                    # 테스트 환경
BROWSER=chromium                 # 기본 브라우저
```

### Playwright 설정

`playwright.config.ts`에서 다음 설정을 조정할 수 있습니다:

- 테스트 타임아웃
- 재시도 횟수
- 병렬 실행 설정
- 디바이스 에뮬레이션
- 스크린샷/비디오 캡처

## 🐛 문제 해결

### 일반적인 문제

1. **서버 연결 실패**
   ```bash
   # 서버가 실행 중인지 확인
   curl http://localhost:3000/api/health
   curl http://localhost:8081
   ```

2. **브라우저 설치 문제**
   ```bash
   # 브라우저 수동 설치
   npx playwright install --with-deps chromium
   ```

3. **포트 충돌**
   ```bash
   # 포트 사용 중인 프로세스 확인
   lsof -i :3000
   lsof -i :8081
   ```

4. **메모리 부족**
   ```bash
   # 테스트 병렬 실행 수 조정
   npx playwright test --workers=1
   ```

### 테스트 실패 시 디버깅

1. **헤드 모드로 실행**
   ```bash
   npm run test:headed
   ```

2. **디버그 모드 사용**
   ```bash
   npm run test:debug
   ```

3. **트레이스 분석**
   ```bash
   npx playwright show-trace test-results/trace.zip
   ```

4. **스크린샷 확인**
   - `test-results/` 폴더의 실패 스크린샷 확인

## 🔄 CI/CD 통합

GitHub Actions를 통한 자동화된 테스트:

- **트리거**: PR, main 브랜치 푸시, 일정 실행
- **매트릭스 테스트**: 다양한 브라우저 및 디바이스
- **병렬 실행**: 테스트 스위트별 병렬 처리
- **결과 리포트**: HTML 리포트 및 아티팩트 저장
- **알림**: 실패 시 자동 알림

## 📝 기여 가이드

### 새 테스트 추가

1. 적절한 카테고리 폴더에 테스트 파일 생성
2. 페이지 오브젝트 모델 사용
3. 명확한 테스트 설명 작성
4. 모바일 친화적 선택자 사용

### 코딩 표준

- TypeScript 사용
- ESLint 규칙 준수
- 의미 있는 데이터 테스트 ID 사용
- 적절한 대기 시간 설정
- 에러 처리 및 정리 코드 포함

### 테스트 네이밍

```typescript
test.describe('기능 그룹', () => {
  test('should 예상_동작 when 조건', async ({ page }) => {
    // 테스트 구현
  });
});
```

## 📚 추가 리소스

- [Playwright 문서](https://playwright.dev/docs/intro)
- [React Native 테스팅](https://reactnative.dev/docs/testing-overview)
- [모바일 성능 최적화](https://web.dev/mobile/)
- [접근성 가이드](https://www.w3.org/WAI/WCAG21/quickref/)

## 📞 지원

문제가 발생하거나 질문이 있는 경우:

1. 이 README의 문제 해결 섹션 확인
2. GitHub Issues에 버그 리포트 생성
3. 팀 Slack 채널에서 문의

---

**동배즐 팀** | YameYame E2E Testing Framework v1.0.0