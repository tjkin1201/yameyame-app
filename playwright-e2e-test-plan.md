# yameyame 프로젝트 Playwright MCP E2E 테스트 계획

## 📋 프로젝트 개요

**프로젝트**: yameyame (배드민턴 동호회 관리 시스템)  
**아키텍처**: 마이크로서비스 (6개 서비스)  
**프론트엔드**: React Native Expo (포트 8081)  
**테스트 도구**: Playwright MCP + Detox  

### 🏗️ 시스템 아키텍처
```yaml
services:
  frontend: "React Native Expo (8081)"
  backend_api: "Express API (3001)"
  socket_server: "Socket.io 실시간 통신 (3002)"  
  band_integration: "네이버 밴드 API 연동 (3003)"
  database_layer: "MongoDB Express (5000)"
  monitoring: "모니터링 대시보드 (9999)"

integrations:
  - "네이버 밴드 OAuth 로그인"
  - "실시간 Socket.io 채팅"
  - "MongoDB 데이터 동기화"
  - "AWS 클라우드 배포"
```

## 🎪 Playwright MCP 설정 및 구성

### MCP 서버 활성화 전략
```javascript
const playwrightMCPConfig = {
  // 자동 활성화 조건
  autoActivation: {
    triggers: [
      "E2E 테스트 실행",
      "크로스 브라우저 테스트",
      "성능 측정 요청",
      "시각적 회귀 테스트",
      "실시간 기능 테스트"
    ],
    context: "yameyame 프로젝트의 복잡한 마이크로서비스 환경"
  },

  // MCP 서버 좌표 설정
  coordination: {
    primary: "Playwright MCP",
    supporting: [
      "Sequential MCP (복잡한 시나리오 분석)",
      "Context7 MCP (Playwright 문서 및 패턴)",
      "Magic MCP (테스트 컴포넌트 생성)"
    ]
  },

  // 성능 최적화
  optimization: {
    parallelBrowsers: 3,
    deviceEmulation: ["Desktop", "Mobile", "Tablet"],
    networkConditions: ["Fast 3G", "Slow 3G", "Offline"]
  }
};
```

### Playwright 설정 파일
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 테스트 디렉토리
  testDir: './e2e',
  
  // 전역 설정
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 리포터 설정
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  // 전역 설정
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000
  },

  // 프로젝트별 브라우저 설정
  projects: [
    // Desktop 브라우저들
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },

    // 모바일 디바이스들 (React Native 앱과 유사한 환경)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    },

    // 태블릿
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] }
    }
  ],

  // 웹 서버 설정 (React Native Expo 서버)
  webServer: {
    command: 'npm start',
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

## 🎭 핵심 사용자 여정별 E2E 테스트 시나리오

### 1. 사용자 인증 플로우 (네이버 밴드 OAuth)
```typescript
// tests/auth/band-oauth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('네이버 밴드 OAuth 인증 플로우', () => {
  test('정상적인 로그인 플로우', async ({ page, context }) => {
    // 성능 측정 시작
    await page.goto('/');
    
    const loginStart = Date.now();
    
    // 1. 로그인 버튼 클릭
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    await page.click('[data-testid="login-button"]');
    
    // 2. 네이버 밴드 OAuth 페이지로 리다이렉션 확인
    await page.waitForURL(/band\.us\/oauth/, { timeout: 10000 });
    await expect(page.locator('text=네이버 밴드')).toBeVisible();
    
    // 3. 테스트 계정으로 로그인 (Mock 환경)
    await page.fill('#username', process.env.TEST_BAND_USERNAME);
    await page.fill('#password', process.env.TEST_BAND_PASSWORD);
    await page.click('[type="submit"]');
    
    // 4. 권한 승인 확인
    const allowButton = page.locator('text=허용');
    if (await allowButton.isVisible()) {
      await allowButton.click();
    }
    
    // 5. 앱으로 리다이렉션 및 로그인 완료 확인
    await page.waitForURL('http://localhost:8081/home', { timeout: 15000 });
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    
    const loginEnd = Date.now();
    const loginDuration = loginEnd - loginStart;
    
    // 성능 기준: 15초 이내 로그인 완료
    expect(loginDuration).toBeLessThan(15000);
    
    // 스크린샷 캡처 (시각적 회귀 테스트)
    await page.screenshot({ 
      path: `screenshots/auth/login-success-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('로그인 실패 처리', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    
    // 잘못된 자격증명 입력
    await page.fill('#username', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('[type="submit"]');
    
    // 오류 메시지 확인
    await expect(page.locator('text=로그인 실패')).toBeVisible();
    
    // 앱으로 돌아와서 오류 처리 확인
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('네트워크 오류 시 복구 메커니즘', async ({ page }) => {
    // 오프라인 상태 시뮬레이션
    await page.context().setOffline(true);
    
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    
    // 네트워크 오류 메시지 확인
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    
    // 온라인 복구 후 자동 재시도 확인
    await page.context().setOffline(false);
    await page.click('[data-testid="retry-button"]');
    
    await page.waitForURL(/band\.us\/oauth/, { timeout: 10000 });
  });
});
```

### 2. 게임 예약 및 관리 플로우
```typescript
// tests/game-management/game-reservation-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('게임 예약 및 관리 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인된 상태로 시작
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'test-user-1',
        name: '김철수',
        role: 'member'
      }));
    });
    await page.goto('/home');
  });

  test('새 게임 생성 전체 플로우', async ({ page }) => {
    const gameCreationStart = Date.now();
    
    // 1. 게임 생성 버튼 클릭
    await expect(page.locator('[data-testid="create-game-fab"]')).toBeVisible();
    await page.click('[data-testid="create-game-fab"]');
    
    // 2. 게임 정보 입력
    await expect(page.locator('[data-testid="game-form"]')).toBeVisible();
    
    await page.fill('[data-testid="game-title"]', 'E2E 테스트 복식 게임');
    await page.selectOption('[data-testid="game-type"]', 'doubles');
    
    // 날짜 시간 선택
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date"]', tomorrow.toISOString().split('T')[0]);
    await page.fill('[data-testid="game-time"]', '19:00');
    
    // 최대 참가자 수 설정
    await page.selectOption('[data-testid="max-participants"]', '4');
    
    // 코트 선택
    await page.selectOption('[data-testid="court-selection"]', 'court-1');
    
    // 게임 설명 입력
    await page.fill('[data-testid="game-description"]', 'Playwright로 생성된 테스트 게임입니다.');
    
    // 3. 게임 생성 완료
    await page.click('[data-testid="create-game-submit"]');
    
    // 4. 성공 메시지 및 리다이렉션 확인
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await page.waitForURL('**/games/**', { timeout: 5000 });
    
    const gameCreationEnd = Date.now();
    const creationDuration = gameCreationEnd - gameCreationStart;
    
    // 성능 기준: 5초 이내 게임 생성
    expect(creationDuration).toBeLessThan(5000);
    
    // 5. 생성된 게임 정보 확인
    await expect(page.locator('text=E2E 테스트 복식 게임')).toBeVisible();
    await expect(page.locator('text=복식')).toBeVisible();
    await expect(page.locator('text=김철수')).toBeVisible(); // 생성자
    
    // 스크린샷 캡처
    await page.screenshot({ 
      path: `screenshots/games/game-created-${Date.now()}.png`,
      fullPage: true 
    });
  });

  test('게임 참가 및 취소 플로우', async ({ page }) => {
    // 기존 게임이 있다고 가정하고 Mock 데이터 설정
    await page.route('**/api/games', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'game-1',
            title: '저녁 복식 게임',
            type: 'doubles',
            date: '2024-01-20',
            time: '19:00',
            maxParticipants: 4,
            participants: ['user-2', 'user-3'],
            creator: 'user-2'
          }
        ])
      });
    });
    
    await page.goto('/games');
    
    // 1. 게임 목록에서 게임 선택
    await expect(page.locator('[data-testid="game-card-0"]')).toBeVisible();
    await page.click('[data-testid="game-card-0"]');
    
    // 2. 게임 상세 정보 확인
    await expect(page.locator('text=저녁 복식 게임')).toBeVisible();
    await expect(page.locator('text=2/4명')).toBeVisible();
    
    // 3. 게임 참가
    await expect(page.locator('[data-testid="join-game-button"]')).toBeVisible();
    await page.click('[data-testid="join-game-button"]');
    
    // 참가 확인 다이얼로그
    await expect(page.locator('[data-testid="join-confirmation-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-join-button"]');
    
    // 4. 참가 완료 확인
    await expect(page.locator('text=참가 완료')).toBeVisible();
    await expect(page.locator('text=3/4명')).toBeVisible();
    await expect(page.locator('[data-testid="leave-game-button"]')).toBeVisible();
    
    // 5. 게임 나가기 테스트
    await page.click('[data-testid="leave-game-button"]');
    await expect(page.locator('[data-testid="leave-confirmation-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-leave-button"]');
    
    // 나가기 완료 확인
    await expect(page.locator('[data-testid="join-game-button"]')).toBeVisible();
    await expect(page.locator('text=2/4명')).toBeVisible();
  });

  test('게임 정원 초과 시 대기열 기능', async ({ page }) => {
    // 정원이 가득찬 게임 Mock
    await page.route('**/api/games/full-game', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'full-game',
          title: '정원 가득찬 게임',
          maxParticipants: 4,
          participants: ['user-1', 'user-2', 'user-3', 'user-4'],
          waitingList: []
        })
      });
    });
    
    await page.goto('/games/full-game');
    
    // 대기열 참가 버튼 확인
    await expect(page.locator('[data-testid="join-waitlist-button"]')).toBeVisible();
    await page.click('[data-testid="join-waitlist-button"]');
    
    // 대기열 참가 완료 확인
    await expect(page.locator('text=대기열에 등록되었습니다')).toBeVisible();
    await expect(page.locator('[data-testid="waitlist-position"]')).toBeVisible();
  });
});
```

### 3. 실시간 채팅 시스템 테스트
```typescript
// tests/realtime/socket-chat-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('실시간 Socket.io 채팅 시스템', () => {
  test('다중 사용자 실시간 메시지 교환', async ({ browser }) => {
    // 두 개의 브라우저 컨텍스트 생성 (서로 다른 사용자)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // 사용자 1 로그인
    await page1.goto('/');
    await page1.evaluate(() => {
      localStorage.setItem('auth_token', 'user-1-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'user-1',
        name: '김철수'
      }));
    });
    
    // 사용자 2 로그인
    await page2.goto('/');
    await page2.evaluate(() => {
      localStorage.setItem('auth_token', 'user-2-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'user-2', 
        name: '이영희'
      }));
    });
    
    // 같은 채팅방으로 이동
    await page1.goto('/chat/game-room-1');
    await page2.goto('/chat/game-room-1');
    
    // Socket 연결 확인
    await expect(page1.locator('[data-testid="connection-status"]')).toHaveText('연결됨');
    await expect(page2.locator('[data-testid="connection-status"]')).toHaveText('연결됨');
    
    // 사용자 1이 메시지 전송
    const message1 = `테스트 메시지 ${Date.now()}`;
    await page1.fill('[data-testid="message-input"]', message1);
    await page1.press('[data-testid="message-input"]', 'Enter');
    
    // 사용자 2 화면에서 메시지 실시간 수신 확인
    await expect(page2.locator(`text=${message1}`)).toBeVisible({ timeout: 3000 });
    await expect(page2.locator('text=김철수')).toBeVisible();
    
    // 사용자 2가 답장
    const message2 = `답장 메시지 ${Date.now()}`;
    await page2.fill('[data-testid="message-input"]', message2);
    await page2.press('[data-testid="message-input"]', 'Enter');
    
    // 사용자 1 화면에서 답장 실시간 수신 확인
    await expect(page1.locator(`text=${message2}`)).toBeVisible({ timeout: 3000 });
    await expect(page1.locator('text=이영희')).toBeVisible();
    
    // 스크린샷 캡처 (두 사용자 화면)
    await page1.screenshot({ path: `screenshots/chat/user1-chat-${Date.now()}.png` });
    await page2.screenshot({ path: `screenshots/chat/user2-chat-${Date.now()}.png` });
    
    await context1.close();
    await context2.close();
  });

  test('네트워크 중단 시 자동 재연결', async ({ page }) => {
    await page.goto('/chat/test-room');
    
    // Socket 연결 확인
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결됨');
    
    // 네트워크 중단 시뮬레이션
    await page.context().setOffline(true);
    
    // 연결 끊김 상태 확인
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결 끊김', { timeout: 5000 });
    await expect(page.locator('[data-testid="reconnection-notice"]')).toBeVisible();
    
    // 네트워크 복구
    await page.context().setOffline(false);
    
    // 자동 재연결 확인
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결됨', { timeout: 10000 });
    await expect(page.locator('[data-testid="reconnection-notice"]')).not.toBeVisible();
    
    // 재연결 후 메시지 전송 가능 확인
    await page.fill('[data-testid="message-input"]', '재연결 테스트 메시지');
    await page.press('[data-testid="message-input"]', 'Enter');
    
    await expect(page.locator('text=재연결 테스트 메시지')).toBeVisible();
  });

  test('메시지 전송 실패 및 재시도', async ({ page }) => {
    await page.goto('/chat/test-room');
    
    // 서버 오류 시뮬레이션을 위한 네트워크 인터셉트
    await page.route('**/socket.io/**', (route) => {
      route.fulfill({ status: 500 });
    });
    
    // 메시지 전송 시도
    await page.fill('[data-testid="message-input"]', '실패 테스트 메시지');
    await page.press('[data-testid="message-input"]', 'Enter');
    
    // 전송 실패 표시 확인
    await expect(page.locator('[data-testid="message-failed"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // 네트워크 복구 후 재시도
    await page.unroute('**/socket.io/**');
    await page.click('[data-testid="retry-button"]');
    
    // 재전송 성공 확인
    await expect(page.locator('text=실패 테스트 메시지')).toBeVisible();
    await expect(page.locator('[data-testid="message-failed"]')).not.toBeVisible();
  });
});
```

## 🚀 성능 측정 및 모니터링

### Core Web Vitals 측정
```typescript
// tests/performance/web-vitals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Core Web Vitals 성능 측정', () => {
  test('메인 페이지 Core Web Vitals', async ({ page }) => {
    // Performance Observer 설정
    await page.addInitScript(() => {
      window.vitalsData = [];
      
      // CLS (Cumulative Layout Shift) 측정
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.vitalsData.push({
              name: 'CLS',
              value: entry.value,
              timestamp: entry.startTime
            });
          }
        }
      }).observe({ entryTypes: ['layout-shift'] });
      
      // LCP (Largest Contentful Paint) 측정
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.vitalsData.push({
          name: 'LCP',
          value: lastEntry.startTime,
          timestamp: Date.now()
        });
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    });
    
    const startTime = Date.now();
    await page.goto('/');
    
    // 페이지 완전 로드 대기
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // 성능 지표 수집
    const vitalsData = await page.evaluate(() => window.vitalsData);
    
    // Core Web Vitals 검증
    const lcp = vitalsData.find(v => v.name === 'LCP')?.value || 0;
    const cls = vitalsData.reduce((sum, v) => v.name === 'CLS' ? sum + v.value : sum, 0);
    
    // 성능 기준 확인
    expect(lcp).toBeLessThan(2500); // LCP < 2.5초
    expect(cls).toBeLessThan(0.1);  // CLS < 0.1
    expect(loadTime).toBeLessThan(3000); // 전체 로드 < 3초
    
    console.log(`성능 지표 - LCP: ${lcp}ms, CLS: ${cls}, Load Time: ${loadTime}ms`);
  });

  test('게임 목록 페이지 가상화 성능', async ({ page }) => {
    // 대량 데이터 Mock
    await page.route('**/api/games', (route) => {
      const games = Array.from({ length: 1000 }, (_, i) => ({
        id: `game-${i}`,
        title: `게임 ${i + 1}`,
        participants: Math.floor(Math.random() * 4),
        maxParticipants: 4
      }));
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(games)
      });
    });
    
    const startTime = Date.now();
    await page.goto('/games');
    
    // 가상화된 리스트 로드 완료 대기
    await expect(page.locator('[data-testid="game-list"]')).toBeVisible();
    await page.waitForFunction(() => {
      const gameCards = document.querySelectorAll('[data-testid^="game-card-"]');
      return gameCards.length >= 10; // 초기 렌더링된 아이템들
    });
    
    const renderTime = Date.now() - startTime;
    
    // 렌더링 성능 확인 (대용량 데이터에도 빠른 렌더링)
    expect(renderTime).toBeLessThan(2000);
    
    // 스크롤 성능 테스트
    const scrollStart = Date.now();
    await page.mouse.wheel(0, 5000); // 빠른 스크롤
    await page.waitForTimeout(500);
    const scrollTime = Date.now() - scrollStart;
    
    expect(scrollTime).toBeLessThan(1000); // 스크롤 반응성
  });
});
```

### API 응답 시간 모니터링
```typescript
// tests/performance/api-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API 성능 모니터링', () => {
  test('주요 API 엔드포인트 응답 시간', async ({ page }) => {
    const apiMetrics = [];
    
    // API 호출 인터셉트하여 성능 측정
    await page.route('**/api/**', async (route) => {
      const startTime = Date.now();
      const response = await route.fetch();
      const endTime = Date.now();
      
      apiMetrics.push({
        url: route.request().url(),
        method: route.request().method(),
        duration: endTime - startTime,
        status: response.status()
      });
      
      await route.fulfill({ response });
    });
    
    await page.goto('/');
    
    // 주요 페이지 탐색하여 API 호출 유발
    await page.click('[data-testid="games-tab"]');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="members-tab"]');
    await page.waitForLoadState('networkidle');
    
    // API 성능 분석
    const slowApis = apiMetrics.filter(api => api.duration > 1000);
    const failedApis = apiMetrics.filter(api => api.status >= 400);
    
    console.log('API 성능 분석:', {
      totalApis: apiMetrics.length,
      averageTime: apiMetrics.reduce((sum, api) => sum + api.duration, 0) / apiMetrics.length,
      slowApis: slowApis.length,
      failedApis: failedApis.length
    });
    
    // 성능 기준 검증
    expect(slowApis.length).toBeLessThan(apiMetrics.length * 0.1); // 10% 이하가 느림
    expect(failedApis.length).toBe(0); // 실패한 API 없음
    
    // 중요 API들의 응답 시간 확인
    const criticalApis = apiMetrics.filter(api => 
      api.url.includes('/games') || 
      api.url.includes('/auth') ||
      api.url.includes('/members')
    );
    
    criticalApis.forEach(api => {
      expect(api.duration).toBeLessThan(500); // 중요 API는 500ms 이내
    });
  });
});
```

## 📸 시각적 회귀 테스트

```typescript
// tests/visual/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('시각적 회귀 테스트', () => {
  test('메인 화면 시각적 일관성', async ({ page }) => {
    await page.goto('/');
    
    // 로딩 완료 대기
    await page.waitForLoadState('networkidle');
    
    // 시각적 비교 (기준 스크린샷과 비교)
    await expect(page).toHaveScreenshot('main-screen.png', {
      fullPage: true,
      threshold: 0.2 // 20% 차이까지 허용
    });
  });

  test('다크 모드 일관성', async ({ page }) => {
    await page.goto('/');
    
    // 다크 모드 활성화
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(1000); // 테마 전환 애니메이션 대기
    
    await expect(page).toHaveScreenshot('main-screen-dark.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('반응형 디자인 일관성', async ({ page }) => {
    // 모바일 뷰포트
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('main-screen-mobile.png', {
      fullPage: true
    });
    
    // 태블릿 뷰포트
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('main-screen-tablet.png', {
      fullPage: true
    });
    
    // 데스크톱 뷰포트
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('main-screen-desktop.png', {
      fullPage: true
    });
  });
});
```

## 🌐 네트워크 조건 시뮬레이션

```typescript
// tests/network/network-conditions.spec.ts
import { test, expect } from '@playwright/test';

test.describe('네트워크 조건 시뮬레이션', () => {
  test('느린 3G 환경에서 사용성', async ({ page, context }) => {
    // Slow 3G 네트워크 시뮬레이션
    await context.route('**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 지연
      await route.continue();
    });
    
    const startTime = Date.now();
    await page.goto('/');
    
    // 로딩 인디케이터 확인
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // 페이지 로드 완료 대기
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // 느린 네트워크에서도 합리적인 시간 내 로드
    expect(loadTime).toBeLessThan(10000); // 10초 이내
    
    // 캐시된 리소스로 인한 빠른 네비게이션 확인
    const navStart = Date.now();
    await page.click('[data-testid="games-tab"]');
    await page.waitForLoadState('networkidle');
    const navTime = Date.now() - navStart;
    
    expect(navTime).toBeLessThan(5000); // 캐시 효과로 더 빠름
  });

  test('오프라인 상태 처리', async ({ page, context }) => {
    await page.goto('/');
    
    // 오프라인으로 전환
    await context.setOffline(true);
    
    // 오프라인 알림 확인
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
    
    // 캐시된 데이터로 기본 기능 사용 가능 확인
    await page.click('[data-testid="games-tab"]');
    await expect(page.locator('[data-testid="cached-games-notice"]')).toBeVisible();
    
    // 온라인 복구
    await context.setOffline(false);
    
    // 자동 동기화 확인
    await expect(page.locator('[data-testid="sync-complete-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-banner"]')).not.toBeVisible();
  });

  test('네트워크 간헐적 중단 복구', async ({ page, context }) => {
    await page.goto('/');
    
    // 간헐적 네트워크 중단 시뮬레이션
    let requestCount = 0;
    await context.route('**/api/**', async route => {
      requestCount++;
      
      // 매 3번째 요청마다 실패 시뮬레이션
      if (requestCount % 3 === 0) {
        await route.fulfill({ status: 500 });
        return;
      }
      
      await route.continue();
    });
    
    // API 호출이 필요한 액션 수행
    await page.click('[data-testid="refresh-button"]');
    
    // 자동 재시도 메커니즘 확인
    await expect(page.locator('[data-testid="retry-notice"]')).toBeVisible();
    
    // 최종적으로 성공 확인
    await expect(page.locator('[data-testid="data-loaded"]')).toBeVisible({ timeout: 10000 });
  });
});
```

## 🎯 접근성 (a11y) 검증

```typescript
// tests/accessibility/a11y-compliance.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('접근성 (WCAG 2.1 AA) 검증', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  test('메인 화면 접근성 준수', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('키보드 네비게이션 완전성', async ({ page }) => {
    // Tab 키로 모든 인터랙티브 요소 순회
    const focusableElements = [];
    
    let currentElement = null;
    let tabCount = 0;
    const maxTabs = 20; // 무한 루프 방지
    
    do {
      await page.keyboard.press('Tab');
      tabCount++;
      
      currentElement = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused ? {
          tagName: focused.tagName,
          id: focused.id,
          className: focused.className,
          textContent: focused.textContent?.trim()
        } : null;
      });
      
      if (currentElement) {
        focusableElements.push(currentElement);
      }
    } while (currentElement && tabCount < maxTabs);
    
    // 모든 중요한 UI 요소가 키보드로 접근 가능한지 확인
    const importantElements = [
      'login-button',
      'games-tab', 
      'members-tab',
      'create-game-fab'
    ];
    
    importantElements.forEach(elementId => {
      const found = focusableElements.some(el => el.id === elementId);
      expect(found, `${elementId}가 키보드로 접근 불가능`).toBeTruthy();
    });
  });

  test('스크린 리더 지원', async ({ page }) => {
    // ARIA 레이블 검증
    const gameCard = page.locator('[data-testid="game-card-0"]');
    await expect(gameCard).toHaveAttribute('role', 'button');
    await expect(gameCard).toHaveAttribute('aria-label');
    
    // 폼 레이블 연결 확인
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('aria-describedby');
    
    // 에러 메시지 ARIA 알림
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.keyboard.press('Tab');
    
    const errorMessage = page.locator('[data-testid="email-error"]');
    await expect(errorMessage).toHaveAttribute('role', 'alert');
    await expect(errorMessage).toHaveAttribute('aria-live', 'polite');
  });

  test('색상 대비 확인', async ({ page }) => {
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    
    // 고대비 모드 테스트
    await page.emulateMedia({ colorScheme: 'dark' });
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
  });
});
```

## 🚀 CI/CD 파이프라인 통합

### GitHub Actions 워크플로
```yaml
# .github/workflows/playwright-e2e.yml
name: Playwright E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # 매일 새벽 2시 실행

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        device: [desktop, mobile]
    
    services:
      mongodb:
        image: mongo:5.0
        ports:
          - 27017:27017
        env:
          MONGO_INITDB_ROOT_USERNAME: test
          MONGO_INITDB_ROOT_PASSWORD: test
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start services
        run: |
          # 백엔드 서비스들 시작
          npm run start:backend &
          npm run start:socket &
          npm run start:band-integration &
          
          # React Native Expo 서버 시작
          npm run start:expo &
          
          # 서비스 시작 대기
          npx wait-on http://localhost:8081
          npx wait-on http://localhost:3001
          npx wait-on http://localhost:3002
          npx wait-on http://localhost:3003
        
      - name: Run Playwright tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          CI: true
          DEVICE_TYPE: ${{ matrix.device }}
          TEST_BAND_USERNAME: ${{ secrets.TEST_BAND_USERNAME }}
          TEST_BAND_PASSWORD: ${{ secrets.TEST_BAND_PASSWORD }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results-${{ matrix.browser }}-${{ matrix.device }}
          path: |
            test-results/
            playwright-report/
            screenshots/
      
      - name: Upload to GitHub Pages
        if: always()
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./playwright-report
          destination_dir: reports/${{ github.run_number }}

  performance-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Start services
        run: |
          npm run start:all &
          npx wait-on http://localhost:8081
      
      - name: Run performance tests
        run: npx playwright test tests/performance/ --project=chromium
      
      - name: Generate performance report
        run: |
          node scripts/generate-performance-report.js
      
      - name: Comment PR with performance results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('performance-report.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🚀 Performance Test Results\n\n${report}`
            });

  visual-regression:
    runs-on: ubuntu-latest
    needs: e2e-tests
    
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # 전체 기록 필요
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Start services
        run: |
          npm run start:all &
          npx wait-on http://localhost:8081
      
      - name: Run visual regression tests
        run: npx playwright test tests/visual/ --project=chromium
      
      - name: Compare screenshots
        if: failure()
        run: |
          echo "Visual regression detected!"
          ls -la test-results/
      
      - name: Upload visual diff artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-regression-diffs
          path: test-results/

  accessibility-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright and axe
        run: |
          npx playwright install chromium
          npm install @axe-core/playwright axe-playwright
      
      - name: Start services
        run: |
          npm run start:all &
          npx wait-on http://localhost:8081
      
      - name: Run accessibility tests
        run: npx playwright test tests/accessibility/ --project=chromium
      
      - name: Generate accessibility report
        run: |
          node scripts/generate-a11y-report.js
      
      - name: Fail if accessibility violations
        run: |
          if grep -q "Accessibility violations found" accessibility-report.txt; then
            echo "❌ Accessibility violations detected!"
            cat accessibility-report.txt
            exit 1
          else
            echo "✅ No accessibility violations found"
          fi
```

## 📊 테스트 결과 리포팅 및 분석

### 커스텀 리포터
```typescript
// scripts/custom-playwright-reporter.ts
import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

class YameyameReporter implements Reporter {
  private testResults: Array<{
    test: string;
    status: string;
    duration: number;
    browser: string;
    device: string;
    errors?: string[];
  }> = [];

  onTestEnd(test: TestCase, result: TestResult) {
    this.testResults.push({
      test: test.title,
      status: result.status,
      duration: result.duration,
      browser: test.parent.project()?.name || 'unknown',
      device: process.env.DEVICE_TYPE || 'desktop',
      errors: result.errors.map(error => error.message)
    });
  }

  onEnd(result: FullResult) {
    // Slack 알림 전송
    this.sendSlackNotification(result);
    
    // 성능 지표 수집
    this.generatePerformanceReport();
    
    // 시각적 회귀 분석
    this.analyzeVisualRegressions();
    
    // 접근성 위반사항 요약
    this.summarizeAccessibilityIssues();
  }

  private async sendSlackNotification(result: FullResult) {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'passed').length;
    const failedTests = this.testResults.filter(t => t.status === 'failed').length;
    
    const message = {
      text: `🎯 yameyame E2E 테스트 결과`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*전체:* ${totalTests}  *성공:* ${passedTests}  *실패:* ${failedTests}`
          }
        },
        {
          type: "section", 
          fields: [
            {
              type: "mrkdwn",
              text: `*성공률:* ${Math.round(passedTests / totalTests * 100)}%`
            },
            {
              type: "mrkdwn",
              text: `*평균 실행 시간:* ${this.getAverageDuration()}ms`
            }
          ]
        }
      ]
    };
    
    // Slack 웹훅으로 전송
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  }

  private generatePerformanceReport() {
    const performanceTests = this.testResults.filter(t => t.test.includes('performance'));
    
    const report = {
      timestamp: new Date().toISOString(),
      averageLoadTime: this.calculateAverageMetric(performanceTests, 'loadTime'),
      coreWebVitals: this.extractCoreWebVitals(),
      apiResponseTimes: this.extractApiMetrics()
    };
    
    // 파일로 저장
    require('fs').writeFileSync(
      'performance-report.json', 
      JSON.stringify(report, null, 2)
    );
  }

  private analyzeVisualRegressions() {
    const visualTests = this.testResults.filter(t => t.test.includes('visual'));
    const regressions = visualTests.filter(t => t.status === 'failed');
    
    if (regressions.length > 0) {
      console.log(`⚠️  ${regressions.length}개의 시각적 회귀 감지`);
      regressions.forEach(r => {
        console.log(`  - ${r.test} (${r.browser})`);
      });
    }
  }

  private getAverageDuration(): number {
    const total = this.testResults.reduce((sum, t) => sum + t.duration, 0);
    return Math.round(total / this.testResults.length);
  }
}

export default YameyameReporter;
```

## 🎯 최종 결과물 요약

### 구현된 기능들
✅ **Playwright MCP 설정**: 자동 활성화 및 다중 MCP 서버 조정  
✅ **크로스 브라우저 테스트**: Chrome, Firefox, Safari + 모바일 디바이스  
✅ **핵심 사용자 여정**: 인증, 게임 관리, 실시간 채팅  
✅ **실시간 Socket.io 테스트**: 다중 사용자, 네트워크 중단 복구  
✅ **성능 측정**: Core Web Vitals, API 응답 시간, 로드 성능  
✅ **시각적 회귀 테스트**: 다크모드, 반응형, 일관성 검증  
✅ **네트워크 시뮬레이션**: Slow 3G, 오프라인, 간헐적 중단  
✅ **접근성 검증**: WCAG 2.1 AA 준수, 키보드, 스크린리더  
✅ **CI/CD 통합**: GitHub Actions, 자동 리포팅, Slack 알림

### 성능 기준 및 품질 게이트
- **로드 성능**: LCP < 2.5초, CLS < 0.1, 전체 로드 < 3초
- **API 성능**: 중요 API < 500ms, 전체 API < 1초
- **시각적 일관성**: 스크린샷 차이 < 20%
- **접근성**: WCAG 2.1 AA 100% 준수
- **브라우저 지원**: Chrome, Firefox, Safari 완전 호환

### 지속적 개선 프로세스
1. **일일 자동 실행**: 새벽 2시 전체 테스트 스위트 실행
2. **PR 검증**: 모든 풀 리퀘스트에서 핵심 테스트 실행
3. **성능 모니터링**: 성능 저하 시 즉시 알림
4. **시각적 회귀**: 디자인 변경 시 자동 감지
5. **사용자 피드백**: 실제 테스트 시나리오 기반 지속 개선

이 종합적인 Playwright MCP E2E 테스트 전략을 통해 yameyame 프로젝트의 품질과 안정성을 크게 향상시킬 수 있습니다.