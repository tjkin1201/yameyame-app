/**
 * 게임 관리 E2E 테스트
 * 배드민턴 게임 생성, 참여, 관리 테스트
 */

import { test, expect, Page } from '@playwright/test';

class GameManagementHelper {
  constructor(private page: Page) {}

  async loginAndNavigateToBoard() {
    await this.page.goto('/');
    await this.page.fill('[data-testid="email-input"]', 'test@yameyame.com');
    await this.page.fill('[data-testid="password-input"]', 'testpassword123');
    await this.page.click('[data-testid="login-button"]');
    
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    await this.page.click('[data-testid="tab-board"]');
    await expect(this.page.locator('[data-testid="board-screen"]')).toBeVisible();
  }

  async createNewGame(gameData: {
    title: string;
    date: string;
    time: string;
    location: string;
    maxPlayers: number;
    description?: string;
  }) {
    await this.page.click('[data-testid="create-game-button"]');
    await expect(this.page.locator('[data-testid="create-game-modal"]')).toBeVisible();

    await this.page.fill('[data-testid="game-title-input"]', gameData.title);
    await this.page.fill('[data-testid="game-date-input"]', gameData.date);
    await this.page.fill('[data-testid="game-time-input"]', gameData.time);
    await this.page.fill('[data-testid="game-location-input"]', gameData.location);
    await this.page.fill('[data-testid="game-max-players-input"]', gameData.maxPlayers.toString());
    
    if (gameData.description) {
      await this.page.fill('[data-testid="game-description-input"]', gameData.description);
    }

    await this.page.click('[data-testid="create-game-submit"]');
  }

  async joinGame(gameId: string) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await expect(this.page.locator('[data-testid="game-detail-modal"]')).toBeVisible();
    await this.page.click('[data-testid="join-game-button"]');
  }

  async leaveGame(gameId: string) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await expect(this.page.locator('[data-testid="game-detail-modal"]')).toBeVisible();
    await this.page.click('[data-testid="leave-game-button"]');
  }

  async expectGameInList(gameTitle: string) {
    await expect(this.page.locator(`text=${gameTitle}`)).toBeVisible();
  }

  async expectGameNotInList(gameTitle: string) {
    await expect(this.page.locator(`text=${gameTitle}`)).not.toBeVisible();
  }

  async expectJoinButtonVisible(gameId: string) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await expect(this.page.locator('[data-testid="join-game-button"]')).toBeVisible();
    await this.page.click('[data-testid="close-modal-button"]');
  }

  async expectLeaveButtonVisible(gameId: string) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await expect(this.page.locator('[data-testid="leave-game-button"]')).toBeVisible();
    await this.page.click('[data-testid="close-modal-button"]');
  }

  async expectGameFull(gameId: string) {
    await this.page.click(`[data-testid="game-card-${gameId}"]`);
    await expect(this.page.locator('[data-testid="game-full-indicator"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="join-game-button"]')).toBeDisabled();
    await this.page.click('[data-testid="close-modal-button"]');
  }

  async filterGamesByDate(date: string) {
    await this.page.click('[data-testid="game-filter-button"]');
    await this.page.fill('[data-testid="filter-date-input"]', date);
    await this.page.click('[data-testid="apply-filter-button"]');
  }

  async searchGames(query: string) {
    await this.page.fill('[data-testid="game-search-input"]', query);
    await this.page.click('[data-testid="game-search-button"]');
  }
}

test.describe('Game Management', () => {
  let gameHelper: GameManagementHelper;

  test.beforeEach(async ({ page }) => {
    gameHelper = new GameManagementHelper(page);
    await gameHelper.loginAndNavigateToBoard();
  });

  test.describe('Game Creation', () => {
    test('should display game board screen with create button', async ({ page }) => {
      await expect(page.locator('[data-testid="board-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-game-button"]')).toBeVisible();
      await expect(page.locator('text=Game Rooms')).toBeVisible();
    });

    test('should successfully create a new game', async ({ page }) => {
      const gameData = {
        title: '저녁 배드민턴 게임',
        date: '2024-12-31',
        time: '19:00',
        location: '동탄신도시 체육관',
        maxPlayers: 8,
        description: '초급자 환영하는 게임입니다'
      };

      await gameHelper.createNewGame(gameData);

      // 성공적으로 생성되었는지 확인
      await expect(page.locator('[data-testid="create-game-success"]')).toBeVisible();
      await gameHelper.expectGameInList(gameData.title);
    });

    test('should validate required fields when creating game', async ({ page }) => {
      await page.click('[data-testid="create-game-button"]');
      await expect(page.locator('[data-testid="create-game-modal"]')).toBeVisible();

      // 빈 필드로 제출 시도
      await page.click('[data-testid="create-game-submit"]');

      // 유효성 검사 에러 메시지 확인
      await expect(page.locator('[data-testid="title-error"]')).toContainText('필수');
      await expect(page.locator('[data-testid="date-error"]')).toContainText('필수');
      await expect(page.locator('[data-testid="time-error"]')).toContainText('필수');
      await expect(page.locator('[data-testid="location-error"]')).toContainText('필수');
      await expect(page.locator('[data-testid="max-players-error"]')).toContainText('필수');
    });

    test('should prevent creating game with past date', async ({ page }) => {
      const pastGameData = {
        title: '과거 게임',
        date: '2023-01-01',
        time: '10:00',
        location: '체육관',
        maxPlayers: 4
      };

      await gameHelper.createNewGame(pastGameData);

      // 과거 날짜 에러 메시지 확인
      await expect(page.locator('[data-testid="date-error"]')).toContainText('과거 날짜');
    });

    test('should limit max players to reasonable range', async ({ page }) => {
      const gameData = {
        title: '테스트 게임',
        date: '2024-12-31',
        time: '10:00',
        location: '체육관',
        maxPlayers: 100 // 너무 많은 인원
      };

      await gameHelper.createNewGame(gameData);

      // 최대 인원 제한 에러 확인
      await expect(page.locator('[data-testid="max-players-error"]')).toContainText('최대 20명');
    });
  });

  test.describe('Game Participation', () => {
    test('should allow user to join available game', async ({ page }) => {
      // 먼저 게임 생성
      const gameData = {
        title: '참여 테스트 게임',
        date: '2024-12-31',
        time: '15:00',
        location: '체육관',
        maxPlayers: 6
      };

      await gameHelper.createNewGame(gameData);
      await page.waitForTimeout(1000);

      // 다른 사용자로 로그인 (또는 게임 참여 테스트)
      // 실제로는 다른 사용자 계정이 필요하지만, 여기서는 같은 사용자가 참여하는 것으로 테스트
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await gameHelper.joinGame(extractedGameId);
        
        // 참여 성공 확인
        await expect(page.locator('[data-testid="join-game-success"]')).toBeVisible();
        await gameHelper.expectLeaveButtonVisible(extractedGameId);
      }
    });

    test('should allow user to leave joined game', async ({ page }) => {
      // 게임 참여 후 떠나기
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await gameHelper.joinGame(extractedGameId);
        await page.waitForTimeout(500);
        
        await gameHelper.leaveGame(extractedGameId);
        
        // 떠나기 성공 확인
        await expect(page.locator('[data-testid="leave-game-success"]')).toBeVisible();
        await gameHelper.expectJoinButtonVisible(extractedGameId);
      }
    });

    test('should not allow joining full games', async ({ page }) => {
      // 최대 인원 1명인 게임 생성
      const gameData = {
        title: '풀 게임 테스트',
        date: '2024-12-31',
        time: '16:00',
        location: '체육관',
        maxPlayers: 1
      };

      await gameHelper.createNewGame(gameData);
      await page.waitForTimeout(1000);

      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        
        // 첫 번째 참여로 게임이 가득참
        await gameHelper.joinGame(extractedGameId);
        await page.waitForTimeout(500);
        
        // 게임이 가득찬 상태 확인
        await gameHelper.expectGameFull(extractedGameId);
      }
    });

    test('should show current participants count', async ({ page }) => {
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        
        // 참가자 수 표시 확인
        await expect(page.locator('[data-testid="current-participants"]')).toBeVisible();
        await expect(page.locator('[data-testid="max-participants"]')).toBeVisible();
        
        await page.click('[data-testid="close-modal-button"]');
      }
    });
  });

  test.describe('Game Filtering and Search', () => {
    test('should filter games by date', async ({ page }) => {
      await gameHelper.filterGamesByDate('2024-12-31');
      
      // 필터링된 결과 확인
      await expect(page.locator('[data-testid="filtered-games-count"]')).toBeVisible();
    });

    test('should search games by title', async ({ page }) => {
      await gameHelper.searchGames('배드민턴');
      
      // 검색 결과 확인
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    });

    test('should show empty state when no games match filter', async ({ page }) => {
      await gameHelper.filterGamesByDate('2025-01-01');
      await gameHelper.searchGames('존재하지않는게임');
      
      // 빈 상태 메시지 확인
      await expect(page.locator('[data-testid="no-games-message"]')).toBeVisible();
      await expect(page.locator('text=게임이 없습니다')).toBeVisible();
    });

    test('should clear filters', async ({ page }) => {
      // 필터 적용
      await gameHelper.filterGamesByDate('2024-12-31');
      
      // 필터 초기화
      await page.click('[data-testid="clear-filters-button"]');
      
      // 모든 게임 다시 표시 확인
      await expect(page.locator('[data-testid="game-list"]')).toBeVisible();
    });
  });

  test.describe('Game Details', () => {
    test('should show game details when clicked', async ({ page }) => {
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        
        // 게임 상세 정보 확인
        await expect(page.locator('[data-testid="game-detail-modal"]')).toBeVisible();
        await expect(page.locator('[data-testid="game-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="game-date"]')).toBeVisible();
        await expect(page.locator('[data-testid="game-time"]')).toBeVisible();
        await expect(page.locator('[data-testid="game-location"]')).toBeVisible();
        await expect(page.locator('[data-testid="game-participants"]')).toBeVisible();
      }
    });

    test('should show game creator information', async ({ page }) => {
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        
        // 게임 생성자 정보 확인
        await expect(page.locator('[data-testid="game-creator"]')).toBeVisible();
        await expect(page.locator('[data-testid="creator-nickname"]')).toBeVisible();
      }
    });

    test('should allow game creator to edit/cancel game', async ({ page }) => {
      // 자신이 만든 게임에 대한 편집/취소 버튼 확인
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        
        // 게임 생성자만 보이는 버튼들 확인
        await expect(page.locator('[data-testid="edit-game-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="cancel-game-button"]')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Specific Game Management', () => {
    test('should handle game creation on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 851 });
      
      await page.click('[data-testid="create-game-button"]');
      
      // 모바일에서 모달이 전체 화면으로 표시되는지 확인
      await expect(page.locator('[data-testid="create-game-modal"]')).toBeVisible();
      
      const gameData = {
        title: '모바일 테스트 게임',
        date: '2024-12-31',
        time: '18:00',
        location: '모바일 체육관',
        maxPlayers: 4
      };

      await gameHelper.createNewGame(gameData);
      await gameHelper.expectGameInList(gameData.title);
    });

    test('should support touch gestures for game cards', async ({ page }) => {
      const gameCard = page.locator('[data-testid^="game-card-"]').first();
      
      // 터치 제스처로 게임 카드 선택
      await gameCard.tap();
      await expect(page.locator('[data-testid="game-detail-modal"]')).toBeVisible();
      
      // 스와이프 제스처 시뮬레이션 (닫기)
      await page.locator('[data-testid="close-modal-button"]').tap();
      await expect(page.locator('[data-testid="game-detail-modal"]')).not.toBeVisible();
    });

    test('should scroll game list on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 851 });
      
      // 게임 목록 스크롤 테스트
      const gameList = page.locator('[data-testid="game-list"]');
      await expect(gameList).toBeVisible();
      
      // 스크롤 동작 테스트
      await gameList.hover();
      await page.mouse.wheel(0, 300);
      
      // 스크롤 후에도 게임 목록이 표시되는지 확인
      await expect(gameList).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update game list when new games are created', async ({ page }) => {
      const initialGameCount = await page.locator('[data-testid^="game-card-"]').count();
      
      const gameData = {
        title: '실시간 업데이트 테스트',
        date: '2024-12-31',
        time: '20:00',
        location: '실시간 체육관',
        maxPlayers: 6
      };

      await gameHelper.createNewGame(gameData);
      
      // 게임 목록이 업데이트되었는지 확인
      const newGameCount = await page.locator('[data-testid^="game-card-"]').count();
      expect(newGameCount).toBe(initialGameCount + 1);
    });

    test('should update participant count in real-time', async ({ page }) => {
      const gameId = await page.locator('[data-testid^="game-card-"]').first().getAttribute('data-testid');
      if (gameId) {
        const extractedGameId = gameId.replace('game-card-', '');
        
        // 참여 전 인원 수 확인
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        const initialParticipants = await page.locator('[data-testid="current-participants"]').textContent();
        await page.click('[data-testid="close-modal-button"]');
        
        // 게임 참여
        await gameHelper.joinGame(extractedGameId);
        
        // 참여 후 인원 수 업데이트 확인
        await page.click(`[data-testid="game-card-${extractedGameId}"]`);
        const updatedParticipants = await page.locator('[data-testid="current-participants"]').textContent();
        
        expect(updatedParticipants).not.toBe(initialParticipants);
      }
    });
  });
});