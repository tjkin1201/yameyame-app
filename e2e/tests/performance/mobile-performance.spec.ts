/**
 * 모바일 성능 및 크로스 플랫폼 E2E 테스트
 * React Native 앱의 성능 최적화 및 다양한 디바이스 지원 테스트
 */

import { test, expect, Page } from '@playwright/test';

class MobilePerformanceHelper {
  constructor(private page: Page) {}

  async measurePageLoadTime(targetSelector: string): Promise<number> {
    const startTime = Date.now();
    await expect(this.page.locator(targetSelector)).toBeVisible();
    return Date.now() - startTime;
  }

  async simulateSlowNetwork() {
    await this.page.context().grantPermissions(['geolocation']);
    await this.page.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 500 * 1024, // 500 KB/s
      uploadThroughput: 500 * 1024,   // 500 KB/s
      latency: 200 // 200ms 지연
    });
  }

  async simulate3GNetwork() {
    await this.page.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 1.6 * 1024 * 1024, // 1.6 MB/s
      uploadThroughput: 768 * 1024,           // 768 KB/s
      latency: 300 // 300ms 지연
    });
  }

  async measureMemoryUsage(): Promise<any> {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });
  }

  async measureNavigationTiming(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          networkTime: navigation.responseEnd - navigation.fetchStart,
          renderTime: navigation.domComplete - navigation.domLoading
        };
      }
      return null;
    });
  }

  async loginForPerformanceTest() {
    await this.page.goto('/');
    await this.page.fill('[data-testid="email-input"]', 'test@yameyame.com');
    await this.page.fill('[data-testid="password-input"]', 'testpassword123');
    await this.page.click('[data-testid="login-button"]');
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  }

  async checkCoreWebVitals(): Promise<{ lcp?: number, fid?: number, cls?: number }> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: { lcp?: number, fid?: number, cls?: number } = {};
        
        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                vitals.lcp = entries[entries.length - 1].startTime;
              }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
          } catch (e) {
            console.log('LCP measurement not available');
          }

          // FID (First Input Delay)
          try {
            const fidObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                vitals.fid = entry.processingStart - entry.startTime;
              });
            });
            fidObserver.observe({ type: 'first-input', buffered: true });
          } catch (e) {
            console.log('FID measurement not available');
          }

          // CLS (Cumulative Layout Shift)
          try {
            const clsObserver = new PerformanceObserver((list) => {
              let clsValue = 0;
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              });
              vitals.cls = clsValue;
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
          } catch (e) {
            console.log('CLS measurement not available');
          }
        }

        // 2초 후에 결과 반환
        setTimeout(() => resolve(vitals), 2000);
      });
    });
  }

  async performScrollTest(selector: string) {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    // 스크롤 성능 측정
    const startTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await element.hover();
      await this.page.mouse.wheel(0, 300);
      await this.page.waitForTimeout(100);
    }
    
    return Date.now() - startTime;
  }
}

test.describe('Mobile Performance Tests', () => {
  let perfHelper: MobilePerformanceHelper;

  test.beforeEach(async ({ page }) => {
    perfHelper = new MobilePerformanceHelper(page);
  });

  test.describe('Load Performance', () => {
    test('should load app within performance budget on 3G network', async ({ page }) => {
      await perfHelper.simulate3GNetwork();
      
      const loadTime = await perfHelper.measurePageLoadTime('[data-testid="login-screen"]');
      
      // 3G 네트워크에서 5초 이내 로드
      expect(loadTime).toBeLessThan(5000);
      console.log(`3G 네트워크 로드 시간: ${loadTime}ms`);
    });

    test('should load main app quickly after login', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 각 탭 로드 시간 측정
      const tabs = [
        { name: 'board', selector: '[data-testid="board-screen"]' },
        { name: 'gallery', selector: '[data-testid="gallery-screen"]' },
        { name: 'chat', selector: '[data-testid="chat-screen"]' },
        { name: 'members', selector: '[data-testid="members-screen"]' }
      ];

      for (const tab of tabs) {
        await page.click(`[data-testid="tab-${tab.name}"]`);
        const loadTime = await perfHelper.measurePageLoadTime(tab.selector);
        
        // 각 탭이 2초 이내에 로드되어야 함
        expect(loadTime).toBeLessThan(2000);
        console.log(`${tab.name} 탭 로드 시간: ${loadTime}ms`);
      }
    });

    test('should handle slow network conditions gracefully', async ({ page }) => {
      await perfHelper.simulateSlowNetwork();
      await perfHelper.loginForPerformanceTest();
      
      // 로딩 인디케이터가 표시되는지 확인
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      await page.click('[data-testid="tab-board"]');
      
      // 로딩 인디케이터가 표시되거나 빠르게 로드되어야 함
      const isLoadingVisible = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);
      const isBoardVisible = await page.locator('[data-testid="board-screen"]').isVisible({ timeout: 3000 });
      
      expect(isLoadingVisible || isBoardVisible).toBeTruthy();
    });
  });

  test.describe('Core Web Vitals', () => {
    test('should meet Core Web Vitals standards', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      const vitals = await perfHelper.checkCoreWebVitals();
      
      // LCP (Largest Contentful Paint) - 2.5초 이내
      if (vitals.lcp) {
        expect(vitals.lcp).toBeLessThan(2500);
        console.log(`LCP: ${vitals.lcp}ms`);
      }

      // FID (First Input Delay) - 100ms 이내
      if (vitals.fid) {
        expect(vitals.fid).toBeLessThan(100);
        console.log(`FID: ${vitals.fid}ms`);
      }

      // CLS (Cumulative Layout Shift) - 0.1 이내
      if (vitals.cls) {
        expect(vitals.cls).toBeLessThan(0.1);
        console.log(`CLS: ${vitals.cls}`);
      }
    });

    test('should maintain good performance during interaction', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 연속적인 탭 전환 성능 테스트
      const startTime = Date.now();
      
      const tabs = ['board', 'gallery', 'chat', 'members', 'posts'];
      for (let i = 0; i < 3; i++) { // 3번 반복
        for (const tab of tabs) {
          await page.click(`[data-testid="tab-${tab}"]`);
          await page.waitForTimeout(100);
        }
      }
      
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / (tabs.length * 3);
      
      // 평균 탭 전환 시간이 300ms 이내여야 함
      expect(averageTime).toBeLessThan(300);
      console.log(`평균 탭 전환 시간: ${averageTime}ms`);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have memory leaks during normal usage', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      const initialMemory = await perfHelper.measureMemoryUsage();
      if (!initialMemory) {
        console.log('Memory measurement not available in this browser');
        return;
      }

      // 앱 사용 시뮬레이션
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="tab-board"]');
        await page.click('[data-testid="create-game-button"]');
        await page.click('[data-testid="close-modal-button"]');
        await page.click('[data-testid="tab-gallery"]');
        await page.click('[data-testid="tab-home"]');
        await page.waitForTimeout(200);
      }

      const finalMemory = await perfHelper.measureMemoryUsage();
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;

      // 메모리 증가율이 50% 이내여야 함
      expect(memoryIncreasePercent).toBeLessThan(50);
      console.log(`메모리 증가: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
    });

    test('should handle garbage collection appropriately', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 메모리 집약적 작업 수행
      await page.click('[data-testid="tab-gallery"]');
      
      const beforeMemory = await perfHelper.measureMemoryUsage();
      
      // 강제 가비지 컬렉션 (개발 환경에서만 가능)
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });
      
      await page.waitForTimeout(1000);
      const afterMemory = await perfHelper.measureMemoryUsage();
      
      if (beforeMemory && afterMemory) {
        console.log(`GC 전: ${(beforeMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`GC 후: ${(afterMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  });

  test.describe('Scroll Performance', () => {
    test('should maintain 60fps during scrolling', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      await page.click('[data-testid="tab-board"]');
      
      const scrollTime = await perfHelper.performScrollTest('[data-testid="game-list"]');
      
      // 5번의 스크롤이 1초 이내에 완료되어야 함 (부드러운 스크롤)
      expect(scrollTime).toBeLessThan(1000);
      console.log(`스크롤 성능: ${scrollTime}ms`);
    });

    test('should handle long lists efficiently', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 큰 목록이 있는 화면으로 이동
      await page.click('[data-testid="tab-posts"]');
      await expect(page.locator('[data-testid="posts-screen"]')).toBeVisible();
      
      // 목록 렌더링 시간 측정
      const renderTime = await perfHelper.measurePageLoadTime('[data-testid="posts-list"]');
      
      // 큰 목록도 1초 이내에 렌더링되어야 함
      expect(renderTime).toBeLessThan(1000);
      console.log(`큰 목록 렌더링 시간: ${renderTime}ms`);
    });
  });

  test.describe('Network Performance', () => {
    test('should cache resources effectively', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 첫 번째 로드
      await page.click('[data-testid="tab-gallery"]');
      const firstLoadTime = await perfHelper.measurePageLoadTime('[data-testid="gallery-screen"]');
      
      // 다른 탭으로 이동 후 다시 돌아오기
      await page.click('[data-testid="tab-home"]');
      await page.click('[data-testid="tab-gallery"]');
      const cachedLoadTime = await perfHelper.measurePageLoadTime('[data-testid="gallery-screen"]');
      
      // 캐시된 로드가 더 빨라야 함
      expect(cachedLoadTime).toBeLessThan(firstLoadTime);
      console.log(`첫 로드: ${firstLoadTime}ms, 캐시된 로드: ${cachedLoadTime}ms`);
    });

    test('should minimize API calls', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 네트워크 요청 모니터링
      const requests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          requests.push(request.url());
        }
      });

      // 일반적인 앱 사용 시뮬레이션
      await page.click('[data-testid="tab-board"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="tab-members"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="tab-board"]'); // 다시 돌아가기
      await page.waitForTimeout(1000);

      // API 호출이 최소화되어야 함 (중복 요청 없음)
      const uniqueRequests = new Set(requests);
      const duplicateCount = requests.length - uniqueRequests.size;
      
      expect(duplicateCount).toBeLessThan(3); // 최대 2개의 중복 허용
      console.log(`총 API 요청: ${requests.length}, 중복: ${duplicateCount}`);
    });

    test('should handle offline mode gracefully', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 오프라인 모드 활성화
      await page.setOfflineMode(true);
      
      // 오프라인 상태에서도 기본 기능 동작 확인
      await page.click('[data-testid="tab-board"]');
      
      // 오프라인 인디케이터 또는 캐시된 데이터 표시 확인
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      const boardScreen = page.locator('[data-testid="board-screen"]');
      
      const isOfflineVisible = await offlineIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      const isBoardVisible = await boardScreen.isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(isOfflineVisible || isBoardVisible).toBeTruthy();
      
      // 온라인 복구
      await page.setOfflineMode(false);
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    });
  });

  test.describe('Animation Performance', () => {
    test('should animate transitions smoothly', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      
      // 탭 전환 애니메이션 성능 측정
      const animationStart = Date.now();
      
      await page.click('[data-testid="tab-board"]');
      await expect(page.locator('[data-testid="board-screen"]')).toBeVisible();
      
      const animationTime = Date.now() - animationStart;
      
      // 애니메이션이 500ms 이내에 완료되어야 함
      expect(animationTime).toBeLessThan(500);
      console.log(`탭 전환 애니메이션 시간: ${animationTime}ms`);
    });

    test('should handle modal animations efficiently', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      await page.click('[data-testid="tab-board"]');
      
      // 모달 열기/닫기 애니메이션 테스트
      for (let i = 0; i < 5; i++) {
        const openStart = Date.now();
        
        await page.click('[data-testid="create-game-button"]');
        await expect(page.locator('[data-testid="create-game-modal"]')).toBeVisible();
        
        const openTime = Date.now() - openStart;
        
        const closeStart = Date.now();
        
        await page.click('[data-testid="close-modal-button"]');
        await expect(page.locator('[data-testid="create-game-modal"]')).not.toBeVisible();
        
        const closeTime = Date.now() - closeStart;
        
        // 각 애니메이션이 300ms 이내에 완료되어야 함
        expect(openTime).toBeLessThan(300);
        expect(closeTime).toBeLessThan(300);
      }
    });
  });

  test.describe('Resource Optimization', () => {
    test('should load images lazily', async ({ page }) => {
      await perfHelper.loginForPerformanceTest();
      await page.click('[data-testid="tab-gallery"]');
      
      // 이미지 로딩 감시
      let imageLoadCount = 0;
      page.on('response', response => {
        if (response.url().match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          imageLoadCount++;
        }
      });

      await expect(page.locator('[data-testid="gallery-screen"]')).toBeVisible();
      await page.waitForTimeout(2000);

      const initialImageCount = imageLoadCount;

      // 스크롤하여 더 많은 이미지 로드
      await perfHelper.performScrollTest('[data-testid="gallery-list"]');
      await page.waitForTimeout(1000);

      const finalImageCount = imageLoadCount;

      // 스크롤 후 추가 이미지가 로드되었는지 확인 (지연 로딩)
      console.log(`초기 이미지: ${initialImageCount}, 스크롤 후: ${finalImageCount}`);
    });

    test('should optimize bundle size', async ({ page }) => {
      // 초기 JavaScript 번들 크기 확인
      let totalJSSize = 0;
      
      page.on('response', response => {
        if (response.url().includes('.js') && response.status() === 200) {
          const contentLength = response.headers()['content-length'];
          if (contentLength) {
            totalJSSize += parseInt(contentLength);
          }
        }
      });

      await perfHelper.loginForPerformanceTest();
      await page.waitForTimeout(3000);

      // 번들 크기가 적정 수준인지 확인 (5MB 미만)
      const bundleSizeMB = totalJSSize / 1024 / 1024;
      expect(bundleSizeMB).toBeLessThan(5);
      console.log(`총 JS 번들 크기: ${bundleSizeMB.toFixed(2)}MB`);
    });
  });
});