/**
 * 인증 플로우 E2E 테스트
 * 로그인, 회원가입, 로그아웃 테스트
 */

import { test, expect, Page } from '@playwright/test';

// 페이지 오브젝트 모델
class AuthPage {
  constructor(private page: Page) {}

  async navigateToLogin() {
    await this.page.goto('/');
    // 로그인 화면이 기본으로 표시되는지 확인
    await expect(this.page).toHaveURL(/.*login.*/i);
  }

  async fillLoginForm(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
  }

  async submitLogin() {
    await this.page.click('[data-testid="login-button"]');
  }

  async navigateToRegister() {
    await this.page.click('[data-testid="register-link"]');
  }

  async fillRegisterForm(email: string, password: string, nickname: string) {
    await this.page.fill('[data-testid="register-email-input"]', email);
    await this.page.fill('[data-testid="register-password-input"]', password);
    await this.page.fill('[data-testid="register-nickname-input"]', nickname);
  }

  async submitRegistration() {
    await this.page.click('[data-testid="register-button"]');
  }

  async logout() {
    // 설정 메뉴 또는 사용자 프로필에서 로그아웃
    await this.page.click('[data-testid="user-menu-button"]');
    await this.page.click('[data-testid="logout-button"]');
  }

  async waitForMainApp() {
    // 메인 앱 화면 로드 대기
    await expect(this.page.locator('[data-testid="tab-navigator"]')).toBeVisible();
  }

  async expectLoginError(errorMessage?: string) {
    await expect(this.page.locator('[data-testid="login-error"]')).toBeVisible();
    if (errorMessage) {
      await expect(this.page.locator('[data-testid="login-error"]')).toContainText(errorMessage);
    }
  }

  async expectRegisterError(errorMessage?: string) {
    await expect(this.page.locator('[data-testid="register-error"]')).toBeVisible();
    if (errorMessage) {
      await expect(this.page.locator('[data-testid="register-error"]')).toContainText(errorMessage);
    }
  }
}

test.describe('Authentication Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
  });

  test.describe('Login', () => {
    test('should display login screen on app startup', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // 로그인 폼 요소들이 표시되는지 확인
      await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-link"]')).toBeVisible();
    });

    test('should successfully login with valid credentials', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('test@yameyame.com', 'testpassword123');
      await authPage.submitLogin();
      
      // 로그인 성공 후 메인 앱으로 이동
      await authPage.waitForMainApp();
      
      // 홈 화면의 주요 요소들 확인
      await expect(page.locator('[data-testid="home-screen"]')).toBeVisible();
      await expect(page.locator('text=YameYame')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('invalid@email.com', 'wrongpassword');
      await authPage.submitLogin();
      
      // 에러 메시지 확인
      await authPage.expectLoginError();
    });

    test('should validate email format', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('invalid-email', 'password123');
      await authPage.submitLogin();
      
      // 이메일 형식 에러 확인
      await authPage.expectLoginError('이메일 형식');
    });

    test('should require password', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('test@yameyame.com', '');
      await authPage.submitLogin();
      
      // 비밀번호 필수 에러 확인
      await authPage.expectLoginError('비밀번호');
    });
  });

  test.describe('Registration', () => {
    test('should navigate to registration screen', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.navigateToRegister();
      
      // 회원가입 폼 요소들 확인
      await expect(page.locator('[data-testid="register-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-nickname-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    });

    test('should successfully register new user', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `newuser${timestamp}@yameyame.com`;
      const testNickname = `테스트유저${timestamp}`;
      
      await authPage.navigateToLogin();
      await authPage.navigateToRegister();
      await authPage.fillRegisterForm(testEmail, 'newpassword123', testNickname);
      await authPage.submitRegistration();
      
      // 회원가입 성공 후 로그인 화면으로 이동 또는 자동 로그인
      await page.waitForTimeout(2000); // API 응답 대기
      
      // 성공 메시지 또는 로그인 화면 확인
      const successMessage = page.locator('[data-testid="registration-success"]');
      const loginScreen = page.locator('[data-testid="login-screen"]');
      
      await expect(successMessage.or(loginScreen)).toBeVisible();
    });

    test('should validate registration form fields', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.navigateToRegister();
      
      // 빈 필드로 제출
      await authPage.submitRegistration();
      await authPage.expectRegisterError();
      
      // 잘못된 이메일 형식
      await authPage.fillRegisterForm('invalid-email', 'password123', 'nickname');
      await authPage.submitRegistration();
      await authPage.expectRegisterError('이메일');
      
      // 짧은 비밀번호
      await page.fill('[data-testid="register-email-input"]', 'test@example.com');
      await page.fill('[data-testid="register-password-input"]', '123');
      await authPage.submitRegistration();
      await authPage.expectRegisterError('비밀번호');
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.navigateToRegister();
      
      // 이미 존재하는 이메일로 회원가입 시도
      await authPage.fillRegisterForm('test@yameyame.com', 'password123', 'duplicate');
      await authPage.submitRegistration();
      
      await authPage.expectRegisterError('이미 등록된');
    });
  });

  test.describe('Logout', () => {
    test('should successfully logout', async ({ page }) => {
      // 먼저 로그인
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('test@yameyame.com', 'testpassword123');
      await authPage.submitLogin();
      await authPage.waitForMainApp();
      
      // 로그아웃
      await authPage.logout();
      
      // 로그인 화면으로 돌아가는지 확인
      await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    });
  });

  test.describe('Session Persistence', () => {
    test('should remember login state after page refresh', async ({ page }) => {
      // 로그인
      await authPage.navigateToLogin();
      await authPage.fillLoginForm('test@yameyame.com', 'testpassword123');
      await authPage.submitLogin();
      await authPage.waitForMainApp();
      
      // 페이지 새로고침
      await page.reload();
      
      // 여전히 로그인 상태인지 확인
      await expect(page.locator('[data-testid="tab-navigator"]')).toBeVisible();
    });
  });

  test.describe('Mobile Specific Tests', () => {
    test('should handle virtual keyboard properly', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // 입력 필드 포커스 시 뷰포트 조정 확인
      await page.locator('[data-testid="email-input"]').focus();
      await page.waitForTimeout(1000);
      
      // 키보드가 나타났을 때 UI가 올바르게 조정되는지 확인
      const loginButton = page.locator('[data-testid="login-button"]');
      await expect(loginButton).toBeVisible();
    });

    test('should work with touch gestures', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // 터치 제스처로 폼 상호작용
      await page.locator('[data-testid="email-input"]').tap();
      await page.keyboard.type('test@yameyame.com');
      
      await page.locator('[data-testid="password-input"]').tap();
      await page.keyboard.type('testpassword123');
      
      await page.locator('[data-testid="login-button"]').tap();
      
      await authPage.waitForMainApp();
    });
  });
});