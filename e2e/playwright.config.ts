/**
 * Playwright E2E 테스트 구성 - React Native 모바일 앱
 * 동배즐(동탄 배드민턴 동호회) 앱 테스트
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.BASE_URL || 'http://localhost:8081';
const apiURL = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  outputDir: 'test-results/artifacts',
  
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000
  },

  // React Native Expo 앱 서버 설정
  webServer: {
    command: 'cd worktrees/frontend-ui/yameyame-app && npm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },

  projects: [
    // 모바일 디바이스 에뮬레이션
    {
      name: 'Mobile Chrome - Portrait',
      use: { 
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 851 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
      },
    },
    {
      name: 'Mobile Chrome - Landscape', 
      use: { 
        ...devices['Pixel 7 landscape'],
        viewport: { width: 851, height: 393 }
      },
    },
    {
      name: 'Mobile Safari - iPhone',
      use: { 
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 }
      },
    },
    {
      name: 'Mobile Safari - iPhone Landscape',
      use: { 
        ...devices['iPhone 14 Pro landscape'],
        viewport: { width: 852, height: 393 }
      },
    },
    {
      name: 'Tablet - iPad',
      use: { 
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
    },
    {
      name: 'Tablet - Android',
      use: { 
        ...devices['Galaxy Tab S4'],
        viewport: { width: 712, height: 1138 }
      },
    }
  ],

  // 글로벌 설정
  globalSetup: path.join(__dirname, 'setup', 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'setup', 'global-teardown.ts'),
  
  expect: {
    timeout: 10000,
    toMatchSnapshot: {
      mode: 'precise',
      threshold: 0.2
    }
  }
});