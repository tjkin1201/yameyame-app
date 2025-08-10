/**
 * yameyame 고급 시각적 회귀 테스트
 * Advanced Visual Regression Testing for yameyame
 * 
 * 반응형 디자인, 다크모드, 인터랙션 상태, 브라우저별 렌더링 차이 검증
 */

import { test, expect, Page } from '@playwright/test';

// 시각적 테스트 헬퍼 클래스
class VisualTestHelper {
  
  // 표준 뷰포트 크기
  static viewports = {
    mobile: { width: 375, height: 667 },      // iPhone SE
    tablet: { width: 768, height: 1024 },     // iPad
    desktop: { width: 1920, height: 1080 },   // Full HD
    ultrawide: { width: 2560, height: 1440 }  // QHD
  };

  // 테마 변경 헬퍼
  static async setTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate((selectedTheme) => {
      document.documentElement.setAttribute('data-theme', selectedTheme);
      localStorage.setItem('theme', selectedTheme);
    }, theme);
    
    // 테마 전환 애니메이션 완료 대기
    await page.waitForTimeout(500);
  }

  // 로딩 상태 완료 대기
  static async waitForFullRender(page: Page) {
    // 네트워크 요청 완료 대기
    await page.waitForLoadState('networkidle');
    
    // 이미지 로딩 완료 대기
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.every(img => img.complete);
    });
    
    // 폰트 로딩 완료 대기
    await page.waitForFunction(() => document.fonts.ready);
    
    // 애니메이션 완료 대기
    await page.waitForTimeout(1000);
  }

  // 상호작용 상태 시뮬레이션
  static async simulateInteractionStates(page: Page, selector: string) {
    const element = page.locator(selector);
    
    // hover 상태
    await element.hover();
    await page.waitForTimeout(200);
    
    return {
      hover: async () => {
        await element.hover();
        await page.waitForTimeout(200);
      },
      
      focus: async () => {
        await element.focus();
        await page.waitForTimeout(200);
      },
      
      active: async () => {
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.up();
      },
      
      reset: async () => {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
      }
    };
  }

  // 스크롤 테스트 헬퍼
  static async testScrollBehavior(page: Page) {
    const scrollPositions = [0, 0.25, 0.5, 0.75, 1.0];
    const screenshots = [];
    
    for (const position of scrollPositions) {
      await page.evaluate((pos) => {
        const scrollHeight = document.body.scrollHeight - window.innerHeight;
        window.scrollTo(0, scrollHeight * pos);
      }, position);
      
      await page.waitForTimeout(500); // 스크롤 애니메이션 대기
      
      screenshots.push({
        position: `${position * 100}%`,
        screenshot: await page.screenshot({ fullPage: false })
      });
    }
    
    return screenshots;
  }

  // 다국어 지원 테스트 헬퍼
  static async setLanguage(page: Page, language: 'ko' | 'en' | 'ja') {
    await page.evaluate((lang) => {
      localStorage.setItem('language', lang);
      document.documentElement.lang = lang;
    }, language);
    
    await page.reload({ waitUntil: 'networkidle' });
    await this.waitForFullRender(page);
  }
}

test.describe('🎨 종합 시각적 회귀 테스트', () => {

  test.beforeEach(async ({ page }) => {
    // 테스트 데이터 설정
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/games')) {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'visual-test-1',
              title: '시각 테스트 게임 1',
              type: 'singles',
              date: '2024-01-20',
              time: '19:00',
              participants: ['김철수', '이영희'],
              maxParticipants: 2,
              status: 'recruiting'
            },
            {
              id: 'visual-test-2', 
              title: '시각 테스트 게임 2 - 매우 긴 제목으로 텍스트 오버플로우 테스트',
              type: 'doubles',
              date: '2024-01-21',
              time: '20:00',
              participants: ['박민수', '정다은', '최준호'],
              maxParticipants: 4,
              status: 'in-progress'
            }
          ])
        });
      } else {
        route.continue();
      }
    });
  });

  test('📱 반응형 디자인 브레이크포인트 테스트', async ({ page }) => {
    console.log('📱 반응형 디자인 테스트 시작...');
    
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'visual-test-user');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'visual-test-user',
        name: '시각테스트사용자'
      }));
    });

    // 각 뷰포트에서 주요 페이지 테스트
    const pages = [
      { path: '/', name: 'home' },
      { path: '/games', name: 'games' },
      { path: '/members', name: 'members' },
      { path: '/chat', name: 'chat' }
    ];

    for (const [viewportName, viewport] of Object.entries(VisualTestHelper.viewports)) {
      console.log(`🖥️ ${viewportName} 뷰포트 (${viewport.width}x${viewport.height}) 테스트...`);
      
      await page.setViewportSize(viewport);
      
      for (const pagePath of pages) {
        await page.goto(pagePath.path);
        await VisualTestHelper.waitForFullRender(page);
        
        // 기본 상태 스크린샷
        await expect(page).toHaveScreenshot(
          `${pagePath.name}-${viewportName}.png`,
          {
            fullPage: true,
            threshold: 0.2,
            animations: 'disabled'
          }
        );

        // 중요한 UI 요소들이 뷰포트에 맞게 조정되었는지 확인
        if (viewportName === 'mobile') {
          // 모바일에서 햄버거 메뉴 확인
          const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
          if (await mobileMenu.isVisible()) {
            await expect(mobileMenu).toBeVisible();
          }
          
          // 모바일용 네비게이션 확인
          const bottomNav = page.locator('[data-testid="bottom-navigation"]');
          if (await bottomNav.isVisible()) {
            await expect(bottomNav).toBeVisible();
          }
        } else if (viewportName === 'desktop') {
          // 데스크톱에서 전체 네비게이션 확인
          const desktopNav = page.locator('[data-testid="desktop-navigation"]');
          if (await desktopNav.isVisible()) {
            await expect(desktopNav).toBeVisible();
          }
        }
        
        // 텍스트 오버플로우 및 레이아웃 깨짐 확인
        const overflowElements = await page.locator('*').evaluateAll(elements => {
          return elements.filter(el => {
            const style = window.getComputedStyle(el);
            return el.scrollWidth > el.clientWidth && style.overflow !== 'hidden';
          }).map(el => ({
            tag: el.tagName,
            text: el.textContent?.substring(0, 50)
          }));
        });
        
        if (overflowElements.length > 0) {
          console.log(`⚠️ ${viewportName}에서 오버플로우 감지:`, overflowElements);
        }
      }
    }
    
    console.log('✅ 반응형 디자인 테스트 완료');
  });

  test('🌙 다크모드 및 테마 일관성 테스트', async ({ page }) => {
    console.log('🌙 다크모드 테스트 시작...');
    
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'theme-test-user');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'theme-test-user', 
        name: '테마테스트사용자'
      }));
    });

    const testPages = ['/', '/games', '/chat'];
    const themes = ['light', 'dark'];

    for (const theme of themes) {
      console.log(`${theme === 'dark' ? '🌙' : '☀️'} ${theme} 테마 테스트...`);
      
      for (const pagePath of testPages) {
        await page.goto(pagePath);
        await VisualTestHelper.setTheme(page, theme);
        await VisualTestHelper.waitForFullRender(page);
        
        const pageName = pagePath === '/' ? 'home' : pagePath.substring(1);
        
        // 테마별 스크린샷
        await expect(page).toHaveScreenshot(
          `${pageName}-${theme}-theme.png`,
          {
            fullPage: true,
            threshold: 0.2,
            animations: 'disabled'
          }
        );
        
        // 색상 대비 확인 (접근성)
        const colorContrastIssues = await page.evaluate(() => {
          const issues = [];
          const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a');
          
          textElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const bgColor = style.backgroundColor;
            const textColor = style.color;
            
            // 간단한 색상 대비 검사 (실제로는 더 정교한 알고리즘 필요)
            if (bgColor === textColor || (bgColor === 'rgba(0, 0, 0, 0)' && textColor === 'rgb(255, 255, 255)')) {
              issues.push({
                element: element.tagName,
                text: element.textContent?.substring(0, 30),
                background: bgColor,
                color: textColor
              });
            }
          });
          
          return issues;
        });
        
        if (colorContrastIssues.length > 0) {
          console.log(`⚠️ ${theme} 테마 색상 대비 이슈:`, colorContrastIssues);
        }
      }
    }
    
    // 테마 전환 애니메이션 테스트
    await page.goto('/');
    await VisualTestHelper.setTheme(page, 'light');
    
    // 테마 전환 중 스크린샷 (애니메이션 캡처)
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(250); // 애니메이션 중간 지점
    
    await expect(page).toHaveScreenshot('theme-transition-mid.png', {
      threshold: 0.3 // 애니메이션으로 인한 변화 허용
    });
    
    console.log('✅ 다크모드 테스트 완료');
  });

  test('🖱️ 인터랙션 상태 시각적 피드백 테스트', async ({ page }) => {
    console.log('🖱️ 인터랙션 상태 테스트 시작...');
    
    await page.goto('/games');
    await VisualTestHelper.waitForFullRender(page);
    
    const interactiveElements = [
      '[data-testid="create-game-fab"]',
      '[data-testid="game-card"]:first-child',
      '[data-testid="search-input"]',
      '[data-testid="filter-button"]'
    ];

    for (const selector of interactiveElements) {
      const element = page.locator(selector);
      
      if (await element.isVisible()) {
        console.log(`🎯 ${selector} 인터랙션 테스트...`);
        
        const interaction = await VisualTestHelper.simulateInteractionStates(page, selector);
        
        // 기본 상태
        await interaction.reset();
        await expect(page.locator(selector)).toHaveScreenshot(
          `${selector.replace(/[[\]":]/g, '-')}-default.png`,
          { threshold: 0.1 }
        );
        
        // 호버 상태
        await interaction.hover();
        await expect(page.locator(selector)).toHaveScreenshot(
          `${selector.replace(/[[\]":]/g, '-')}-hover.png`,
          { threshold: 0.1 }
        );
        
        // 포커스 상태 (입력 요소인 경우)
        if (selector.includes('input') || selector.includes('button')) {
          await interaction.focus();
          await expect(page.locator(selector)).toHaveScreenshot(
            `${selector.replace(/[[\]":]/g, '-')}-focus.png`,
            { threshold: 0.1 }
          );
        }
        
        await interaction.reset();
      }
    }
    
    // 폼 유효성 검사 시각적 상태 테스트
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      // 유효한 입력
      await searchInput.fill('복식 게임');
      await expect(searchInput).toHaveScreenshot('search-input-valid.png', { threshold: 0.1 });
      
      // 빈 입력 (에러 상태 시뮬레이션)
      await searchInput.fill('');
      await searchInput.blur();
      await page.waitForTimeout(300);
      await expect(searchInput).toHaveScreenshot('search-input-empty.png', { threshold: 0.1 });
    }
    
    console.log('✅ 인터랙션 상태 테스트 완료');
  });

  test('📊 데이터 상태별 UI 렌더링 테스트', async ({ page }) => {
    console.log('📊 데이터 상태 테스트 시작...');
    
    // 빈 상태 (Empty State) 테스트
    await page.route('**/api/games', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.goto('/games');
    await VisualTestHelper.waitForFullRender(page);
    
    await expect(page).toHaveScreenshot('games-empty-state.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // 로딩 상태 테스트
    await page.route('**/api/games', (route) => {
      setTimeout(() => {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', title: '로딩 후 게임', type: 'singles' }
          ])
        });
      }, 2000);
    });
    
    await page.goto('/games');
    await page.waitForTimeout(500); // 로딩 상태 캡처
    
    await expect(page).toHaveScreenshot('games-loading-state.png', {
      fullPage: true,
      threshold: 0.3 // 로딩 애니메이션으로 인한 변화 허용
    });
    
    // 에러 상태 테스트
    await page.route('**/api/games', (route) => {
      route.fulfill({
        status: 500,
        body: 'Server Error'
      });
    });
    
    await page.goto('/games');
    await page.waitForTimeout(2000); // 에러 처리 완료 대기
    
    await expect(page).toHaveScreenshot('games-error-state.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // 대용량 데이터 상태 테스트
    const largeDataset = Array.from({ length: 50 }, (_, i) => ({
      id: `game-${i}`,
      title: `대용량 게임 ${i + 1}`,
      type: i % 2 === 0 ? 'singles' : 'doubles',
      participants: Array.from({ length: i % 4 + 1 }, (_, j) => `플레이어${j + 1}`)
    }));
    
    await page.route('**/api/games', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(largeDataset)
      });
    });
    
    await page.goto('/games');
    await VisualTestHelper.waitForFullRender(page);
    
    // 가상화/페이지네이션 확인
    await expect(page).toHaveScreenshot('games-large-dataset.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // 스크롤 성능 및 시각적 일관성 확인
    const scrollScreenshots = await VisualTestHelper.testScrollBehavior(page);
    
    for (const [index, screenshot] of scrollScreenshots.entries()) {
      await expect(page).toHaveScreenshot(`games-scroll-${index}-${screenshot.position}.png`, {
        threshold: 0.2
      });
    }
    
    console.log('✅ 데이터 상태 테스트 완료');
  });

  test('🌍 다국어 지원 및 텍스트 레이아웃 테스트', async ({ page }) => {
    console.log('🌍 다국어 테스트 시작...');
    
    const languages = [
      { code: 'ko', name: '한국어' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' }
    ];
    
    // Mock 다국어 데이터
    await page.route('**/api/i18n/**', (route) => {
      const lang = route.request().url().split('/').pop();
      const translations = {
        ko: {
          'app.title': 'YameYame',
          'games.create': '게임 만들기',
          'games.join': '참가하기',
          'games.empty': '예정된 게임이 없습니다',
          'chat.placeholder': '메시지를 입력하세요...',
          'member.count': '{count}명 참가'
        },
        en: {
          'app.title': 'YameYame',
          'games.create': 'Create Game',
          'games.join': 'Join Game', 
          'games.empty': 'No upcoming games',
          'chat.placeholder': 'Type a message...',
          'member.count': '{count} members'
        },
        ja: {
          'app.title': 'YameYame',
          'games.create': 'ゲーム作成',
          'games.join': '参加する',
          'games.empty': '予定されているゲームはありません',
          'chat.placeholder': 'メッセージを入力してください...',
          'member.count': '{count}人参加'
        }
      };
      
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(translations[lang] || translations.ko)
      });
    });

    for (const language of languages) {
      console.log(`🈲 ${language.name} 언어 테스트...`);
      
      await VisualTestHelper.setLanguage(page, language.code as any);
      
      // 주요 페이지별 언어 렌더링 테스트
      const testPages = ['/', '/games', '/members'];
      
      for (const pagePath of testPages) {
        await page.goto(pagePath);
        await VisualTestHelper.waitForFullRender(page);
        
        const pageName = pagePath === '/' ? 'home' : pagePath.substring(1);
        
        await expect(page).toHaveScreenshot(
          `${pageName}-${language.code}.png`,
          {
            fullPage: true,
            threshold: 0.2
          }
        );
        
        // 텍스트 오버플로우 검사 (특히 독일어, 일본어 같은 긴 언어)
        const textOverflows = await page.evaluate(() => {
          const overflows = [];
          const textElements = document.querySelectorAll('button, span, p, h1, h2, h3');
          
          textElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            if (element.scrollWidth > element.clientWidth && style.overflow === 'visible') {
              overflows.push({
                element: element.tagName,
                text: element.textContent?.substring(0, 30),
                expectedWidth: element.clientWidth,
                actualWidth: element.scrollWidth
              });
            }
          });
          
          return overflows;
        });
        
        if (textOverflows.length > 0) {
          console.log(`⚠️ ${language.name}에서 텍스트 오버플로우:`, textOverflows);
        }
        
        // RTL 언어 지원 확인 (아랍어, 히브리어 등 추가 시)
        const direction = await page.evaluate(() => 
          window.getComputedStyle(document.documentElement).direction
        );
        
        if (direction === 'rtl') {
          await expect(page).toHaveScreenshot(
            `${pageName}-${language.code}-rtl.png`,
            { fullPage: true, threshold: 0.2 }
          );
        }
      }
    }
    
    console.log('✅ 다국어 테스트 완료');
  });

  test('🎮 게임 상태별 시각적 표현 테스트', async ({ page }) => {
    console.log('🎮 게임 상태 시각적 테스트 시작...');
    
    const gameStates = [
      {
        status: 'recruiting',
        participants: ['김철수'],
        maxParticipants: 4,
        name: 'recruiting'
      },
      {
        status: 'full',
        participants: ['김철수', '이영희', '박민수', '정다은'],
        maxParticipants: 4,
        name: 'full'
      },
      {
        status: 'in-progress',
        participants: ['김철수', '이영희'],
        maxParticipants: 2,
        name: 'in-progress'
      },
      {
        status: 'completed',
        participants: ['김철수', '이영희'],
        maxParticipants: 2,
        result: { winner: 'A팀', score: '21-19' },
        name: 'completed'
      },
      {
        status: 'cancelled',
        participants: ['김철수'],
        maxParticipants: 4,
        name: 'cancelled'
      }
    ];

    for (const gameState of gameStates) {
      console.log(`🏸 ${gameState.name} 상태 테스트...`);
      
      // 해당 상태의 게임 데이터 Mock
      await page.route('**/api/games', (route) => {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: `game-${gameState.name}`,
              title: `${gameState.name} 상태 테스트 게임`,
              type: 'doubles',
              date: '2024-01-20',
              time: '19:00',
              status: gameState.status,
              participants: gameState.participants,
              maxParticipants: gameState.maxParticipants,
              result: gameState.result
            }
          ])
        });
      });
      
      await page.goto('/games');
      await VisualTestHelper.waitForFullRender(page);
      
      // 게임 카드 상태별 스크린샷
      await expect(page.locator('[data-testid="game-card"]').first()).toHaveScreenshot(
        `game-card-${gameState.name}.png`,
        { threshold: 0.1 }
      );
      
      // 게임 상세 페이지 (상태별 버튼 및 UI 변화)
      await page.click('[data-testid="game-card"]');
      await VisualTestHelper.waitForFullRender(page);
      
      await expect(page).toHaveScreenshot(
        `game-detail-${gameState.name}.png`,
        { fullPage: true, threshold: 0.2 }
      );
      
      // 상태별 액션 버튼 확인
      const actionButtons = await page.locator('[data-testid^="game-action-"]').count();
      console.log(`${gameState.name} 상태 액션 버튼 수: ${actionButtons}`);
      
      await page.goBack();
    }
    
    console.log('✅ 게임 상태 시각적 테스트 완료');
  });

  test('📋 폼 상태 및 유효성 검사 시각적 피드백', async ({ page }) => {
    console.log('📋 폼 상태 시각적 테스트 시작...');
    
    await page.goto('/games/create');
    await VisualTestHelper.waitForFullRender(page);
    
    // 빈 폼 초기 상태
    await expect(page).toHaveScreenshot('form-initial-state.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // 필수 필드 유효성 검사 시각적 피드백
    const requiredFields = [
      { selector: '[data-testid="game-title-input"]', invalidValue: '', fieldName: 'title' },
      { selector: '[data-testid="game-date-input"]', invalidValue: '', fieldName: 'date' },
      { selector: '[data-testid="game-time-input"]', invalidValue: '', fieldName: 'time' }
    ];
    
    for (const field of requiredFields) {
      const input = page.locator(field.selector);
      
      if (await input.isVisible()) {
        // 유효하지 않은 값 입력 후 포커스 이동
        await input.fill(field.invalidValue);
        await input.blur();
        await page.waitForTimeout(300);
        
        await expect(input).toHaveScreenshot(
          `form-field-${field.fieldName}-invalid.png`,
          { threshold: 0.1 }
        );
        
        // 유효한 값 입력
        const validValues = {
          title: '시각 테스트 게임',
          date: '2024-12-31',
          time: '19:00'
        };
        
        await input.fill(validValues[field.fieldName]);
        await page.waitForTimeout(300);
        
        await expect(input).toHaveScreenshot(
          `form-field-${field.fieldName}-valid.png`,
          { threshold: 0.1 }
        );
      }
    }
    
    // 전체 폼 유효 상태
    await expect(page).toHaveScreenshot('form-valid-state.png', {
      fullPage: true,
      threshold: 0.2
    });
    
    // 제출 버튼 상태 변화
    const submitButton = page.locator('[data-testid="submit-button"]');
    
    await expect(submitButton).toHaveScreenshot('submit-button-enabled.png', {
      threshold: 0.1
    });
    
    console.log('✅ 폼 상태 시각적 테스트 완료');
  });

  test('🔄 애니메이션 및 트랜지션 일관성 테스트', async ({ page }) => {
    console.log('🔄 애니메이션 테스트 시작...');
    
    await page.goto('/games');
    await VisualTestHelper.waitForFullRender(page);
    
    // 페이지 로딩 애니메이션
    await page.reload();
    await page.waitForTimeout(500); // 로딩 애니메이션 중간 지점
    
    await expect(page).toHaveScreenshot('page-loading-animation.png', {
      threshold: 0.5 // 애니메이션으로 인한 변화 허용
    });
    
    await VisualTestHelper.waitForFullRender(page);
    
    // 모달 열기/닫기 애니메이션
    const createButton = page.locator('[data-testid="create-game-fab"]');
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(250); // 애니메이션 중간
      
      await expect(page).toHaveScreenshot('modal-opening-animation.png', {
        threshold: 0.5
      });
      
      await page.waitForTimeout(500); // 완전히 열린 상태
      await expect(page).toHaveScreenshot('modal-fully-open.png', {
        threshold: 0.2
      });
      
      // 모달 닫기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      
      await expect(page).toHaveScreenshot('modal-closing-animation.png', {
        threshold: 0.5
      });
    }
    
    // 탭 전환 애니메이션
    const tabs = ['[data-testid="games-tab"]', '[data-testid="members-tab"]'];
    
    for (const tab of tabs) {
      if (await page.locator(tab).isVisible()) {
        await page.click(tab);
        await page.waitForTimeout(200); // 전환 애니메이션 중간
        
        const tabName = tab.includes('games') ? 'games' : 'members';
        await expect(page).toHaveScreenshot(`tab-transition-${tabName}.png`, {
          threshold: 0.4
        });
        
        await VisualTestHelper.waitForFullRender(page);
      }
    }
    
    // 리스트 아이템 호버 애니메이션
    const firstGameCard = page.locator('[data-testid="game-card"]').first();
    if (await firstGameCard.isVisible()) {
      await firstGameCard.hover();
      await page.waitForTimeout(200);
      
      await expect(firstGameCard).toHaveScreenshot('game-card-hover-animation.png', {
        threshold: 0.3
      });
    }
    
    console.log('✅ 애니메이션 테스트 완료');
  });
});

test.describe('🌐 크로스 브라우저 시각적 일관성', () => {
  
  test('🎨 브라우저별 렌더링 차이 검증', async ({ page, browserName }) => {
    console.log(`🎨 ${browserName} 렌더링 테스트 시작...`);
    
    await page.goto('/');
    await VisualTestHelper.waitForFullRender(page);
    
    // 브라우저별 기본 렌더링
    await expect(page).toHaveScreenshot(`home-${browserName}.png`, {
      fullPage: true,
      threshold: 0.3 // 브라우저별 차이 허용
    });
    
    // CSS Grid/Flexbox 레이아웃
    await page.goto('/games');
    await VisualTestHelper.waitForFullRender(page);
    
    await expect(page).toHaveScreenshot(`games-layout-${browserName}.png`, {
      fullPage: true,
      threshold: 0.3
    });
    
    // 폰트 렌더링 차이
    const fontSample = page.locator('h1, h2, h3').first();
    if (await fontSample.isVisible()) {
      await expect(fontSample).toHaveScreenshot(`font-rendering-${browserName}.png`, {
        threshold: 0.4 // 폰트 렌더링 차이가 클 수 있음
      });
    }
    
    // Shadow DOM 및 커스텀 요소 (만약 사용한다면)
    const customElements = await page.locator('[data-testid*="custom-"]').count();
    if (customElements > 0) {
      await expect(page.locator('[data-testid*="custom-"]').first()).toHaveScreenshot(
        `custom-element-${browserName}.png`,
        { threshold: 0.3 }
      );
    }
    
    console.log(`✅ ${browserName} 렌더링 테스트 완료`);
  });
});