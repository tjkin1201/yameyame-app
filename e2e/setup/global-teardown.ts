/**
 * Playwright 글로벌 해체
 * 테스트 완료 후 정리 작업
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 글로벌 테스트 정리 시작...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const apiURL = process.env.API_URL || 'http://localhost:3000';
    
    // 1. 테스트 데이터 정리
    console.log('🗄️ 테스트 데이터 정리 중...');
    
    const cleanupResponse = await page.request.post(`${apiURL}/api/test/cleanup`, {
      data: { 
        cleanupTypes: ['users', 'clubs', 'games', 'posts'],
        testOnly: true 
      }
    });
    
    if (cleanupResponse.ok()) {
      console.log('✅ 테스트 데이터 정리 완료');
    } else {
      console.log('⚠️ 테스트 데이터 정리 실패');
    }
    
    // 2. 최종 서버 상태 확인
    console.log('📊 최종 서버 상태 확인 중...');
    
    const healthResponse = await page.request.get(`${apiURL}/api/health`);
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      console.log('📈 최종 서버 상태:', {
        status: healthData.status,
        uptime: Math.round(healthData.uptime),
        memory: healthData.process?.memory?.heapUsed ? 
          `${Math.round(healthData.process.memory.heapUsed / 1024 / 1024)}MB` : 'N/A',
        requests: healthData.metrics?.counters?.requests || 'N/A'
      });
    }
    
    console.log('🏁 글로벌 테스트 정리 완료');
    
  } catch (error) {
    console.error('❌ 글로벌 정리 오류:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalTeardown;