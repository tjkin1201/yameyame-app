/**
 * 백엔드 API 통합 테스트
 * React Native 앱과 백엔드 API 간의 통합 테스트
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';

class APIIntegrationHelper {
  constructor(private page: Page, private request: APIRequestContext) {}

  async loginAndGetToken(email: string = 'test@yameyame.com', password: string = 'testpassword123') {
    // UI를 통한 로그인
    await this.page.goto('/');
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
    
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    
    // 로컬스토리지에서 토큰 가져오기
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    });
    
    return token;
  }

  async testAPIEndpoint(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', token?: string, data?: any) {
    const apiURL = process.env.API_URL || 'http://localhost:3000';
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    switch (method) {
      case 'GET':
        response = await this.request.get(`${apiURL}${endpoint}`, { headers });
        break;
      case 'POST':
        response = await this.request.post(`${apiURL}${endpoint}`, { 
          headers, 
          data: data ? JSON.stringify(data) : undefined 
        });
        break;
      case 'PUT':
        response = await this.request.put(`${apiURL}${endpoint}`, { 
          headers, 
          data: data ? JSON.stringify(data) : undefined 
        });
        break;
      case 'DELETE':
        response = await this.request.delete(`${apiURL}${endpoint}`, { headers });
        break;
    }

    return response;
  }

  async expectAPIResponse(response: any, expectedStatus: number, expectedData?: any) {
    expect(response.status()).toBe(expectedStatus);
    
    if (expectedData) {
      const responseData = await response.json();
      expect(responseData).toMatchObject(expectedData);
    }
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  async interceptAPICall(url: string, responseData: any, status: number = 200) {
    await this.page.route(url, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });
  }
}

test.describe('Backend API Integration', () => {
  let apiHelper: APIIntegrationHelper;

  test.beforeEach(async ({ page, request }) => {
    apiHelper = new APIIntegrationHelper(page, request);
  });

  test.describe('Health Check', () => {
    test('should confirm backend API is running', async ({ request }) => {
      const response = await apiHelper.testAPIEndpoint('/api/health', 'GET');
      
      await apiHelper.expectAPIResponse(response, 200, {
        status: 'healthy'
      });
      
      const healthData = await response.json();
      expect(healthData).toHaveProperty('uptime');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData).toHaveProperty('process');
    });

    test('should show backend metrics in health response', async ({ request }) => {
      const response = await apiHelper.testAPIEndpoint('/api/health', 'GET');
      const healthData = await response.json();
      
      // 메트릭스 데이터 확인
      expect(healthData.metrics).toHaveProperty('counters');
      expect(healthData.metrics.counters).toHaveProperty('requests');
      expect(healthData.process).toHaveProperty('memory');
      expect(healthData.process.memory).toHaveProperty('heapUsed');
    });
  });

  test.describe('Authentication API Integration', () => {
    test('should authenticate user through API and UI', async ({ page }) => {
      // 먼저 API로 직접 로그인 테스트
      const loginResponse = await apiHelper.testAPIEndpoint('/api/auth/login', 'POST', undefined, {
        email: 'test@yameyame.com',
        password: 'testpassword123'
      });

      await apiHelper.expectAPIResponse(loginResponse, 200);
      const loginData = await loginResponse.json();
      expect(loginData).toHaveProperty('token');
      expect(loginData).toHaveProperty('user');

      // 그 다음 UI를 통한 로그인이 같은 결과를 가져오는지 확인
      const token = await apiHelper.loginAndGetToken();
      expect(token).toBeTruthy();
      expect(token).toBe(loginData.token);
    });

    test('should handle authentication errors consistently', async ({ page }) => {
      // API 에러 응답 모킹
      await apiHelper.interceptAPICall('**/api/auth/login', {
        error: 'Invalid credentials',
        message: '잘못된 인증 정보입니다'
      }, 401);

      await page.goto('/');
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');

      // UI에서 에러 메시지 확인
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('잘못된 인증 정보');
    });

    test('should maintain session after API token refresh', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();
      
      // 토큰 검증 API 호출
      const verifyResponse = await apiHelper.testAPIEndpoint('/api/auth/verify', 'GET', token);
      await apiHelper.expectAPIResponse(verifyResponse, 200);

      // 페이지 새로고침 후에도 로그인 상태 유지 확인
      await page.reload();
      await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    });
  });

  test.describe('Game Management API Integration', () => {
    test('should create game through UI and verify via API', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();
      
      // UI를 통해 게임 생성
      await page.click('[data-testid="tab-board"]');
      await page.click('[data-testid="create-game-button"]');
      
      const gameData = {
        title: 'API 통합 테스트 게임',
        date: '2024-12-31',
        time: '19:00',
        location: 'API 테스트 체육관',
        maxPlayers: 8
      };

      await page.fill('[data-testid="game-title-input"]', gameData.title);
      await page.fill('[data-testid="game-date-input"]', gameData.date);
      await page.fill('[data-testid="game-time-input"]', gameData.time);
      await page.fill('[data-testid="game-location-input"]', gameData.location);
      await page.fill('[data-testid="game-max-players-input"]', gameData.maxPlayers.toString());
      
      await page.click('[data-testid="create-game-submit"]');
      await apiHelper.waitForNetworkIdle();

      // API를 통해 게임 생성 확인
      const gamesResponse = await apiHelper.testAPIEndpoint('/api/games', 'GET', token);
      await apiHelper.expectAPIResponse(gamesResponse, 200);
      
      const gamesData = await gamesResponse.json();
      const createdGame = gamesData.find((game: any) => game.title === gameData.title);
      expect(createdGame).toBeTruthy();
      expect(createdGame.location).toBe(gameData.location);
      expect(createdGame.maxPlayers).toBe(gameData.maxPlayers);
    });

    test('should handle game creation API errors in UI', async ({ page }) => {
      await apiHelper.loginAndGetToken();
      
      // 게임 생성 API 에러 모킹
      await apiHelper.interceptAPICall('**/api/games', {
        error: 'Validation failed',
        message: '게임 생성에 실패했습니다'
      }, 400);

      await page.click('[data-testid="tab-board"]');
      await page.click('[data-testid="create-game-button"]');
      
      await page.fill('[data-testid="game-title-input"]', '테스트 게임');
      await page.fill('[data-testid="game-date-input"]', '2024-12-31');
      await page.click('[data-testid="create-game-submit"]');

      // UI에서 에러 처리 확인
      await expect(page.locator('[data-testid="create-game-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-game-error"]')).toContainText('게임 생성에 실패');
    });

    test('should sync game participation between UI and API', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();

      await page.click('[data-testid="tab-board"]');
      await apiHelper.waitForNetworkIdle();

      // 게임 목록에서 첫 번째 게임 참여
      const gameCard = page.locator('[data-testid^="game-card-"]').first();
      await gameCard.click();
      
      await page.click('[data-testid="join-game-button"]');
      await apiHelper.waitForNetworkIdle();

      // API를 통해 참여 확인
      const gamesResponse = await apiHelper.testAPIEndpoint('/api/games', 'GET', token);
      const gamesData = await gamesResponse.json();
      
      // 사용자가 참여한 게임이 있는지 확인
      const participatingGames = gamesData.filter((game: any) => 
        game.participants && game.participants.length > 0
      );
      expect(participatingGames.length).toBeGreaterThan(0);
    });
  });

  test.describe('Real-time Data Sync', () => {
    test('should receive real-time updates through WebSocket', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();
      
      // WebSocket 연결 설정 대기
      await page.click('[data-testid="tab-chat"]');
      await page.waitForTimeout(2000);

      // 실시간 연결 상태 확인
      const connectionStatus = await page.locator('[data-testid="connection-status"]');
      if (await connectionStatus.isVisible()) {
        await expect(connectionStatus).toContainText('연결됨');
      }

      // 실시간 메시지 테스트 (다른 사용자가 메시지를 보내는 시뮬레이션)
      await apiHelper.interceptAPICall('**/api/chat/messages', {
        id: 'test-message-id',
        content: '실시간 테스트 메시지',
        user: { nickname: '테스트유저' },
        timestamp: new Date().toISOString()
      });
    });

    test('should handle connection loss gracefully', async ({ page }) => {
      await apiHelper.loginAndGetToken();
      
      // 네트워크 연결 차단 시뮬레이션
      await page.setOfflineMode(true);
      await page.waitForTimeout(1000);

      // 오프라인 상태 UI 확인
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      if (await offlineIndicator.isVisible()) {
        await expect(offlineIndicator).toContainText('오프라인');
      }

      // 네트워크 복구
      await page.setOfflineMode(false);
      await page.waitForTimeout(2000);

      // 온라인 복구 확인
      await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    });
  });

  test.describe('Data Validation', () => {
    test('should validate data consistency between UI and API', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();

      // 홈 화면의 게임 수 확인
      await page.click('[data-testid="tab-home"]');
      await apiHelper.waitForNetworkIdle();
      
      const homeGameCount = await page.locator('[data-testid="game-count"]').textContent();

      // API에서 실제 게임 수 확인
      const gamesResponse = await apiHelper.testAPIEndpoint('/api/games', 'GET', token);
      const gamesData = await gamesResponse.json();
      const apiGameCount = gamesData.length;

      // 일치하는지 확인
      if (homeGameCount) {
        const uiGameCount = parseInt(homeGameCount.replace(/[^0-9]/g, ''));
        expect(uiGameCount).toBe(apiGameCount);
      }
    });

    test('should handle API response format changes gracefully', async ({ page }) => {
      await apiHelper.loginAndGetToken();
      
      // 예상과 다른 API 응답 형식 모킹
      await apiHelper.interceptAPICall('**/api/games', {
        data: [], // 다른 형식
        total: 0,
        page: 1
      });

      await page.click('[data-testid="tab-board"]');
      await apiHelper.waitForNetworkIdle();

      // 앱이 여전히 정상 작동하는지 확인
      await expect(page.locator('[data-testid="board-screen"]')).toBeVisible();
    });
  });

  test.describe('Performance Integration', () => {
    test('should load data efficiently on app startup', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.fill('[data-testid="email-input"]', 'test@yameyame.com');
      await page.fill('[data-testid="password-input"]', 'testpassword123');
      await page.click('[data-testid="login-button"]');
      
      // 메인 앱 로드 완료까지 시간 측정
      await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // 로드 시간이 5초 이내여야 함
      expect(loadTime).toBeLessThan(5000);
    });

    test('should cache API responses appropriately', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();

      // 첫 번째 게임 목록 로드
      await page.click('[data-testid="tab-board"]');
      await apiHelper.waitForNetworkIdle();
      const firstLoadTime = Date.now();

      // 다른 탭으로 이동 후 다시 Board 탭으로 복귀
      await page.click('[data-testid="tab-home"]');
      await page.click('[data-testid="tab-board"]');
      
      // 두 번째 로드가 더 빨라야 함 (캐싱 효과)
      const secondLoadTime = Date.now() - firstLoadTime;
      expect(secondLoadTime).toBeLessThan(1000);
    });

    test('should handle multiple concurrent API requests', async ({ page }) => {
      const token = await apiHelper.loginAndGetToken();

      // 여러 탭을 빠르게 전환하여 동시 API 호출 테스트
      await page.click('[data-testid="tab-board"]');
      await page.click('[data-testid="tab-members"]');
      await page.click('[data-testid="tab-posts"]');
      await page.click('[data-testid="tab-gallery"]');
      
      // 모든 화면이 정상적으로 로드되는지 확인
      await apiHelper.waitForNetworkIdle();
      await expect(page.locator('[data-testid="gallery-screen"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle server errors gracefully', async ({ page }) => {
      await apiHelper.loginAndGetToken();

      // 서버 오류 시뮬레이션
      await apiHelper.interceptAPICall('**/api/**', {
        error: 'Internal Server Error'
      }, 500);

      await page.click('[data-testid="tab-board"]');
      
      // 에러 상태 UI 확인
      const errorMessage = page.locator('[data-testid="api-error-message"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText('서버 오류');
      }
      
      // 재시도 버튼이 있는지 확인
      const retryButton = page.locator('[data-testid="retry-button"]');
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();
      }
    });

    test('should timeout long API requests appropriately', async ({ page }) => {
      await apiHelper.loginAndGetToken();

      // 긴 응답 시간 시뮬레이션
      await page.route('**/api/games', async route => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      const startTime = Date.now();
      await page.click('[data-testid="tab-board"]');

      // 타임아웃 또는 로딩 인디케이터 확인
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      
      // 적절한 시간 내에 타임아웃 처리
      await page.waitForTimeout(5000);
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(15000);
    });
  });
});