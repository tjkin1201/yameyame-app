/**
 * Playwright 글로벌 설정
 * 테스트 환경 초기화 및 API 서버 상태 확인
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 글로벌 테스트 설정 시작...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. 백엔드 API 서버 상태 확인
    console.log('📡 백엔드 API 서버 상태 확인 중...');
    const apiURL = process.env.API_URL || 'http://localhost:3000';
    
    const apiResponse = await page.request.get(`${apiURL}/api/health`);
    
    if (!apiResponse.ok()) {
      throw new Error(`백엔드 API 서버가 준비되지 않았습니다. Status: ${apiResponse.status()}`);
    }
    
    const healthData = await apiResponse.json();
    console.log('✅ 백엔드 API 서버 정상:', healthData);
    
    // 2. React Native 앱 서버 상태 확인
    console.log('📱 React Native 앱 서버 상태 확인 중...');
    const baseURL = process.env.BASE_URL || 'http://localhost:8081';
    
    // Expo 개발 서버 확인 (최대 30초 대기)
    let appReady = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!appReady && attempts < maxAttempts) {
      try {
        const appResponse = await page.request.get(baseURL);
        if (appResponse.ok()) {
          appReady = true;
          console.log('✅ React Native 앱 서버 정상');
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ React Native 앱 서버 대기 중... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!appReady) {
      throw new Error('React Native 앱 서버가 준비되지 않았습니다.');
    }
    
    // 3. 테스트 데이터 초기화
    console.log('🗄️ 테스트 데이터 초기화 중...');
    
    // 테스트용 사용자 생성
    const testUserResponse = await page.request.post(`${apiURL}/api/auth/test-setup`, {
      data: {
        users: [
          {
            email: 'test@yameyame.com',
            password: 'testpassword123',
            nickname: '테스트회원',
            role: 'member'
          },
          {
            email: 'admin@yameyame.com', 
            password: 'adminpassword123',
            nickname: '관리자',
            role: 'admin'
          }
        ]
      }
    });
    
    if (testUserResponse.ok()) {
      console.log('✅ 테스트 사용자 생성 완료');
    } else {
      console.log('⚠️ 테스트 사용자 생성 실패 (이미 존재하거나 서버 오류)');
    }
    
    // 4. 테스트용 클럽 데이터 생성
    const testClubResponse = await page.request.post(`${apiURL}/api/clubs/test-setup`, {
      data: {
        clubs: [
          {
            name: '동탄 배드민턴 동호회',
            description: '동탄신도시 배드민턴 동호회입니다',
            location: '동탄신도시 체육관',
            maxMembers: 50
          }
        ]
      }
    });
    
    if (testClubResponse.ok()) {
      console.log('✅ 테스트 클럽 데이터 생성 완료');
    }
    
    console.log('🎯 글로벌 테스트 설정 완료');
    
  } catch (error) {
    console.error('❌ 글로벌 설정 오류:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;