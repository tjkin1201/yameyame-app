/**
 * yameyame 실시간 Socket.io 고급 테스트 전략
 * Advanced Socket.io Real-time Testing Strategy
 * 
 * 복잡한 실시간 시나리오와 Edge Case 처리 검증
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Socket.io 테스트 헬퍼 클래스
class SocketTestHelper {
  
  static async injectSocketMonitor(page: Page) {
    await page.addInitScript(() => {
      // Socket.io 이벤트 모니터링
      window.socketEvents = [];
      window.socketMetrics = {
        connectionTime: 0,
        messagesSent: 0,
        messagesReceived: 0,
        reconnections: 0,
        errors: []
      };
      
      // Socket 이벤트 리스너 추가
      window.addEventListener('socket-connected', (event) => {
        window.socketEvents.push({ type: 'connected', timestamp: Date.now() });
        window.socketMetrics.connectionTime = event.detail.connectionTime;
      });
      
      window.addEventListener('socket-message', (event) => {
        window.socketEvents.push({ 
          type: 'message', 
          data: event.detail,
          timestamp: Date.now() 
        });
        window.socketMetrics.messagesReceived++;
      });
      
      window.addEventListener('socket-error', (event) => {
        window.socketEvents.push({ 
          type: 'error', 
          error: event.detail,
          timestamp: Date.now() 
        });
        window.socketMetrics.errors.push(event.detail);
      });
    });
  }

  static async waitForSocketEvent(page: Page, eventType: string, timeout = 5000) {
    return await page.waitForFunction(
      (type) => window.socketEvents.some(event => event.type === type),
      eventType,
      { timeout }
    );
  }

  static async getSocketMetrics(page: Page) {
    return await page.evaluate(() => window.socketMetrics);
  }

  static async simulateNetworkLatency(page: Page, latency: number) {
    await page.route('**/socket.io/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, latency));
      await route.continue();
    });
  }
}

test.describe('🔌 고급 Socket.io 실시간 통신 테스트', () => {

  test.beforeEach(async ({ page }) => {
    await SocketTestHelper.injectSocketMonitor(page);
  });

  test('⚡ 대용량 동시 연결 스트레스 테스트', async ({ browser }) => {
    test.slow(); // 시간이 오래 걸리는 테스트
    
    console.log('🏋️ 대용량 동시 연결 스트레스 테스트 시작...');
    
    // 20명의 동시 사용자 시뮬레이션
    const userCount = 20;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    
    try {
      // 사용자 생성
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await SocketTestHelper.injectSocketMonitor(page);
        
        // 각 사용자마다 다른 프로필로 로그인
        await page.evaluate((userId) => {
          localStorage.setItem('auth_token', `user-${userId}-token`);
          localStorage.setItem('user_profile', JSON.stringify({
            id: `user-${userId}`,
            name: `테스트사용자${userId}`
          }));
        }, i);
        
        contexts.push(context);
        pages.push(page);
      }
      
      // 모든 사용자가 동시에 채팅방 입장
      const connectionStart = Date.now();
      
      await Promise.all(pages.map(async (page, index) => {
        await page.goto(`/chat/stress-test-room?user=${index}`);
        await SocketTestHelper.waitForSocketEvent(page, 'connected');
      }));
      
      const connectionTime = Date.now() - connectionStart;
      console.log(`📊 ${userCount}명 동시 연결 시간: ${connectionTime}ms`);
      
      // 성능 기준: 20명이 10초 이내 연결
      expect(connectionTime).toBeLessThan(10000);
      
      // === 동시 메시지 폭탄 테스트 ===
      const messageBombStart = Date.now();
      
      // 각 사용자가 동시에 10개 메시지 전송
      const messagePromises = pages.map(async (page, userIndex) => {
        const messages = [];
        
        for (let msgIndex = 0; msgIndex < 10; msgIndex++) {
          const message = `User${userIndex}_Message${msgIndex}_${Date.now()}`;
          messages.push(message);
          
          await page.fill('[data-testid="chat-input"]', message);
          await page.press('[data-testid="chat-input"]', 'Enter');
          
          // 메시지 간 작은 간격 (실제 사용자 행동 시뮬레이션)
          await page.waitForTimeout(Math.random() * 100);
        }
        
        return messages;
      });
      
      const allSentMessages = await Promise.all(messagePromises);
      const flattenedMessages = allSentMessages.flat();
      
      const messageBombTime = Date.now() - messageBombStart;
      console.log(`💣 ${flattenedMessages.length}개 메시지 전송 시간: ${messageBombTime}ms`);
      
      // === 메시지 전파 및 순서 검증 ===
      // 랜덤 사용자 선택하여 모든 메시지 수신 확인
      const verifyUserIndex = Math.floor(Math.random() * userCount);
      const verifyPage = pages[verifyUserIndex];
      
      // 모든 메시지 수신 대기 (최대 30초)
      for (const message of flattenedMessages) {
        await expect(verifyPage.locator(`text=${message}`)).toBeVisible({ timeout: 30000 });
      }
      
      // Socket 메트릭 수집
      const metrics = await Promise.all(
        pages.map(page => SocketTestHelper.getSocketMetrics(page))
      );
      
      const totalMessagesSent = metrics.reduce((sum, m) => sum + m.messagesSent, 0);
      const totalMessagesReceived = metrics.reduce((sum, m) => sum + m.messagesReceived, 0);
      const avgConnectionTime = metrics.reduce((sum, m) => sum + m.connectionTime, 0) / userCount;
      
      console.log('📊 스트레스 테스트 결과:', {
        사용자수: userCount,
        총_전송: totalMessagesSent,
        총_수신: totalMessagesReceived,
        평균_연결시간: avgConnectionTime + 'ms',
        연결_성공률: (metrics.filter(m => m.connectionTime > 0).length / userCount * 100) + '%'
      });
      
      // 성능 검증
      expect(avgConnectionTime).toBeLessThan(2000); // 평균 연결 시간 2초 이내
      expect(totalMessagesReceived).toBeGreaterThan(totalMessagesSent * 0.95); // 95% 이상 메시지 전달
      
    } finally {
      // 리소스 정리
      await Promise.all(contexts.map(context => context.close()));
    }
    
    console.log('✅ 스트레스 테스트 완료');
  });

  test('🔄 네트워크 중단 및 자동 재연결 테스트', async ({ page, context }) => {
    console.log('🌐 네트워크 재연결 테스트 시작...');
    
    await page.goto('/chat/reconnection-test');
    await SocketTestHelper.waitForSocketEvent(page, 'connected');
    
    // 초기 연결 상태 확인
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결됨');
    
    // === 갑작스러운 네트워크 중단 시뮬레이션 ===
    console.log('📶 네트워크 중단...');
    await context.setOffline(true);
    
    // 연결 끊김 감지 확인
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결 끊김', { timeout: 5000 });
    await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible();
    
    // 재연결 시도 횟수 카운트
    let reconnectAttempts = 0;
    await page.evaluate(() => {
      window.addEventListener('socket-reconnect-attempt', () => {
        window.reconnectAttempts = (window.reconnectAttempts || 0) + 1;
      });
    });
    
    // 5초 후 네트워크 복구
    await page.waitForTimeout(5000);
    console.log('📶 네트워크 복구...');
    await context.setOffline(false);
    
    // 자동 재연결 확인
    await SocketTestHelper.waitForSocketEvent(page, 'connected', 15000);
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결됨', { timeout: 15000 });
    
    const reconnectAttempts = await page.evaluate(() => window.reconnectAttempts || 0);
    console.log(`🔄 재연결 시도 횟수: ${reconnectAttempts}`);
    
    // 재연결 후 메시지 전송 테스트
    const testMessage = `재연결 테스트 ${Date.now()}`;
    await page.fill('[data-testid="chat-input"]', testMessage);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await expect(page.locator(`text=${testMessage}`)).toBeVisible({ timeout: 5000 });
    
    console.log('✅ 재연결 테스트 완료');
  });

  test('⏱️ 메시지 순서 및 시간 동기화 테스트', async ({ browser }) => {
    console.log('⏰ 메시지 순서 동기화 테스트 시작...');
    
    // 3명의 사용자로 메시지 순서 테스트
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(), 
      browser.newContext()
    ]);
    
    const pages = await Promise.all(contexts.map(async (context, index) => {
      const page = await context.newPage();
      await SocketTestHelper.injectSocketMonitor(page);
      
      await page.evaluate((userId) => {
        localStorage.setItem('auth_token', `timing-user-${userId}`);
        localStorage.setItem('user_profile', JSON.stringify({
          id: `timing-user-${userId}`,
          name: `타이밍테스트${userId}`
        }));
      }, index);
      
      await page.goto('/chat/timing-test');
      await SocketTestHelper.waitForSocketEvent(page, 'connected');
      
      return page;
    }));
    
    // === 순차적 메시지 전송 및 순서 검증 ===
    const messageSequence = [];
    
    for (let round = 0; round < 5; round++) {
      for (let userIndex = 0; userIndex < 3; userIndex++) {
        const timestamp = Date.now();
        const message = `Round${round}_User${userIndex}_${timestamp}`;
        
        messageSequence.push({ message, timestamp, user: userIndex });
        
        await pages[userIndex].fill('[data-testid="chat-input"]', message);
        await pages[userIndex].press('[data-testid="chat-input"]', 'Enter');
        
        // 각 메시지 간 100ms 간격
        await pages[userIndex].waitForTimeout(100);
      }
    }
    
    // 모든 사용자가 전체 메시지 순서 수신 확인
    for (const page of pages) {
      for (const { message } of messageSequence) {
        await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
      }
      
      // DOM에서 실제 메시지 순서 확인
      const displayedMessages = await page.locator('[data-testid="chat-message"]').allTextContents();
      const displayedTimestamps = displayedMessages
        .map(msg => {
          const match = msg.match(/Round\d+_User\d+_(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(ts => ts > 0);
      
      // 시간순 정렬 확인
      for (let i = 1; i < displayedTimestamps.length; i++) {
        expect(displayedTimestamps[i]).toBeGreaterThanOrEqual(displayedTimestamps[i-1]);
      }
    }
    
    console.log('✅ 메시지 순서 동기화 테스트 완료');
    
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('🏃‍♂️ 빠른 채팅방 전환 및 상태 관리', async ({ page }) => {
    console.log('🏃‍♂️ 빠른 채팅방 전환 테스트 시작...');
    
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'room-hopper-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'room-hopper',
        name: '방전환테스터'
      }));
    });
    
    // 첫 번째 채팅방 입장
    await page.goto('/chat/room-1');
    await SocketTestHelper.waitForSocketEvent(page, 'connected');
    
    const testMessage1 = `Room1 메시지 ${Date.now()}`;
    await page.fill('[data-testid="chat-input"]', testMessage1);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    await expect(page.locator(`text=${testMessage1}`)).toBeVisible();
    
    // === 빠른 채팅방 전환 (10개 방) ===
    for (let roomNum = 2; roomNum <= 10; roomNum++) {
      const switchStart = Date.now();
      
      await page.goto(`/chat/room-${roomNum}`);
      await SocketTestHelper.waitForSocketEvent(page, 'connected');
      
      const switchTime = Date.now() - switchStart;
      console.log(`🏃 Room-${roomNum} 전환 시간: ${switchTime}ms`);
      
      // 각 방 전환이 2초 이내
      expect(switchTime).toBeLessThan(2000);
      
      // 이전 방의 메시지가 표시되지 않아야 함
      await expect(page.locator(`text=${testMessage1}`)).not.toBeVisible();
      
      // 새 방에서 메시지 전송
      const roomMessage = `Room${roomNum} 테스트 ${Date.now()}`;
      await page.fill('[data-testid="chat-input"]', roomMessage);
      await page.press('[data-testid="chat-input"]', 'Enter');
      
      await expect(page.locator(`text=${roomMessage}`)).toBeVisible();
    }
    
    // === 이전 방으로 돌아가기 테스트 ===
    await page.goto('/chat/room-1');
    await SocketTestHelper.waitForSocketEvent(page, 'connected');
    
    // 이전에 보낸 메시지가 여전히 보여야 함 (히스토리)
    await expect(page.locator(`text=${testMessage1}`)).toBeVisible({ timeout: 5000 });
    
    console.log('✅ 채팅방 전환 테스트 완료');
  });

  test('🎯 메시지 전송 실패 및 재전송 메커니즘', async ({ page, context }) => {
    console.log('🎯 메시지 실패 처리 테스트 시작...');
    
    await page.goto('/chat/failure-test');
    await SocketTestHelper.waitForSocketEvent(page, 'connected');
    
    // === 서버 오류 시뮬레이션 ===
    let requestCount = 0;
    await page.route('**/socket.io/**', async (route) => {
      requestCount++;
      
      // 매 2번째 요청마다 실패 시뮬레이션
      if (requestCount % 2 === 0) {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server Error' })
        });
      } else {
        await route.continue();
      }
    });
    
    // 실패할 메시지 전송
    const failingMessage = `실패 테스트 메시지 ${Date.now()}`;
    await page.fill('[data-testid="chat-input"]', failingMessage);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // 전송 실패 UI 확인
    await expect(page.locator('[data-testid="message-failed"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // 수동 재전송 테스트
    await page.click('[data-testid="retry-button"]');
    
    // 재전송 성공 확인
    await expect(page.locator(`text=${failingMessage}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="message-failed"]')).not.toBeVisible();
    
    // === 자동 재전송 메커니즘 테스트 ===
    // 네트워크 인터셉트 제거 (정상 상태)
    await page.unroute('**/socket.io/**');
    
    const autoRetryMessage = `자동 재전송 테스트 ${Date.now()}`;
    
    // 일시적 네트워크 장애 시뮬레이션
    await page.route('**/api/chat/send', (route) => {
      setTimeout(() => route.continue(), 3000); // 3초 지연
    });
    
    await page.fill('[data-testid="chat-input"]', autoRetryMessage);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // 전송 중 표시기 확인
    await expect(page.locator('[data-testid="message-sending"]')).toBeVisible();
    
    // 최종 전송 성공 확인
    await expect(page.locator(`text=${autoRetryMessage}`)).toBeVisible({ timeout: 15000 });
    
    console.log('✅ 메시지 실패 처리 테스트 완료');
  });

  test('📊 실시간 성능 모니터링 및 메트릭 수집', async ({ page }) => {
    console.log('📊 실시간 성능 모니터링 테스트 시작...');
    
    // 성능 메트릭 수집을 위한 추가 스크립트
    await page.addInitScript(() => {
      window.performanceMetrics = {
        messageLatencies: [],
        connectionStability: [],
        memoryUsage: []
      };
      
      // 메시지 지연 시간 측정
      window.measureMessageLatency = (sentTime) => {
        const receivedTime = Date.now();
        const latency = receivedTime - sentTime;
        window.performanceMetrics.messageLatencies.push(latency);
        return latency;
      };
      
      // 메모리 사용량 모니터링
      setInterval(() => {
        if (performance.memory) {
          window.performanceMetrics.memoryUsage.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          });
        }
      }, 5000);
    });
    
    await page.goto('/chat/performance-test');
    await SocketTestHelper.waitForSocketEvent(page, 'connected');
    
    // === 지속적인 메시지 전송 및 지연시간 측정 ===
    const messageCount = 50;
    const messageLatencies = [];
    
    for (let i = 0; i < messageCount; i++) {
      const sentTime = Date.now();
      const message = `성능테스트_${i}_${sentTime}`;
      
      await page.fill('[data-testid="chat-input"]', message);
      await page.press('[data-testid="chat-input"]', 'Enter');
      
      // 메시지 전송 확인 및 지연시간 측정
      await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 5000 });
      
      const latency = await page.evaluate((timestamp) => {
        return window.measureMessageLatency(timestamp);
      }, sentTime);
      
      messageLatencies.push(latency);
      
      // 메시지 간 간격 (실제 채팅 패턴)
      await page.waitForTimeout(200 + Math.random() * 300);
    }
    
    // === 성능 분석 ===
    const metrics = await page.evaluate(() => window.performanceMetrics);
    
    const avgLatency = messageLatencies.reduce((sum, lat) => sum + lat, 0) / messageLatencies.length;
    const maxLatency = Math.max(...messageLatencies);
    const minLatency = Math.min(...messageLatencies);
    
    const memoryUsage = metrics.memoryUsage;
    const initialMemory = memoryUsage[0]?.used || 0;
    const finalMemory = memoryUsage[memoryUsage.length - 1]?.used || 0;
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log('📊 실시간 성능 메트릭:', {
      메시지_수: messageCount,
      평균_지연시간: avgLatency + 'ms',
      최대_지연시간: maxLatency + 'ms', 
      최소_지연시간: minLatency + 'ms',
      메모리_증가량: Math.round(memoryIncrease / 1024 / 1024) + 'MB'
    });
    
    // 성능 기준 검증
    expect(avgLatency).toBeLessThan(500); // 평균 지연시간 500ms 이내
    expect(maxLatency).toBeLessThan(2000); // 최대 지연시간 2초 이내
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 메모리 증가 50MB 이내
    
    console.log('✅ 실시간 성능 모니터링 테스트 완료');
  });

  test('🔀 동시 다중 채팅방 참여 테스트', async ({ page }) => {
    console.log('🔀 다중 채팅방 참여 테스트 시작...');
    
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'multi-room-user');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'multi-room-user',
        name: '다중방사용자'
      }));
    });
    
    // 메인 페이지에서 시작
    await page.goto('/chat');
    
    // === 여러 채팅방 탭으로 동시 참여 ===
    const roomTabs = ['general', 'games', 'announcements', 'random'];
    
    for (const roomName of roomTabs) {
      // 새 탭에서 채팅방 열기
      await page.click(`[data-testid="open-room-${roomName}"]`);
      
      // 탭 전환 및 연결 확인
      await page.click(`[data-testid="room-tab-${roomName}"]`);
      await expect(page.locator('[data-testid="connection-status"]')).toHaveText('연결됨', { timeout: 5000 });
      
      // 각 방에서 메시지 전송
      const message = `${roomName} 방 테스트 메시지 ${Date.now()}`;
      await page.fill('[data-testid="chat-input"]', message);
      await page.press('[data-testid="chat-input"]', 'Enter');
      
      await expect(page.locator(`text=${message}`)).toBeVisible();
    }
    
    // === 모든 방에서 동시 알림 수신 테스트 ===
    // 첫 번째 방으로 전환 후 메시지 전송
    await page.click('[data-testid="room-tab-general"]');
    const broadcastMessage = `전체 알림 테스트 ${Date.now()}`;
    await page.fill('[data-testid="chat-input"]', broadcastMessage);
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // 다른 방들에서 알림 배지 확인
    for (const roomName of roomTabs.slice(1)) {
      await expect(page.locator(`[data-testid="room-tab-${roomName}"] .notification-badge`))
        .toBeVisible({ timeout: 3000 });
    }
    
    // === 탭 간 빠른 전환 성능 테스트 ===
    for (let i = 0; i < 10; i++) {
      const roomIndex = i % roomTabs.length;
      const roomName = roomTabs[roomIndex];
      
      const switchStart = Date.now();
      await page.click(`[data-testid="room-tab-${roomName}"]`);
      
      // 채팅 히스토리 로드 완료 대기
      await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
      
      const switchTime = Date.now() - switchStart;
      expect(switchTime).toBeLessThan(1000); // 1초 이내 전환
    }
    
    console.log('✅ 다중 채팅방 참여 테스트 완료');
  });
});

test.describe('🎮 실시간 게임 상태 동기화', () => {
  
  test('🏸 실시간 게임 점수 동기화', async ({ browser }) => {
    console.log('🏸 실시간 게임 점수 동기화 테스트 시작...');
    
    // 4명의 플레이어 (2 vs 2 복식 게임)
    const contexts = await Promise.all(
      Array.from({ length: 4 }, () => browser.newContext())
    );
    
    const pages = await Promise.all(contexts.map(async (context, index) => {
      const page = await context.newPage();
      await SocketTestHelper.injectSocketMonitor(page);
      
      await page.evaluate((playerId) => {
        localStorage.setItem('auth_token', `player-${playerId}-token`);
        localStorage.setItem('user_profile', JSON.stringify({
          id: `player-${playerId}`,
          name: `플레이어${playerId}`,
          team: playerId < 2 ? 'A' : 'B'
        }));
      }, index);
      
      return page;
    }));
    
    try {
      // 모든 플레이어가 게임방 입장
      await Promise.all(pages.map(async (page, index) => {
        await page.goto('/game/realtime-match-1');
        await SocketTestHelper.waitForSocketEvent(page, 'connected');
        
        // 게임 참가 확인
        await expect(page.locator('[data-testid="game-lobby"]')).toBeVisible();
        await page.click('[data-testid="join-game-button"]');
      }));
      
      // 게임 시작 (첫 번째 플레이어가 시작)
      await pages[0].click('[data-testid="start-game-button"]');
      
      // 모든 플레이어에게 게임 시작 알림 전파 확인
      await Promise.all(pages.map(page => 
        expect(page.locator('[data-testid="game-started"]')).toBeVisible({ timeout: 5000 })
      ));
      
      // === 실시간 점수 업데이트 테스트 ===
      const scoreUpdates = [
        { team: 'A', expectedScore: [1, 0] },
        { team: 'B', expectedScore: [1, 1] },
        { team: 'A', expectedScore: [2, 1] },
        { team: 'A', expectedScore: [3, 1] },
        { team: 'B', expectedScore: [3, 2] }
      ];
      
      for (const { team, expectedScore } of scoreUpdates) {
        // 해당 팀 플레이어가 점수 추가
        const playerIndex = team === 'A' ? 0 : 2;
        const scorerPage = pages[playerIndex];
        
        await scorerPage.click(`[data-testid="add-score-team-${team}"]`);
        
        // 모든 플레이어에게 점수 동기화 확인
        await Promise.all(pages.map(page => 
          expect(page.locator('[data-testid="team-a-score"]')).toHaveText(expectedScore[0].toString(), { timeout: 3000 })
        ));
        
        await Promise.all(pages.map(page => 
          expect(page.locator('[data-testid="team-b-score"]')).toHaveText(expectedScore[1].toString(), { timeout: 3000 })
        ));
      }
      
      // === 게임 상태 이벤트 동기화 ===
      // 타임아웃 요청 (팀 A)
      await pages[0].click('[data-testid="request-timeout-button"]');
      
      // 모든 플레이어에게 타임아웃 알림
      await Promise.all(pages.map(page =>
        expect(page.locator('[data-testid="timeout-notification"]')).toBeVisible({ timeout: 3000 })
      ));
      
      // 타임아웃 해제
      await pages[0].click('[data-testid="resume-game-button"]');
      
      // 게임 재개 확인
      await Promise.all(pages.map(page =>
        expect(page.locator('[data-testid="game-resumed"]')).toBeVisible({ timeout: 3000 })
      ));
      
      console.log('✅ 실시간 게임 점수 동기화 테스트 완료');
      
    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('👥 플레이어 입장/퇴장 실시간 알림', async ({ browser }) => {
    console.log('👥 플레이어 입장/퇴장 알림 테스트 시작...');
    
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await Promise.all([
      SocketTestHelper.injectSocketMonitor(page1),
      SocketTestHelper.injectSocketMonitor(page2)
    ]);
    
    // 첫 번째 플레이어 입장
    await page1.evaluate(() => {
      localStorage.setItem('auth_token', 'watcher-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'watcher', name: '관전자'
      }));
    });
    
    await page1.goto('/game/lobby-test');
    await SocketTestHelper.waitForSocketEvent(page1, 'connected');
    
    // 두 번째 플레이어 입장 시 실시간 알림
    await page2.evaluate(() => {
      localStorage.setItem('auth_token', 'joiner-token');
      localStorage.setItem('user_profile', JSON.stringify({
        id: 'joiner', name: '신규참가자'
      }));
    });
    
    await page2.goto('/game/lobby-test');
    await SocketTestHelper.waitForSocketEvent(page2, 'connected');
    
    // 첫 번째 플레이어 화면에 입장 알림 확인
    await expect(page1.locator('[data-testid="player-joined"]')).toBeVisible({ timeout: 5000 });
    await expect(page1.locator('text=신규참가자님이 입장했습니다')).toBeVisible();
    
    // 플레이어 목록 업데이트 확인
    await expect(page1.locator('[data-testid="player-list"]')).toContainText('신규참가자');
    
    // === 플레이어 퇴장 테스트 ===
    await page2.close();
    
    // 첫 번째 플레이어 화면에 퇴장 알림 확인
    await expect(page1.locator('[data-testid="player-left"]')).toBeVisible({ timeout: 5000 });
    await expect(page1.locator('text=신규참가자님이 퇴장했습니다')).toBeVisible();
    
    // 플레이어 목록에서 제거 확인
    await expect(page1.locator('[data-testid="player-list"]')).not.toContainText('신규참가자');
    
    await context1.close();
    await context2.close();
    
    console.log('✅ 플레이어 입장/퇴장 알림 테스트 완료');
  });
});