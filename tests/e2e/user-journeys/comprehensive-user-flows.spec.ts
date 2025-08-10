/**
 * yameyame 종합 사용자 여정 E2E 테스트
 * Comprehensive User Journey E2E Tests for yameyame
 * 
 * Playwright MCP 기반 크로스 브라우저 + 실시간 기능 테스트
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// 테스트 유틸리티 함수들
class YameyameTestUtils {
  
  static async loginUser(page: Page, userType: 'member' | 'admin' | 'newbie' = 'member') {
    const users = {
      member: { id: 'user-1', name: '김철수', token: 'member-token' },
      admin: { id: 'admin-1', name: '관리자', token: 'admin-token' },
      newbie: { id: 'newbie-1', name: '신입회원', token: 'newbie-token' }
    };
    
    const user = users[userType];
    await page.evaluate((userData) => {
      localStorage.setItem('auth_token', userData.token);
      localStorage.setItem('user_profile', JSON.stringify(userData));
    }, user);
    
    return user;
  }

  static async waitForSocketConnection(page: Page) {
    await page.waitForFunction(() => {
      return window.socketConnected === true;
    }, { timeout: 10000 });
  }

  static async measurePagePerformance(page: Page, pageName: string) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        domLoad: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        windowLoad: navigation.loadEventEnd - navigation.navigationStart
      };
    });
    
    console.log(`📊 ${pageName} 성능 지표:`, metrics);
    return metrics;
  }
}

test.describe('🎯 yameyame 핵심 사용자 여정', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock API 응답 설정
    await page.route('**/api/health', (route) => {
      route.fulfill({ 
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', timestamp: Date.now() })
      });
    });
    
    // Socket.io 연결 시뮬레이션
    await page.addInitScript(() => {
      window.socketConnected = false;
      setTimeout(() => { window.socketConnected = true; }, 1000);
    });
  });

  test('🚀 전체 사용자 여정: 로그인 → 게임 생성 → 참가 → 채팅 → 완료', async ({ page }) => {
    test.slow(); // 이 테스트는 시간이 오래 걸림
    
    console.log('🎬 전체 사용자 여정 시작...');
    
    // === 1. 앱 시작 및 로그인 ===
    const journeyStart = Date.now();
    await page.goto('/');
    
    // 초기 로딩 성능 측정
    await YameyameTestUtils.measurePagePerformance(page, '앱 시작');
    
    // 로그인 화면 확인
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="naver-band-login-button"]')).toBeVisible();
    
    // 네이버 밴드 로그인 클릭
    await page.click('[data-testid="naver-band-login-button"]');
    
    // Mock OAuth 플로우 (실제 환경에서는 실제 OAuth)
    await page.route('**/auth/band/callback**', (route) => {
      route.fulfill({
        status: 302,
        headers: {
          'Location': '/home?auth=success'
        }
      });
    });
    
    // 로그인 성공 후 홈 화면으로 이동
    await YameyameTestUtils.loginUser(page, 'member');
    await page.goto('/home');
    
    // === 2. 홈 화면에서 게임 현황 확인 ===
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="today-games-section"]')).toBeVisible();
    
    // Socket 연결 대기
    await YameyameTestUtils.waitForSocketConnection(page);
    await expect(page.locator('[data-testid="socket-status"]')).toHaveText('연결됨');
    
    // === 3. 새 게임 생성 ===
    await page.click('[data-testid="create-game-fab"]');
    await expect(page.locator('[data-testid="game-create-form"]')).toBeVisible();
    
    // 게임 정보 입력
    const testGameTitle = `E2E 테스트 게임 ${Date.now()}`;
    await page.fill('[data-testid="game-title-input"]', testGameTitle);
    await page.selectOption('[data-testid="game-type-select"]', 'doubles');
    
    // 날짜/시간 설정 (내일 저녁 7시)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.fill('[data-testid="game-time-input"]', '19:00');
    
    // 참가자 수 및 코트 설정
    await page.selectOption('[data-testid="max-participants-select"]', '4');
    await page.selectOption('[data-testid="court-select"]', 'court-a');
    
    // 게임 생성
    await page.click('[data-testid="create-game-submit"]');
    
    // 생성 완료 확인
    await expect(page.locator('[data-testid="game-created-success"]')).toBeVisible();
    await expect(page.locator(`text=${testGameTitle}`)).toBeVisible();
    
    // === 4. 다른 사용자가 게임에 참가 (새 브라우저 컨텍스트) ===
    const context2 = await page.context().browser()?.newContext();
    const page2 = await context2!.newPage();
    
    // 두 번째 사용자로 로그인
    await YameyameTestUtils.loginUser(page2, 'newbie');
    await page2.goto('/games');
    
    // 생성된 게임 찾기 및 참가
    await page2.click(`[data-testid="game-card"]:has-text("${testGameTitle}")`);
    await expect(page2.locator('[data-testid="game-details"]')).toBeVisible();
    
    await page2.click('[data-testid="join-game-button"]');
    await page2.click('[data-testid="confirm-join-button"]');
    
    // 참가 완료 확인
    await expect(page2.locator('[data-testid="join-success-message"]')).toBeVisible();
    
    // === 5. 실시간 채팅 테스트 ===
    // 첫 번째 사용자가 채팅방 입장
    await page.click(`[data-testid="game-chat-button"]:has-text("채팅")`);
    await expect(page.locator('[data-testid="chat-room"]')).toBeVisible();
    
    // 두 번째 사용자도 같은 채팅방 입장
    await page2.click('[data-testid="game-chat-button"]');
    await expect(page2.locator('[data-testid="chat-room"]')).toBeVisible();
    
    // 실시간 메시지 교환
    const message1 = `안녕하세요! ${Date.now()}`;
    await page.fill('[data-testid="chat-input"]', message1);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // 두 번째 사용자 화면에서 메시지 수신 확인 (실시간)
    await expect(page2.locator(`text=${message1}`)).toBeVisible({ timeout: 5000 });
    
    // 답장 보내기
    const message2 = `네, 반갑습니다! ${Date.now()}`;
    await page2.fill('[data-testid="chat-input"]', message2);
    await page2.press('[data-testid="chat-input"]', 'Enter');
    
    // 첫 번째 사용자 화면에서 답장 수신 확인
    await expect(page.locator(`text=${message2}`)).toBeVisible({ timeout: 5000 });
    
    // === 6. 게임 체크인 시뮬레이션 ===
    // QR 코드 체크인 (Mock)
    await page.click('[data-testid="checkin-button"]');
    
    // 위치 기반 체크인 시뮬레이션
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 37.5665, // 서울시청 좌표 (테스트용)
            longitude: 126.9780,
            accuracy: 10
          }
        });
      };
    });
    
    await page.click('[data-testid="location-checkin-button"]');
    await expect(page.locator('[data-testid="checkin-success"]')).toBeVisible();
    
    // === 7. 게임 진행 및 점수 입력 ===
    await page.click('[data-testid="start-game-button"]');
    await expect(page.locator('[data-testid="game-in-progress"]')).toBeVisible();
    
    // 점수 입력 (21-19로 승부)
    for (let i = 0; i < 21; i++) {
      await page.click('[data-testid="team-a-score-plus"]');
    }
    for (let i = 0; i < 19; i++) {
      await page.click('[data-testid="team-b-score-plus"]');
    }
    
    // 게임 완료
    await page.click('[data-testid="finish-game-button"]');
    await expect(page.locator('[data-testid="game-finished"]')).toBeVisible();
    
    // 결과 확인
    await expect(page.locator('text=21 - 19')).toBeVisible();
    await expect(page.locator('[data-testid="winner-announcement"]')).toBeVisible();
    
    // === 8. 게임 후 피드백 및 다음 게임 예약 ===
    await page.fill('[data-testid="game-feedback-input"]', '좋은 게임이었습니다!');
    await page.click('[data-testid="submit-feedback-button"]');
    
    // 다음 게임 일정 확인
    await page.click('[data-testid="view-upcoming-games"]');
    await expect(page.locator('[data-testid="upcoming-games-list"]')).toBeVisible();
    
    // === 성능 및 품질 검증 ===
    const journeyEnd = Date.now();
    const totalJourneyTime = journeyEnd - journeyStart;
    
    console.log(`⏱️  전체 사용자 여정 완료 시간: ${totalJourneyTime}ms`);
    expect(totalJourneyTime).toBeLessThan(60000); // 1분 이내 완료
    
    // 스크린샷 캡처
    await page.screenshot({ 
      path: `screenshots/complete-journey-user1-${Date.now()}.png`,
      fullPage: true 
    });
    await page2.screenshot({ 
      path: `screenshots/complete-journey-user2-${Date.now()}.png`,
      fullPage: true 
    });
    
    // 정리
    await context2?.close();
    
    console.log('✅ 전체 사용자 여정 테스트 완료');
  });

  test('📱 모바일 사용자 체육관 현장 시나리오', async ({ page, context }) => {
    // 모바일 디바이스 에뮬레이션
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
      });
    });
    
    // 위치 서비스 Mock
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.5665, longitude: 126.9780 });
    
    await YameyameTestUtils.loginUser(page, 'member');
    await page.goto('/home');
    
    // === 체육관 도착 체크인 시나리오 ===
    console.log('📍 체육관 도착 체크인 시나리오 시작...');
    
    // QR 코드 스캔 시뮬레이션
    await page.click('[data-testid="qr-scan-button"]');
    
    // 카메라 권한 Mock
    await page.evaluate(() => {
      navigator.mediaDevices = {
        getUserMedia: async () => {
          return new MediaStream();
        }
      };
    });
    
    // QR 스캔 성공 시뮬레이션
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { gameId: 'test-game-1', location: 'gym-a' }
      }));
    });
    
    await expect(page.locator('[data-testid="qr-scan-success"]')).toBeVisible();
    
    // === 게임 중 점수 입력 (스트레스 테스트) ===
    console.log('🏸 게임 중 긴급 점수 입력 시나리오...');
    
    // 화면 진동 시뮬레이션 (체육관 환경)
    await page.addInitScript(() => {
      let shakeCount = 0;
      setInterval(() => {
        if (shakeCount < 10) {
          document.body.style.transform = `translate(${Math.random() * 2}px, ${Math.random() * 2}px)`;
          shakeCount++;
        }
      }, 100);
    });
    
    // 빠른 점수 입력 (10초 제한)
    const scoreInputStart = Date.now();
    
    await page.click('[data-testid="quick-score-entry"]');
    await page.click('[data-testid="team-a-win-button"]', { force: true });
    await page.click('[data-testid="confirm-score-button"]');
    
    const scoreInputTime = Date.now() - scoreInputStart;
    expect(scoreInputTime).toBeLessThan(10000); // 10초 이내 입력
    
    await expect(page.locator('[data-testid="score-recorded"]')).toBeVisible();
    
    console.log(`⚡ 긴급 점수 입력 시간: ${scoreInputTime}ms`);
  });

  test('🌐 네트워크 불안정 환경 복구 테스트', async ({ page, context }) => {
    await YameyameTestUtils.loginUser(page, 'member');
    await page.goto('/games');
    
    console.log('📶 네트워크 불안정 환경 테스트 시작...');
    
    // === 오프라인 상태 처리 ===
    await context.setOffline(true);
    
    // 오프라인 알림 확인
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // 캐시된 데이터로 기본 기능 사용
    await page.click('[data-testid="cached-games-tab"]');
    await expect(page.locator('[data-testid="offline-games-list"]')).toBeVisible();
    
    // === 간헐적 네트워크 중단 시뮬레이션 ===
    await context.setOffline(false);
    
    let requestCount = 0;
    await page.route('**/api/**', async (route) => {
      requestCount++;
      
      // 매 3번째 요청마다 실패
      if (requestCount % 3 === 0) {
        await route.fulfill({ status: 500, body: 'Network Error' });
      } else {
        await route.continue();
      }
    });
    
    // API 호출이 필요한 액션 수행
    await page.click('[data-testid="refresh-games-button"]');
    
    // 자동 재시도 확인
    await expect(page.locator('[data-testid="retry-indicator"]')).toBeVisible();
    
    // 최종 성공 확인
    await expect(page.locator('[data-testid="games-loaded"]')).toBeVisible({ timeout: 15000 });
    
    console.log('✅ 네트워크 복구 테스트 완료');
  });

  test('🎮 관리자 권한 게임 관리 플로우', async ({ page }) => {
    await YameyameTestUtils.loginUser(page, 'admin');
    await page.goto('/admin');
    
    console.log('👨‍💼 관리자 게임 관리 테스트 시작...');
    
    // === 게임 현황 대시보드 ===
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="today-stats"]')).toBeVisible();
    
    // 통계 정보 확인
    const todayGames = await page.textContent('[data-testid="today-games-count"]');
    const activeMembers = await page.textContent('[data-testid="active-members-count"]');
    
    expect(Number(todayGames)).toBeGreaterThanOrEqual(0);
    expect(Number(activeMembers)).toBeGreaterThanOrEqual(0);
    
    // === 게임 강제 종료 시나리오 ===
    await page.click('[data-testid="ongoing-games-tab"]');
    
    const ongoingGame = page.locator('[data-testid="ongoing-game"]:first-child');
    if (await ongoingGame.isVisible()) {
      await ongoingGame.click();
      await page.click('[data-testid="admin-force-end-button"]');
      
      // 강제 종료 확인 다이얼로그
      await expect(page.locator('[data-testid="force-end-confirm"]')).toBeVisible();
      await page.fill('[data-testid="force-end-reason"]', '시설 정비로 인한 조기 종료');
      await page.click('[data-testid="confirm-force-end"]');
      
      // 게임 종료 및 알림 발송 확인
      await expect(page.locator('[data-testid="game-ended-notification"]')).toBeVisible();
    }
    
    // === 멤버 관리 ===
    await page.click('[data-testid="members-management-tab"]');
    await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
    
    // 새 멤버 수동 등록
    await page.click('[data-testid="add-member-button"]');
    await page.fill('[data-testid="member-name-input"]', '테스트 신규 멤버');
    await page.fill('[data-testid="member-phone-input"]', '010-1234-5678');
    await page.selectOption('[data-testid="member-role-select"]', 'member');
    
    await page.click('[data-testid="save-member-button"]');
    await expect(page.locator('text=테스트 신규 멤버')).toBeVisible();
    
    console.log('✅ 관리자 기능 테스트 완료');
  });

  test('💬 대용량 채팅방 성능 테스트', async ({ page, browser }) => {
    console.log('💬 대용량 채팅방 성능 테스트 시작...');
    
    // 5명의 동시 사용자 시뮬레이션
    const contexts = await Promise.all(
      Array.from({ length: 5 }, () => browser.newContext())
    );
    
    const pages = await Promise.all(
      contexts.map((context, index) => {
        return context.newPage().then(async (page) => {
          await YameyameTestUtils.loginUser(page, 'member');
          await page.goto('/chat/busy-room');
          return page;
        });
      })
    );
    
    // 모든 사용자가 채팅방에 입장 대기
    await Promise.all(
      pages.map(page => 
        expect(page.locator('[data-testid="chat-room"]')).toBeVisible()
      )
    );
    
    // 동시 메시지 전송 (부하 테스트)
    const messagePromises = pages.map(async (page, index) => {
      const message = `사용자 ${index + 1}의 메시지 ${Date.now()}`;
      
      await page.fill('[data-testid="chat-input"]', message);
      await page.press('[data-testid="chat-input"]', 'Enter');
      
      return message;
    });
    
    const sentMessages = await Promise.all(messagePromises);
    
    // 모든 사용자가 모든 메시지를 수신했는지 확인
    for (const page of pages) {
      for (const message of sentMessages) {
        await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
      }
    }
    
    // 메시지 순서 확인 (시간순)
    const messageElements = await pages[0].locator('[data-testid="chat-message"]').allTextContents();
    const messageTimestamps = messageElements
      .map(msg => msg.match(/\d{13}/)?.[0])
      .filter(Boolean)
      .map(Number);
    
    // 시간순 정렬 확인
    for (let i = 1; i < messageTimestamps.length; i++) {
      expect(messageTimestamps[i]).toBeGreaterThanOrEqual(messageTimestamps[i - 1]);
    }
    
    // 정리
    await Promise.all(contexts.map(context => context.close()));
    
    console.log('✅ 대용량 채팅방 성능 테스트 완료');
  });

  test('🔒 보안 및 권한 검증 테스트', async ({ page }) => {
    console.log('🔒 보안 테스트 시작...');
    
    // === 비로그인 사용자 접근 제한 ===
    await page.goto('/admin');
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    
    await page.goto('/games/create');
    await expect(page.locator('[data-testid="login-required"]')).toBeVisible();
    
    // === 일반 사용자 권한 제한 ===
    await YameyameTestUtils.loginUser(page, 'member');
    await page.goto('/admin');
    await expect(page.locator('[data-testid="insufficient-permission"]')).toBeVisible();
    
    // === XSS 방지 테스트 ===
    await page.goto('/games');
    const maliciousScript = '<script>alert("XSS")</script>';
    
    await page.fill('[data-testid="game-search-input"]', maliciousScript);
    await page.press('[data-testid="game-search-input"]', 'Enter');
    
    // 스크립트가 실행되지 않고 텍스트로 처리되는지 확인
    await expect(page.locator(`text=${maliciousScript}`)).toBeVisible();
    
    // === CSRF 방지 테스트 ===
    const csrfToken = await page.locator('[name="csrf-token"]').getAttribute('content');
    expect(csrfToken).toBeTruthy();
    
    console.log('✅ 보안 테스트 완료');
  });
});

test.describe('🌍 크로스 브라우저 호환성', () => {
  
  test('Safari 웹킷 엔진 호환성', async ({ page }) => {
    // WebKit 특화 기능 테스트
    await page.goto('/');
    
    // iOS Safari 제스처 시뮬레이션
    await page.touchscreen.tap(200, 300);
    await page.touchscreen.tap(400, 500);
    
    // PWA 설치 프롬프트 (Safari)
    const installPrompt = page.locator('[data-testid="pwa-install-safari"]');
    if (await installPrompt.isVisible()) {
      await installPrompt.click();
    }
    
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible();
  });

  test('Firefox Gecko 엔진 호환성', async ({ page }) => {
    // Firefox 특화 기능 테스트
    await page.goto('/');
    
    // Firefox 개발자 도구 시뮬레이션
    await page.keyboard.press('F12');
    
    // Service Worker 동작 확인
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistered).toBeTruthy();
  });
});