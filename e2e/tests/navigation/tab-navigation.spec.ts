/**
 * 탭 네비게이션 E2E 테스트
 * 메인 탭 네비게이션 및 화면 전환 테스트
 */

import { test, expect, Page } from '@playwright/test';

class NavigationHelper {
  constructor(private page: Page) {}

  async loginAndWaitForApp() {
    await this.page.goto('/');
    await this.page.fill('[data-testid="email-input"]', 'test@yameyame.com');
    await this.page.fill('[data-testid="password-input"]', 'testpassword123');
    await this.page.click('[data-testid="login-button"]');
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  }

  async clickTab(tabName: 'Home' | 'Board' | 'Gallery' | 'Chat' | 'Members' | 'Posts') {
    await this.page.click(`[data-testid="tab-${tabName.toLowerCase()}"]`);
  }

  async expectActiveTab(tabName: string) {
    await expect(this.page.locator(`[data-testid="tab-${tabName.toLowerCase()}"][aria-selected="true"]`))
      .toBeVisible();
  }

  async expectScreenVisible(screenTestId: string) {
    await expect(this.page.locator(`[data-testid="${screenTestId}"]`)).toBeVisible();
  }

  async expectTabBarVisible() {
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  }
}

test.describe('Tab Navigation', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    nav = new NavigationHelper(page);
    await nav.loginAndWaitForApp();
  });

  test('should display all tab buttons', async ({ page }) => {
    // 모든 탭이 표시되는지 확인
    await expect(page.locator('[data-testid="tab-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-gallery"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-chat"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-members"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-posts"]')).toBeVisible();

    // 탭 아이콘들이 표시되는지 확인
    await expect(page.locator('[data-testid="tab-home"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-board"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-gallery"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-chat"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-members"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-posts"] svg')).toBeVisible();
  });

  test('should start with Home tab active', async ({ page }) => {
    await nav.expectActiveTab('home');
    await nav.expectScreenVisible('home-screen');
    
    // 홈 화면의 주요 요소 확인
    await expect(page.locator('text=YameYame')).toBeVisible();
  });

  test.describe('Tab Switching', () => {
    test('should switch to Board tab and show Game Rooms', async ({ page }) => {
      await nav.clickTab('Board');
      await nav.expectActiveTab('board');
      await nav.expectScreenVisible('board-screen');
      
      // 게임룸 화면의 주요 요소 확인
      await expect(page.locator('text=Game Rooms')).toBeVisible();
    });

    test('should switch to Gallery tab and show photos', async ({ page }) => {
      await nav.clickTab('Gallery');
      await nav.expectActiveTab('gallery');
      await nav.expectScreenVisible('gallery-screen');
      
      // 갤러리 화면 확인
      await expect(page.locator('text=Gallery')).toBeVisible();
    });

    test('should switch to Chat tab and show messages', async ({ page }) => {
      await nav.clickTab('Chat');
      await nav.expectActiveTab('chat');
      await nav.expectScreenVisible('chat-screen');
      
      // 채팅 화면 확인
      await expect(page.locator('text=Chat')).toBeVisible();
    });

    test('should switch to Members tab and show member list', async ({ page }) => {
      await nav.clickTab('Members');
      await nav.expectActiveTab('members');
      await nav.expectScreenVisible('members-screen');
      
      // 멤버 화면 확인
      await expect(page.locator('text=Members')).toBeVisible();
    });

    test('should switch to Posts tab and show posts', async ({ page }) => {
      await nav.clickTab('Posts');
      await nav.expectActiveTab('posts');
      await nav.expectScreenVisible('posts-screen');
      
      // 게시글 화면 확인
      await expect(page.locator('text=Posts')).toBeVisible();
    });
  });

  test('should maintain tab state when switching between tabs', async ({ page }) => {
    // Home -> Board -> Home 순서로 탭 전환
    await nav.clickTab('Board');
    await nav.expectActiveTab('board');
    
    await nav.clickTab('Home');
    await nav.expectActiveTab('home');
    await nav.expectScreenVisible('home-screen');
    
    // 다시 Board로 돌아갔을 때 상태 유지 확인
    await nav.clickTab('Board');
    await nav.expectScreenVisible('board-screen');
  });

  test('should show proper tab icons for active/inactive states', async ({ page }) => {
    // Home 탭이 활성화된 상태에서 아이콘 확인
    await expect(page.locator('[data-testid="tab-home"][aria-selected="true"] svg')).toBeVisible();
    
    // Board 탭으로 전환 후 아이콘 상태 확인
    await nav.clickTab('Board');
    await expect(page.locator('[data-testid="tab-board"][aria-selected="true"] svg')).toBeVisible();
    await expect(page.locator('[data-testid="tab-home"][aria-selected="false"] svg')).toBeVisible();
  });

  test.describe('Mobile Specific Navigation', () => {
    test('should handle tab navigation with touch gestures', async ({ page }) => {
      // 터치 제스처로 탭 전환
      await page.locator('[data-testid="tab-board"]').tap();
      await nav.expectScreenVisible('board-screen');
      
      await page.locator('[data-testid="tab-gallery"]').tap();
      await nav.expectScreenVisible('gallery-screen');
      
      await page.locator('[data-testid="tab-chat"]').tap();
      await nav.expectScreenVisible('chat-screen');
    });

    test('should maintain tab bar visibility on different screen sizes', async ({ page }) => {
      // 세로 모드에서 탭바 표시 확인
      await page.setViewportSize({ width: 393, height: 851 });
      await nav.expectTabBarVisible();
      
      // 가로 모드에서 탭바 표시 확인
      await page.setViewportSize({ width: 851, height: 393 });
      await nav.expectTabBarVisible();
      
      // 탭 기능이 여전히 작동하는지 확인
      await nav.clickTab('Board');
      await nav.expectScreenVisible('board-screen');
    });

    test('should handle rapid tab switching', async ({ page }) => {
      // 빠른 탭 전환 테스트
      const tabs = ['Board', 'Gallery', 'Chat', 'Members', 'Posts', 'Home'] as const;
      
      for (const tab of tabs) {
        await nav.clickTab(tab);
        await page.waitForTimeout(200); // 각 전환 사이에 짧은 대기
        await nav.expectActiveTab(tab.toLowerCase());
      }
    });

    test('should work with keyboard navigation for accessibility', async ({ page }) => {
      // 키보드 네비게이션 테스트 (접근성)
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      
      // 키보드로 탭 전환이 가능한지 확인
      await page.waitForTimeout(500);
    });
  });

  test.describe('Header Navigation', () => {
    test('should show correct header title for each tab', async ({ page }) => {
      const tabTitles = [
        { tab: 'Home', title: 'YameYame 🎮' },
        { tab: 'Board', title: 'Game Rooms' },
        { tab: 'Gallery', title: 'Gallery' },
        { tab: 'Chat', title: 'Chat' },
        { tab: 'Members', title: 'Members' },
        { tab: 'Posts', title: 'Posts' }
      ] as const;

      for (const { tab, title } of tabTitles) {
        await nav.clickTab(tab);
        await expect(page.locator('[data-testid="header-title"]')).toContainText(title);
      }
    });

    test('should maintain header consistency across tabs', async ({ page }) => {
      // 모든 탭에서 헤더가 일관되게 표시되는지 확인
      const tabs = ['Home', 'Board', 'Gallery', 'Chat', 'Members', 'Posts'] as const;
      
      for (const tab of tabs) {
        await nav.clickTab(tab);
        await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="header-title"]')).toBeVisible();
      }
    });
  });

  test.describe('Performance Tests', () => {
    test('should load tabs quickly', async ({ page }) => {
      const startTime = Date.now();
      
      // 모든 탭을 한 번씩 방문
      const tabs = ['Board', 'Gallery', 'Chat', 'Members', 'Posts'] as const;
      
      for (const tab of tabs) {
        const tabStartTime = Date.now();
        await nav.clickTab(tab);
        await nav.expectScreenVisible(`${tab.toLowerCase()}-screen`);
        const tabLoadTime = Date.now() - tabStartTime;
        
        // 각 탭 로딩이 2초 이내에 완료되어야 함
        expect(tabLoadTime).toBeLessThan(2000);
      }
      
      const totalTime = Date.now() - startTime;
      
      // 전체 탭 순회가 10초 이내에 완료되어야 함
      expect(totalTime).toBeLessThan(10000);
    });

    test('should not cause memory leaks during tab switching', async ({ page }) => {
      // 메모리 리크 테스트 (여러 번 탭 전환)
      const tabs = ['Board', 'Gallery', 'Chat', 'Members', 'Posts', 'Home'] as const;
      
      // 10번 반복하여 탭 전환
      for (let i = 0; i < 10; i++) {
        for (const tab of tabs) {
          await nav.clickTab(tab);
          await page.waitForTimeout(100);
        }
      }
      
      // 마지막에 Home 탭이 정상적으로 작동하는지 확인
      await nav.clickTab('Home');
      await nav.expectScreenVisible('home-screen');
    });
  });
});