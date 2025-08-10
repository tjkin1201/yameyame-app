/**
 * yameyame 종합 성능 모니터링 및 측정 시스템
 * Comprehensive Performance Monitoring & Measurement System
 * 
 * Core Web Vitals, API 성능, 리소스 최적화, 사용자 경험 지표 종합 분석
 */

import { test, expect, Page } from '@playwright/test';

// 성능 모니터링 유틸리티 클래스
class PerformanceMonitor {
  
  static async injectPerformanceTracking(page: Page) {
    await page.addInitScript(() => {
      // 성능 지표 수집 객체
      window.performanceData = {
        coreWebVitals: {},
        apiMetrics: [],
        resourceMetrics: [],
        userInteractionMetrics: [],
        memoryMetrics: [],
        networkMetrics: []
      };

      // Core Web Vitals 측정
      const observeWebVitals = () => {
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          window.performanceData.coreWebVitals.lcp = {
            value: lastEntry.startTime,
            timestamp: Date.now(),
            element: lastEntry.element?.tagName || 'unknown'
          };
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // FID (First Input Delay)
        new PerformanceObserver((entryList) => {
          const firstEntry = entryList.getEntries()[0];
          window.performanceData.coreWebVitals.fid = {
            value: firstEntry.processingStart - firstEntry.startTime,
            timestamp: Date.now(),
            eventType: firstEntry.name
          };
        }).observe({ entryTypes: ['first-input'] });

        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              window.performanceData.coreWebVitals.cls = {
                value: clsValue,
                timestamp: Date.now(),
                sources: entry.sources?.length || 0
              };
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });

        // FCP (First Contentful Paint)
        new PerformanceObserver((entryList) => {
          const firstEntry = entryList.getEntries()[0];
          window.performanceData.coreWebVitals.fcp = {
            value: firstEntry.startTime,
            timestamp: Date.now()
          };
        }).observe({ entryTypes: ['paint'] });
      };

      // API 성능 추적
      const trackApiPerformance = () => {
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          const startTime = performance.now();
          const requestStart = Date.now();
          
          try {
            const response = await originalFetch.call(this, url, options);
            const endTime = performance.now();
            
            window.performanceData.apiMetrics.push({
              url: typeof url === 'string' ? url : url.url,
              method: options?.method || 'GET',
              status: response.status,
              duration: endTime - startTime,
              timestamp: requestStart,
              size: parseInt(response.headers.get('content-length') || '0'),
              cached: response.headers.get('x-cache') === 'HIT'
            });
            
            return response;
          } catch (error) {
            const endTime = performance.now();
            
            window.performanceData.apiMetrics.push({
              url: typeof url === 'string' ? url : url.url,
              method: options?.method || 'GET',
              status: 0,
              duration: endTime - startTime,
              timestamp: requestStart,
              error: error.message
            });
            
            throw error;
          }
        };
      };

      // 리소스 로딩 성능 추적
      const trackResourcePerformance = () => {
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.performanceData.resourceMetrics.push({
              name: entry.name,
              type: entry.initiatorType,
              size: entry.transferSize || 0,
              duration: entry.responseEnd - entry.startTime,
              cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
              timestamp: Date.now()
            });
          }
        }).observe({ entryTypes: ['resource'] });
      };

      // 사용자 인터랙션 성능 추적
      const trackUserInteractions = () => {
        ['click', 'input', 'scroll'].forEach(eventType => {
          document.addEventListener(eventType, (event) => {
            const startTime = performance.now();
            
            requestAnimationFrame(() => {
              const endTime = performance.now();
              
              window.performanceData.userInteractionMetrics.push({
                type: eventType,
                target: event.target.tagName,
                duration: endTime - startTime,
                timestamp: Date.now()
              });
            });
          });
        });
      };

      // 메모리 사용량 모니터링
      const trackMemoryUsage = () => {
        const measureMemory = () => {
          if (performance.memory) {
            window.performanceData.memoryMetrics.push({
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit,
              timestamp: Date.now()
            });
          }
        };

        measureMemory(); // 초기 측정
        setInterval(measureMemory, 5000); // 5초마다 측정
      };

      // 네트워크 상태 모니터링
      const trackNetworkMetrics = () => {
        if ('connection' in navigator) {
          const connection = navigator.connection;
          
          const recordNetworkInfo = () => {
            window.performanceData.networkMetrics.push({
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
              rtt: connection.rtt,
              saveData: connection.saveData,
              timestamp: Date.now()
            });
          };

          recordNetworkInfo(); // 초기 측정
          connection.addEventListener('change', recordNetworkInfo);
        }
      };

      // 모든 추적 시작
      observeWebVitals();
      trackApiPerformance();
      trackResourcePerformance();
      trackUserInteractions();
      trackMemoryUsage();
      trackNetworkMetrics();
    });
  }

  static async generatePerformanceReport(page: Page): Promise<any> {
    const data = await page.evaluate(() => window.performanceData);
    
    // Core Web Vitals 분석
    const webVitalsScore = this.analyzeWebVitals(data.coreWebVitals);
    
    // API 성능 분석
    const apiPerformance = this.analyzeApiPerformance(data.apiMetrics);
    
    // 리소스 최적화 분석
    const resourceAnalysis = this.analyzeResourceMetrics(data.resourceMetrics);
    
    // 사용자 인터랙션 분석
    const interactionAnalysis = this.analyzeInteractionMetrics(data.userInteractionMetrics);
    
    // 메모리 사용 분석
    const memoryAnalysis = this.analyzeMemoryMetrics(data.memoryMetrics);
    
    return {
      timestamp: Date.now(),
      webVitals: webVitalsScore,
      api: apiPerformance,
      resources: resourceAnalysis,
      interactions: interactionAnalysis,
      memory: memoryAnalysis,
      overall: this.calculateOverallScore([
        webVitalsScore.score,
        apiPerformance.score,
        resourceAnalysis.score,
        interactionAnalysis.score,
        memoryAnalysis.score
      ])
    };
  }

  private static analyzeWebVitals(vitals: any) {
    const scores = [];
    const issues = [];

    // LCP 분석 (2.5초 이내 Good, 4초 이내 Needs Improvement)
    if (vitals.lcp) {
      const lcpScore = vitals.lcp.value <= 2500 ? 100 : vitals.lcp.value <= 4000 ? 75 : 25;
      scores.push(lcpScore);
      if (lcpScore < 75) issues.push(`LCP too slow: ${vitals.lcp.value}ms`);
    }

    // FID 분석 (100ms 이내 Good, 300ms 이내 Needs Improvement)
    if (vitals.fid) {
      const fidScore = vitals.fid.value <= 100 ? 100 : vitals.fid.value <= 300 ? 75 : 25;
      scores.push(fidScore);
      if (fidScore < 75) issues.push(`FID too high: ${vitals.fid.value}ms`);
    }

    // CLS 분석 (0.1 이내 Good, 0.25 이내 Needs Improvement)
    if (vitals.cls) {
      const clsScore = vitals.cls.value <= 0.1 ? 100 : vitals.cls.value <= 0.25 ? 75 : 25;
      scores.push(clsScore);
      if (clsScore < 75) issues.push(`CLS too high: ${vitals.cls.value}`);
    }

    return {
      score: scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0,
      details: vitals,
      issues
    };
  }

  private static analyzeApiPerformance(apiMetrics: any[]) {
    if (!apiMetrics.length) return { score: 100, issues: [] };

    const avgDuration = apiMetrics.reduce((sum, m) => sum + m.duration, 0) / apiMetrics.length;
    const slowRequests = apiMetrics.filter(m => m.duration > 1000);
    const errorRequests = apiMetrics.filter(m => m.status >= 400);
    
    let score = 100;
    const issues = [];

    if (avgDuration > 500) {
      score -= 20;
      issues.push(`Average API response time too high: ${avgDuration.toFixed(2)}ms`);
    }

    if (slowRequests.length > apiMetrics.length * 0.1) {
      score -= 25;
      issues.push(`Too many slow requests: ${slowRequests.length}/${apiMetrics.length}`);
    }

    if (errorRequests.length > 0) {
      score -= 30;
      issues.push(`API errors detected: ${errorRequests.length} requests failed`);
    }

    return {
      score: Math.max(score, 0),
      avgDuration,
      totalRequests: apiMetrics.length,
      slowRequests: slowRequests.length,
      errorRequests: errorRequests.length,
      issues
    };
  }

  private static analyzeResourceMetrics(resourceMetrics: any[]) {
    if (!resourceMetrics.length) return { score: 100, issues: [] };

    const totalSize = resourceMetrics.reduce((sum, r) => sum + r.size, 0);
    const slowResources = resourceMetrics.filter(r => r.duration > 2000);
    const cacheHitRate = resourceMetrics.filter(r => r.cached).length / resourceMetrics.length;

    let score = 100;
    const issues = [];

    if (totalSize > 5 * 1024 * 1024) { // 5MB
      score -= 20;
      issues.push(`Total resource size too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    }

    if (slowResources.length > 0) {
      score -= 15;
      issues.push(`Slow resources detected: ${slowResources.length}`);
    }

    if (cacheHitRate < 0.7) {
      score -= 10;
      issues.push(`Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);
    }

    return {
      score: Math.max(score, 0),
      totalSize,
      resourceCount: resourceMetrics.length,
      slowResources: slowResources.length,
      cacheHitRate,
      issues
    };
  }

  private static analyzeInteractionMetrics(interactionMetrics: any[]) {
    if (!interactionMetrics.length) return { score: 100, issues: [] };

    const avgDuration = interactionMetrics.reduce((sum, i) => sum + i.duration, 0) / interactionMetrics.length;
    const slowInteractions = interactionMetrics.filter(i => i.duration > 16); // 60fps 기준

    let score = 100;
    const issues = [];

    if (avgDuration > 16) {
      score -= 25;
      issues.push(`Slow interactions detected: ${avgDuration.toFixed(2)}ms average`);
    }

    if (slowInteractions.length > interactionMetrics.length * 0.2) {
      score -= 15;
      issues.push(`Too many laggy interactions: ${slowInteractions.length}/${interactionMetrics.length}`);
    }

    return {
      score: Math.max(score, 0),
      avgDuration,
      totalInteractions: interactionMetrics.length,
      slowInteractions: slowInteractions.length,
      issues
    };
  }

  private static analyzeMemoryMetrics(memoryMetrics: any[]) {
    if (!memoryMetrics.length) return { score: 100, issues: [] };

    const initialMemory = memoryMetrics[0].used;
    const finalMemory = memoryMetrics[memoryMetrics.length - 1].used;
    const memoryGrowth = finalMemory - initialMemory;
    const maxMemory = Math.max(...memoryMetrics.map(m => m.used));

    let score = 100;
    const issues = [];

    if (memoryGrowth > 50 * 1024 * 1024) { // 50MB 증가
      score -= 20;
      issues.push(`Excessive memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    }

    if (maxMemory > 200 * 1024 * 1024) { // 200MB 최대
      score -= 15;
      issues.push(`High peak memory usage: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      score: Math.max(score, 0),
      initialMemory: Math.round(initialMemory / 1024 / 1024),
      finalMemory: Math.round(finalMemory / 1024 / 1024),
      memoryGrowth: Math.round(memoryGrowth / 1024 / 1024),
      maxMemory: Math.round(maxMemory / 1024 / 1024),
      issues
    };
  }

  private static calculateOverallScore(scores: number[]): number {
    return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
  }
}

test.describe('🚀 종합 성능 모니터링 및 최적화', () => {

  test.beforeEach(async ({ page }) => {
    await PerformanceMonitor.injectPerformanceTracking(page);
  });

  test('📊 Core Web Vitals 종합 분석', async ({ page }) => {
    console.log('📊 Core Web Vitals 측정 시작...');
    
    const startTime = Date.now();
    
    // 메인 페이지 로드 및 성능 측정
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // 사용자 인터랙션 시뮬레이션
    await page.click('[data-testid="games-tab"]');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="members-tab"]'); 
    await page.waitForLoadState('networkidle');
    
    // 스크롤 인터랙션
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);
    
    // 폼 입력 인터랙션
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.click();
      await searchInput.fill('성능 테스트 검색');
      await page.keyboard.press('Enter');
    }
    
    // 충분한 측정 시간 대기
    await page.waitForTimeout(3000);
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ 전체 측정 시간: ${totalTime}ms`);
    
    // 성능 리포트 생성
    const performanceReport = await PerformanceMonitor.generatePerformanceReport(page);
    
    console.log('📈 성능 리포트:', {
      전체점수: performanceReport.overall.toFixed(1),
      WebVitals점수: performanceReport.webVitals.score.toFixed(1),
      API점수: performanceReport.api.score.toFixed(1),
      리소스점수: performanceReport.resources.score.toFixed(1),
      인터랙션점수: performanceReport.interactions.score.toFixed(1),
      메모리점수: performanceReport.memory.score.toFixed(1)
    });
    
    // Core Web Vitals 기준 검증
    if (performanceReport.webVitals.details.lcp) {
      expect(performanceReport.webVitals.details.lcp.value).toBeLessThan(4000); // LCP < 4초
    }
    
    if (performanceReport.webVitals.details.fid) {
      expect(performanceReport.webVitals.details.fid.value).toBeLessThan(300); // FID < 300ms
    }
    
    if (performanceReport.webVitals.details.cls) {
      expect(performanceReport.webVitals.details.cls.value).toBeLessThan(0.25); // CLS < 0.25
    }
    
    // 전체 성능 점수 기준
    expect(performanceReport.overall).toBeGreaterThan(70); // 70점 이상
    
    // 성능 이슈가 있으면 상세 정보 출력
    const allIssues = [
      ...performanceReport.webVitals.issues,
      ...performanceReport.api.issues,
      ...performanceReport.resources.issues,
      ...performanceReport.interactions.issues,
      ...performanceReport.memory.issues
    ];
    
    if (allIssues.length > 0) {
      console.log('⚠️ 성능 이슈 발견:', allIssues);
    }
  });

  test('🌐 다양한 네트워크 조건에서 성능 테스트', async ({ page, context }) => {
    const networkConditions = [
      { name: 'Fast 3G', downloadThroughput: 1.6 * 1024, uploadThroughput: 750, latency: 150 },
      { name: 'Slow 3G', downloadThroughput: 0.5 * 1024, uploadThroughput: 500, latency: 300 },
      { name: 'WiFi', downloadThroughput: 10 * 1024, uploadThroughput: 5 * 1024, latency: 20 }
    ];
    
    const networkResults = [];
    
    for (const network of networkConditions) {
      console.log(`🌐 ${network.name} 네트워크 조건 테스트...`);
      
      // 네트워크 조건 설정
      await context.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, network.latency));
        await route.continue();
      });
      
      const startTime = Date.now();
      await page.goto('/', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      // 주요 기능 테스트
      await page.click('[data-testid="games-tab"]');
      const navigationStart = Date.now();
      await page.waitForLoadState('networkidle');
      const navigationTime = Date.now() - navigationStart;
      
      const report = await PerformanceMonitor.generatePerformanceReport(page);
      
      networkResults.push({
        network: network.name,
        loadTime,
        navigationTime,
        apiPerformance: report.api.avgDuration,
        webVitalsScore: report.webVitals.score,
        issues: report.webVitals.issues.length
      });
      
      console.log(`📊 ${network.name} 결과:`, {
        로드시간: loadTime + 'ms',
        네비게이션: navigationTime + 'ms', 
        API평균: report.api.avgDuration?.toFixed(1) + 'ms',
        점수: report.webVitals.score.toFixed(1)
      });
    }
    
    // 네트워크별 성능 기준 검증
    const wifiResult = networkResults.find(r => r.network === 'WiFi');
    const fastResult = networkResults.find(r => r.network === 'Fast 3G');
    const slowResult = networkResults.find(r => r.network === 'Slow 3G');
    
    expect(wifiResult?.loadTime).toBeLessThan(3000); // WiFi에서 3초 이내
    expect(fastResult?.loadTime).toBeLessThan(5000); // Fast 3G에서 5초 이내
    expect(slowResult?.loadTime).toBeLessThan(10000); // Slow 3G에서 10초 이내
    
    console.log('📋 네트워크 성능 요약:', networkResults);
  });

  test('💾 메모리 누수 및 리소스 관리 테스트', async ({ page }) => {
    console.log('💾 메모리 누수 테스트 시작...');
    
    // 기준 메모리 측정
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const initialReport = await PerformanceMonitor.generatePerformanceReport(page);
    const baselineMemory = initialReport.memory.initialMemory;
    
    console.log(`🔢 기준 메모리 사용량: ${baselineMemory}MB`);
    
    // === 반복적인 페이지 네비게이션 (메모리 누수 유발 시나리오) ===
    for (let i = 0; i < 10; i++) {
      await page.goto('/games');
      await page.waitForLoadState('networkidle');
      
      await page.goto('/members'); 
      await page.waitForLoadState('networkidle');
      
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      console.log(`🔄 네비게이션 사이클 ${i + 1}/10 완료`);
    }
    
    // === 대용량 데이터 처리 시나리오 ===
    await page.route('**/api/games', (route) => {
      const largeGameList = Array.from({ length: 1000 }, (_, i) => ({
        id: `game-${i}`,
        title: `대용량 테스트 게임 ${i}`,
        description: 'a'.repeat(500), // 500자 설명
        participants: Array.from({ length: 4 }, (_, j) => `플레이어${j}`)
      }));
      
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(largeGameList)
      });
    });
    
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    
    // 스크롤 스트레스 테스트 (가상화 성능 검증)
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
    }
    
    // === DOM 노드 생성/삭제 스트레스 테스트 ===
    await page.evaluate(() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      // 1000개 DOM 노드 생성 후 삭제
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        div.innerHTML = `<span>테스트 노드 ${i}</span>`;
        container.appendChild(div);
      }
      
      container.remove(); // 일괄 삭제
    });
    
    // === 이벤트 리스너 스트레스 테스트 ===
    await page.evaluate(() => {
      const listeners = [];
      
      // 1000개 이벤트 리스너 생성
      for (let i = 0; i < 1000; i++) {
        const listener = () => console.log(`Listener ${i}`);
        document.addEventListener('click', listener);
        listeners.push(listener);
      }
      
      // 일괄 정리
      listeners.forEach(listener => {
        document.removeEventListener('click', listener);
      });
    });
    
    // 가비지 컬렉션 강제 실행
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    await page.waitForTimeout(3000); // GC 완료 대기
    
    // 최종 메모리 측정
    const finalReport = await PerformanceMonitor.generatePerformanceReport(page);
    const memoryIncrease = finalReport.memory.finalMemory - baselineMemory;
    
    console.log('💾 메모리 분석 결과:', {
      시작메모리: baselineMemory + 'MB',
      최종메모리: finalReport.memory.finalMemory + 'MB',
      증가량: memoryIncrease + 'MB',
      최대메모리: finalReport.memory.maxMemory + 'MB'
    });
    
    // 메모리 누수 기준 검증
    expect(memoryIncrease).toBeLessThan(100); // 100MB 이내 증가
    expect(finalReport.memory.maxMemory).toBeLessThan(300); // 최대 300MB
    
    if (memoryIncrease > 50) {
      console.log('⚠️ 메모리 사용량 증가 주의 필요');
    }
  });

  test('⚡ 대용량 동시 사용자 성능 시뮬레이션', async ({ browser }) => {
    test.slow(); // 시간이 오래 걸리는 테스트
    
    console.log('⚡ 대용량 사용자 성능 테스트 시작...');
    
    const userCount = 15; // 동시 사용자 수
    const contexts = [];
    const pages = [];
    const performanceResults = [];
    
    try {
      // 동시 사용자 생성
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await PerformanceMonitor.injectPerformanceTracking(page);
        
        contexts.push(context);
        pages.push(page);
      }
      
      console.log(`👥 ${userCount}명 동시 사용자 시나리오 실행...`);
      
      // === 동시 로그인 및 페이지 로드 ===
      const loadStart = Date.now();
      
      await Promise.all(pages.map(async (page, index) => {
        const userStartTime = Date.now();
        
        await page.evaluate((userId) => {
          localStorage.setItem('auth_token', `load-test-user-${userId}`);
          localStorage.setItem('user_profile', JSON.stringify({
            id: `load-test-user-${userId}`,
            name: `부하테스트${userId}`
          }));
        }, index);
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const userLoadTime = Date.now() - userStartTime;
        return { userId: index, loadTime: userLoadTime };
      }));
      
      const totalLoadTime = Date.now() - loadStart;
      console.log(`⏱️ ${userCount}명 동시 로드 완료: ${totalLoadTime}ms`);
      
      // === 동시 게임 목록 조회 ===
      const gameLoadStart = Date.now();
      
      await Promise.all(pages.map(page => 
        page.goto('/games').then(() => page.waitForLoadState('networkidle'))
      ));
      
      const gameLoadTime = Date.now() - gameLoadStart;
      console.log(`🎮 ${userCount}명 동시 게임 조회: ${gameLoadTime}ms`);
      
      // === 동시 채팅방 접속 ===
      const chatLoadStart = Date.now();
      
      await Promise.all(pages.map((page, index) => 
        page.goto(`/chat/load-test-room?user=${index}`)
          .then(() => page.waitForLoadState('networkidle'))
      ));
      
      const chatLoadTime = Date.now() - chatLoadStart;
      console.log(`💬 ${userCount}명 동시 채팅 접속: ${chatLoadTime}ms`);
      
      // === 동시 메시지 전송 부하 테스트 ===
      const messageStart = Date.now();
      
      await Promise.all(pages.map(async (page, index) => {
        // 각 사용자가 5개 메시지 전송
        for (let msgIndex = 0; msgIndex < 5; msgIndex++) {
          const message = `부하테스트_User${index}_Msg${msgIndex}_${Date.now()}`;
          
          await page.fill('[data-testid="chat-input"]', message);
          await page.press('[data-testid="chat-input"]', 'Enter');
          
          await page.waitForTimeout(100 + Math.random() * 200); // 실제 사용자 패턴
        }
      }));
      
      const messageTime = Date.now() - messageStart;
      console.log(`📨 ${userCount * 5}개 메시지 전송 완료: ${messageTime}ms`);
      
      // === 개별 사용자 성능 리포트 수집 ===
      for (let i = 0; i < Math.min(5, userCount); i++) { // 샘플링
        const report = await PerformanceMonitor.generatePerformanceReport(pages[i]);
        performanceResults.push({
          userId: i,
          score: report.overall,
          ...report
        });
      }
      
      // === 성능 결과 분석 ===
      const avgScore = performanceResults.reduce((sum, r) => sum + r.score, 0) / performanceResults.length;
      const avgApiTime = performanceResults.reduce((sum, r) => sum + (r.api.avgDuration || 0), 0) / performanceResults.length;
      const avgMemoryUsage = performanceResults.reduce((sum, r) => sum + r.memory.finalMemory, 0) / performanceResults.length;
      
      console.log('📊 부하 테스트 결과 요약:', {
        동시사용자: userCount,
        평균점수: avgScore.toFixed(1),
        평균API응답: avgApiTime.toFixed(1) + 'ms',
        평균메모리: avgMemoryUsage.toFixed(1) + 'MB',
        총로드시간: totalLoadTime + 'ms',
        게임로드시간: gameLoadTime + 'ms',
        채팅로드시간: chatLoadTime + 'ms',
        메시지처리시간: messageTime + 'ms'
      });
      
      // 부하 테스트 기준 검증
      expect(avgScore).toBeGreaterThan(60); // 평균 60점 이상
      expect(totalLoadTime).toBeLessThan(userCount * 1000); // 사용자당 1초 이내
      expect(avgApiTime).toBeLessThan(2000); // 평균 API 응답 2초 이내
      
    } finally {
      // 리소스 정리
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
    
    console.log('✅ 대용량 사용자 성능 테스트 완료');
  });

  test('🎯 실제 사용자 시나리오 성능 벤치마크', async ({ page }) => {
    console.log('🎯 실제 사용자 시나리오 벤치마크 시작...');
    
    // === 새 회원 가입 후 첫 게임 참가 시나리오 ===
    const scenarioStart = Date.now();
    
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'new-member-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'new-member',
        name: '신규회원테스트',
        isNew: true
      }));
    });
    
    // 1. 앱 첫 진입
    const step1Start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const step1Time = Date.now() - step1Start;
    
    // 2. 튜토리얼/온보딩 진행
    if (await page.locator('[data-testid="tutorial-start"]').isVisible()) {
      const tutorialStart = Date.now();
      
      await page.click('[data-testid="tutorial-start"]');
      await page.click('[data-testid="tutorial-next"]');
      await page.click('[data-testid="tutorial-next"]'); 
      await page.click('[data-testid="tutorial-complete"]');
      
      const tutorialTime = Date.now() - tutorialStart;
      console.log(`📖 튜토리얼 완료: ${tutorialTime}ms`);
    }
    
    // 3. 게임 목록 탐색
    const step3Start = Date.now();
    await page.click('[data-testid="games-tab"]');
    await page.waitForLoadState('networkidle');
    
    // 게임 검색 및 필터링
    await page.fill('[data-testid="game-search"]', '복식');
    await page.press('[data-testid="game-search"]', 'Enter');
    await page.waitForTimeout(1000);
    
    const step3Time = Date.now() - step3Start;
    
    // 4. 게임 상세 정보 확인
    const step4Start = Date.now();
    await page.click('[data-testid="game-card"]:first-child');
    await page.waitForLoadState('networkidle');
    const step4Time = Date.now() - step4Start;
    
    // 5. 게임 참가 프로세스
    const step5Start = Date.now();
    await page.click('[data-testid="join-game-button"]');
    
    // 참가 확인 다이얼로그
    await expect(page.locator('[data-testid="join-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-join"]');
    
    await expect(page.locator('[data-testid="join-success"]')).toBeVisible();
    const step5Time = Date.now() - step5Start;
    
    // 6. 채팅방 입장 및 첫 메시지
    const step6Start = Date.now();
    await page.click('[data-testid="game-chat-button"]');
    await page.waitForLoadState('networkidle');
    
    await page.fill('[data-testid="chat-input"]', '안녕하세요! 처음 참가합니다 😊');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await expect(page.locator('text=안녕하세요! 처음 참가합니다')).toBeVisible();
    const step6Time = Date.now() - step6Start;
    
    const totalScenarioTime = Date.now() - scenarioStart;
    
    // 성능 리포트 생성
    const finalReport = await PerformanceMonitor.generatePerformanceReport(page);
    
    const scenarioResults = {
      전체시간: totalScenarioTime + 'ms',
      앱진입: step1Time + 'ms',
      게임탐색: step3Time + 'ms', 
      상세확인: step4Time + 'ms',
      게임참가: step5Time + 'ms',
      채팅시작: step6Time + 'ms',
      성능점수: finalReport.overall.toFixed(1),
      API평균: (finalReport.api.avgDuration || 0).toFixed(1) + 'ms'
    };
    
    console.log('🎯 신규 회원 시나리오 결과:', scenarioResults);
    
    // 실제 사용자 경험 기준 검증
    expect(totalScenarioTime).toBeLessThan(30000); // 전체 30초 이내
    expect(step1Time).toBeLessThan(5000); // 첫 로딩 5초 이내
    expect(step5Time).toBeLessThan(3000); // 게임 참가 3초 이내
    expect(finalReport.overall).toBeGreaterThan(70); // 성능 점수 70점 이상
    
    console.log('✅ 실제 사용자 시나리오 벤치마크 완료');
  });
});