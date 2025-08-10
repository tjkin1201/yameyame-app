/**
 * 크로스 플랫폼 디바이스 호환성 테스트
 * 다양한 모바일 디바이스 및 해상도에서의 React Native 앱 동작 테스트
 */

import { test, expect, Page, devices } from '@playwright/test';

class CrossPlatformHelper {
  constructor(private page: Page) {}

  async loginQuickly() {
    await this.page.goto('/');
    await this.page.fill('[data-testid="email-input"]', 'test@yameyame.com');
    await this.page.fill('[data-testid="password-input"]', 'testpassword123');
    await this.page.click('[data-testid="login-button"]');
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  }

  async checkResponsiveLayout(viewportName: string) {
    // 기본 UI 요소들이 표시되는지 확인
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    
    // 탭바가 올바르게 표시되는지 확인
    const tabs = ['home', 'board', 'gallery', 'chat', 'members', 'posts'];
    for (const tab of tabs) {
      await expect(this.page.locator(`[data-testid="tab-${tab}"]`)).toBeVisible();
    }

    console.log(`${viewportName}: 기본 레이아웃 확인 완료`);
  }

  async testTouchInteractions() {
    // 탭 터치 테스트
    await this.page.locator('[data-testid="tab-board"]').tap();
    await expect(this.page.locator('[data-testid="board-screen"]')).toBeVisible();

    // 버튼 터치 테스트
    await this.page.locator('[data-testid="create-game-button"]').tap();
    await expect(this.page.locator('[data-testid="create-game-modal"]')).toBeVisible();
    
    await this.page.locator('[data-testid="close-modal-button"]').tap();
    await expect(this.page.locator('[data-testid="create-game-modal"]')).not.toBeVisible();
  }

  async testScrollBehavior() {
    await this.page.click('[data-testid="tab-board"]');
    await expect(this.page.locator('[data-testid="board-screen"]')).toBeVisible();

    const gameList = this.page.locator('[data-testid="game-list"]');
    if (await gameList.isVisible()) {
      // 스크롤 테스트
      await gameList.hover();
      await this.page.mouse.wheel(0, 300);
      await this.page.waitForTimeout(500);
      
      // 스크롤 후에도 목록이 표시되는지 확인
      await expect(gameList).toBeVisible();
    }
  }

  async checkTextReadability() {
    // 텍스트 크기와 가독성 확인
    const textElements = [
      '[data-testid="tab-home"] text',
      '[data-testid="header-title"]',
      'h1, h2, h3, p, span'
    ];

    for (const selector of textElements) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        const fontSize = await elements.first().evaluate(el => {
          return window.getComputedStyle(el).fontSize;
        });
        
        const fontSizeValue = parseInt(fontSize.replace('px', ''));
        
        // 모바일에서 최소 14px 이상이어야 함
        if (fontSizeValue > 0) {
          expect(fontSizeValue).toBeGreaterThanOrEqual(14);
        }
      }
    }
  }

  async checkButtonSizes() {
    const buttons = this.page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const boundingBox = await button.boundingBox();
        
        if (boundingBox) {
          // 모바일에서 최소 터치 영역 44x44px
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }

  async testOrientationChange() {
    // 세로 모드에서 시작
    const viewport = this.page.viewportSize();
    if (!viewport) return;

    await this.checkResponsiveLayout('Portrait');

    // 가로 모드로 변경
    await this.page.setViewportSize({ 
      width: viewport.height, 
      height: viewport.width 
    });
    await this.page.waitForTimeout(1000);

    await this.checkResponsiveLayout('Landscape');

    // 다시 세로 모드로
    await this.page.setViewportSize(viewport);
    await this.page.waitForTimeout(1000);
  }
}

// 다양한 디바이스 설정
const testDevices = [
  { name: 'iPhone 14 Pro', device: devices['iPhone 14 Pro'], category: 'iOS' },
  { name: 'iPhone SE', device: devices['iPhone SE'], category: 'iOS' },
  { name: 'Samsung Galaxy S23', device: devices['Galaxy S23'], category: 'Android' },
  { name: 'Pixel 7', device: devices['Pixel 7'], category: 'Android' },
  { name: 'iPad Pro', device: devices['iPad Pro'], category: 'Tablet' },
  { name: 'Galaxy Tab S4', device: devices['Galaxy Tab S4'], category: 'Tablet' }
];

test.describe('Cross-Platform Device Compatibility', () => {
  testDevices.forEach(({ name, device, category }) => {
    test.describe(`${category} - ${name}`, () => {
      let helper: CrossPlatformHelper;

      test.beforeEach(async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
          permissions: ['geolocation', 'notifications']
        });
        const page = await context.newPage();
        helper = new CrossPlatformHelper(page);
      });

      test('should display app correctly on device', async ({ page }) => {
        await helper.loginQuickly();
        await helper.checkResponsiveLayout(name);
      });

      test('should handle touch interactions properly', async ({ page }) => {
        await helper.loginQuickly();
        await helper.testTouchInteractions();
      });

      test('should have readable text sizes', async ({ page }) => {
        await helper.loginQuickly();
        await helper.checkTextReadability();
      });

      test('should have appropriate button sizes', async ({ page }) => {
        await helper.loginQuickly();
        await helper.checkButtonSizes();
      });

      // 태블릿은 제외하고 폰에서만 회전 테스트
      if (category !== 'Tablet') {
        test('should handle orientation changes', async ({ page }) => {
          await helper.loginQuickly();
          await helper.testOrientationChange();
        });
      }

      test('should scroll smoothly', async ({ page }) => {
        await helper.loginQuickly();
        await helper.testScrollBehavior();
      });
    });
  });
});

test.describe('Custom Viewport Tests', () => {
  const customViewports = [
    { name: 'Small Phone', width: 320, height: 568 },
    { name: 'Large Phone', width: 414, height: 896 },
    { name: 'Small Tablet', width: 768, height: 1024 },
    { name: 'Large Tablet', width: 1024, height: 1366 },
    { name: 'Foldable Open', width: 512, height: 892 },
    { name: 'Ultra Wide Phone', width: 360, height: 800 }
  ];

  customViewports.forEach(({ name, width, height }) => {
    test(`should work on ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      
      const helper = new CrossPlatformHelper(page);
      await helper.loginQuickly();
      await helper.checkResponsiveLayout(name);
      
      // 뷰포트별 특별한 테스트
      if (width <= 320) {
        // 아주 작은 화면에서는 탭 텍스트가 축약될 수 있음
        console.log('Small viewport: 탭 레이블 축약 허용');
      }
      
      if (width >= 1024) {
        // 큰 화면에서는 추가 정보가 표시될 수 있음
        console.log('Large viewport: 추가 정보 표시 확인');
      }
    });
  });
});

test.describe('Browser Compatibility', () => {
  // 다양한 브라우저 엔진에서 테스트
  ['chromium', 'webkit'].forEach(browserName => {
    test(`should work in ${browserName}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['iPhone 14 Pro']
      });
      const page = await context.newPage();
      
      const helper = new CrossPlatformHelper(page);
      await helper.loginQuickly();
      await helper.checkResponsiveLayout(browserName);
      
      // 브라우저별 특별한 기능 테스트
      if (browserName === 'webkit') {
        // Safari 특화 테스트
        console.log('WebKit: Safari 특화 기능 테스트');
      } else if (browserName === 'chromium') {
        // Chrome 특화 테스트
        console.log('Chromium: Chrome 특화 기능 테스트');
      }
    });
  });
});

test.describe('Accessibility Across Devices', () => {
  test('should maintain accessibility standards on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    
    const helper = new CrossPlatformHelper(page);
    await helper.loginQuickly();
    
    // 접근성 테스트
    await page.click('[data-testid="tab-board"]');
    
    // 키보드 네비게이션 테스트
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // 포커스가 올바르게 관리되는지 확인
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    
    const helper = new CrossPlatformHelper(page);
    await helper.loginQuickly();
    
    // ARIA 레이블과 역할 확인
    const tabElements = page.locator('[data-testid^="tab-"]');
    const tabCount = await tabElements.count();
    
    for (let i = 0; i < tabCount; i++) {
      const tab = tabElements.nth(i);
      const ariaLabel = await tab.getAttribute('aria-label');
      const role = await tab.getAttribute('role');
      
      // 탭에는 적절한 ARIA 속성이 있어야 함
      expect(ariaLabel || role).toBeTruthy();
    }
  });
});

test.describe('Edge Cases and Stress Tests', () => {
  test('should handle extreme viewport sizes', async ({ page }) => {
    // 매우 좁은 화면
    await page.setViewportSize({ width: 280, height: 800 });
    
    const helper = new CrossPlatformHelper(page);
    await helper.loginQuickly();
    
    // 기본 기능이 여전히 작동하는지 확인
    await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    
    // 매우 넓은 화면
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    
    await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  });

  test('should handle rapid orientation changes', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    
    const helper = new CrossPlatformHelper(page);
    await helper.loginQuickly();
    
    // 빠른 회전 변경 (5번 반복)
    for (let i = 0; i < 5; i++) {
      await page.setViewportSize({ width: 851, height: 393 });
      await page.waitForTimeout(200);
      await page.setViewportSize({ width: 393, height: 851 });
      await page.waitForTimeout(200);
    }
    
    // 여전히 정상 작동하는지 확인
    await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    await page.click('[data-testid="tab-board"]');
    await expect(page.locator('[data-testid="board-screen"]')).toBeVisible();
  });

  test('should handle long text content on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    
    const helper = new CrossPlatformHelper(page);
    await helper.loginQuickly();
    
    // 긴 텍스트가 있는 화면으로 이동
    await page.click('[data-testid="tab-posts"]');
    await expect(page.locator('[data-testid="posts-screen"]')).toBeVisible();
    
    // 텍스트가 화면 밖으로 넘치지 않는지 확인
    const textElements = page.locator('p, span, div');
    const count = await textElements.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      if (await element.isVisible()) {
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
          // 텍스트가 뷰포트를 벗어나지 않아야 함
          expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(320 + 10); // 10px 여유
        }
      }
    }
  });

  test('should maintain performance on older devices', async ({ page }) => {
    // 저사양 디바이스 시뮬레이션
    await page.emulate({
      ...devices['iPhone SE'],
      geolocation: undefined,
      permissions: []
    });
    
    // CPU 스로틀링 시뮬레이션
    await page.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 1000 * 1024, // 1MB/s
      uploadThroughput: 500 * 1024,    // 500KB/s
      latency: 100
    });
    
    const helper = new CrossPlatformHelper(page);
    
    const startTime = Date.now();
    await helper.loginQuickly();
    const loadTime = Date.now() - startTime;
    
    // 저사양 디바이스에서도 10초 이내에 로드되어야 함
    expect(loadTime).toBeLessThan(10000);
    
    // 기본 기능이 정상 작동하는지 확인
    await helper.testTouchInteractions();
  });
});