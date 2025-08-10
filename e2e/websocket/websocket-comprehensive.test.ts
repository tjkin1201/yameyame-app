import { test, expect, Page, BrowserContext } from '@playwright/test';
import { io, Socket } from 'socket.io-client';

/**
 * YameYame 실시간 채팅 포괄적 테스트 스위트
 * 
 * 테스트 범위:
 * - WebSocket 연결 안정성
 * - 멀티유저 채팅 시나리오
 * - 메시지 동기화 및 전달
 * - 연결 복원력 (재연결, 네트워크 오류)
 * - 성능 테스트 (동시 사용자 부하)
 * - 게임별 채팅방 기능
 * - 파일 공유 및 미디어 메시지
 * - 크로스 브라우저 호환성
 */

const SOCKET_SERVER_URL = 'http://localhost:3002';
const BACKEND_API_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

// 테스트용 사용자 데이터
const TEST_USERS = [
  { id: 'user1', nickname: '배드민턴러버1', role: 'member' },
  { id: 'user2', nickname: '배드민턴러버2', role: 'member' },
  { id: 'user3', nickname: '배드민턴러버3', role: 'member' },
  { id: 'user4', nickname: '관리자', role: 'admin' },
];

// 테스트용 JWT 토큰 생성 헬퍼
function generateTestToken(user: typeof TEST_USERS[0]): string {
  return Buffer.from(JSON.stringify({
    id: user.id,
    nickname: user.nickname,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1시간 만료
  })).toString('base64');
}

// Socket 클라이언트 래퍼 클래스
class TestSocketClient {
  private socket: Socket | null = null;
  private connected = false;
  private authenticated = false;
  private messages: any[] = [];
  private events: { type: string; data: any; timestamp: number }[] = [];

  constructor(private user: typeof TEST_USERS[0]) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for ${this.user.nickname}`));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log(`✅ ${this.user.nickname} connected`);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Connection failed for ${this.user.nickname}: ${error.message}`));
      });

      this.setupEventListeners();
    });
  }

  async authenticate(): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const token = generateTestToken(this.user);
      
      this.socket!.emit('auth:authenticate', token, (result: any) => {
        if (result.success) {
          this.authenticated = true;
          console.log(`✅ ${this.user.nickname} authenticated`);
          resolve();
        } else {
          reject(new Error(`Authentication failed for ${this.user.nickname}: ${result.error}`));
        }
      });
    });
  }

  async joinRoom(roomId: string): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');

    return new Promise((resolve, reject) => {
      this.socket!.emit('room:join', roomId, (result: any) => {
        if (result.success) {
          console.log(`✅ ${this.user.nickname} joined room ${roomId}`);
          resolve(result.room);
        } else {
          reject(new Error(`Failed to join room: ${result.error}`));
        }
      });
    });
  }

  async sendMessage(roomId: string, content: string): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');

    return new Promise((resolve, reject) => {
      const message = {
        type: 'chat',
        roomId,
        content: { text: content },
        metadata: { sentAt: Date.now() }
      };

      this.socket!.emit('message:send', message, (result: any) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(`Failed to send message: ${result.error}`));
        }
      });
    });
  }

  async createRoom(roomData: any): Promise<any> {
    if (!this.authenticated) throw new Error('Not authenticated');

    return new Promise((resolve, reject) => {
      this.socket!.emit('room:create', roomData, (result: any) => {
        if (result.success) {
          console.log(`✅ ${this.user.nickname} created room ${result.room.id}`);
          resolve(result.room);
        } else {
          reject(new Error(`Failed to create room: ${result.error}`));
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
      this.authenticated = false;
      console.log(`❌ ${this.user.nickname} disconnected`);
    }
  }

  // 이벤트 리스너 설정
  private setupEventListeners(): void {
    if (!this.socket) return;

    // 메시지 수신
    this.socket.on('message:received', (message) => {
      this.messages.push(message);
      this.events.push({
        type: 'message:received',
        data: message,
        timestamp: Date.now()
      });
    });

    // 룸 이벤트
    this.socket.on('room:joined', (room, participants) => {
      this.events.push({
        type: 'room:joined',
        data: { room, participants },
        timestamp: Date.now()
      });
    });

    // 사용자 상태 변경
    this.socket.on('user:status_changed', (userId, status) => {
      this.events.push({
        type: 'user:status_changed',
        data: { userId, status },
        timestamp: Date.now()
      });
    });

    // 에러
    this.socket.on('error', (error) => {
      this.events.push({
        type: 'error',
        data: error,
        timestamp: Date.now()
      });
    });
  }

  // 게터
  get isConnected(): boolean { return this.connected; }
  get isAuthenticated(): boolean { return this.authenticated; }
  get receivedMessages(): any[] { return [...this.messages]; }
  get eventHistory(): any[] { return [...this.events]; }
}

test.describe('WebSocket 연결 안정성 테스트', () => {
  test('단일 클라이언트 연결 및 인증', async () => {
    const client = new TestSocketClient(TEST_USERS[0]);
    
    try {
      await client.connect();
      expect(client.isConnected).toBe(true);
      
      await client.authenticate();
      expect(client.isAuthenticated).toBe(true);
      
    } finally {
      client.disconnect();
    }
  });

  test('동시 다중 클라이언트 연결', async () => {
    const clients = TEST_USERS.map(user => new TestSocketClient(user));
    
    try {
      // 동시 연결
      await Promise.all(clients.map(client => client.connect()));
      
      // 모든 클라이언트 연결 확인
      clients.forEach(client => {
        expect(client.isConnected).toBe(true);
      });
      
      // 동시 인증
      await Promise.all(clients.map(client => client.authenticate()));
      
      // 모든 클라이언트 인증 확인
      clients.forEach(client => {
        expect(client.isAuthenticated).toBe(true);
      });
      
    } finally {
      clients.forEach(client => client.disconnect());
    }
  });

  test('연결 복원력 - 재연결 테스트', async () => {
    const client = new TestSocketClient(TEST_USERS[0]);
    
    try {
      // 초기 연결
      await client.connect();
      await client.authenticate();
      
      // 연결 끊기
      client.disconnect();
      expect(client.isConnected).toBe(false);
      
      // 재연결
      await client.connect();
      await client.authenticate();
      expect(client.isConnected).toBe(true);
      expect(client.isAuthenticated).toBe(true);
      
    } finally {
      client.disconnect();
    }
  });
});

test.describe('멀티유저 채팅 시나리오', () => {
  test('기본 채팅방 생성 및 참여', async () => {
    const [admin, user1, user2] = TEST_USERS.slice(0, 3).map(user => new TestSocketClient(user));
    
    try {
      // 모든 클라이언트 연결 및 인증
      await Promise.all([admin.connect(), user1.connect(), user2.connect()]);
      await Promise.all([admin.authenticate(), user1.authenticate(), user2.authenticate()]);
      
      // 관리자가 채팅방 생성
      const room = await admin.createRoom({
        type: 'chat',
        name: '일반 채팅',
        isPublic: true,
        description: '동배즐 일반 채팅방'
      });
      
      expect(room.name).toBe('일반 채팅');
      expect(room.type).toBe('chat');
      
      // 사용자들이 채팅방 참여
      await Promise.all([
        user1.joinRoom(room.id),
        user2.joinRoom(room.id)
      ]);
      
      // 잠시 대기 (이벤트 전파 시간)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 참여 이벤트 확인
      const user1Events = user1.eventHistory.filter(e => e.type === 'room:joined');
      expect(user1Events.length).toBeGreaterThan(0);
      
    } finally {
      [admin, user1, user2].forEach(client => client.disconnect());
    }
  });

  test('게임별 채팅방 기능', async () => {
    const clients = TEST_USERS.slice(0, 4).map(user => new TestSocketClient(user));
    
    try {
      // 모든 클라이언트 연결 및 인증
      await Promise.all(clients.map(client => client.connect()));
      await Promise.all(clients.map(client => client.authenticate()));
      
      // 게임 채팅방 생성
      const gameRoom = await clients[0].createRoom({
        type: 'game',
        name: '복식 게임방',
        gameType: 'doubles',
        maxPlayers: 4,
        isPublic: true
      });
      
      expect(gameRoom.type).toBe('game');
      expect(gameRoom.name).toBe('복식 게임방');
      
      // 모든 플레이어가 게임방 참여
      await Promise.all(
        clients.slice(1).map(client => client.joinRoom(gameRoom.id))
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 게임방 참여자 수 확인 (테스트 목적상 이벤트 히스토리로 확인)
      clients.forEach(client => {
        const roomEvents = client.eventHistory.filter(e => e.type === 'room:joined');
        expect(roomEvents.length).toBeGreaterThan(0);
      });
      
    } finally {
      clients.forEach(client => client.disconnect());
    }
  });

  test('실시간 메시지 동기화', async () => {
    const [sender, receiver1, receiver2] = TEST_USERS.slice(0, 3).map(user => new TestSocketClient(user));
    
    try {
      // 연결 및 인증
      await Promise.all([sender.connect(), receiver1.connect(), receiver2.connect()]);
      await Promise.all([sender.authenticate(), receiver1.authenticate(), receiver2.authenticate()]);
      
      // 채팅방 생성 및 참여
      const room = await sender.createRoom({
        type: 'chat',
        name: '메시지 동기화 테스트',
        isPublic: true
      });
      
      await Promise.all([
        receiver1.joinRoom(room.id),
        receiver2.joinRoom(room.id)
      ]);
      
      // 메시지 전송
      const testMessages = [
        '안녕하세요! 👋',
        '오늘 배드민턴 어떠셨나요?',
        '다음 주 경기 준비됐나요? 🏸'
      ];
      
      for (const message of testMessages) {
        await sender.sendMessage(room.id, message);
        await new Promise(resolve => setTimeout(resolve, 500)); // 메시지 간격
      }
      
      // 메시지 수신 확인을 위한 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 수신자들의 메시지 수신 확인
      expect(receiver1.receivedMessages.length).toBe(testMessages.length);
      expect(receiver2.receivedMessages.length).toBe(testMessages.length);
      
      // 메시지 내용 확인
      testMessages.forEach((expectedMessage, index) => {
        expect(receiver1.receivedMessages[index].content.text).toBe(expectedMessage);
        expect(receiver2.receivedMessages[index].content.text).toBe(expectedMessage);
      });
      
    } finally {
      [sender, receiver1, receiver2].forEach(client => client.disconnect());
    }
  });
});

test.describe('성능 및 부하 테스트', () => {
  test('동시 사용자 부하 테스트', async ({ browserName }, testInfo) => {
    // 브라우저별로 다른 부하 레벨 설정
    const loadConfig = {
      'chromium': { clients: 20, messages: 5 },
      'firefox': { clients: 15, messages: 5 },
      'webkit': { clients: 10, messages: 3 }
    };
    
    const config = loadConfig[browserName as keyof typeof loadConfig] || loadConfig.chromium;
    const clients: TestSocketClient[] = [];
    
    try {
      console.log(`🔥 Starting load test with ${config.clients} clients`);
      
      // 클라이언트 생성 (동일한 사용자 정보 재사용)
      for (let i = 0; i < config.clients; i++) {
        const userIndex = i % TEST_USERS.length;
        const user = { ...TEST_USERS[userIndex], id: `${TEST_USERS[userIndex].id}_${i}` };
        clients.push(new TestSocketClient(user));
      }
      
      const startTime = Date.now();
      
      // 점진적 연결 (서버 부하 분산)
      const connectionBatch = 5;
      for (let i = 0; i < clients.length; i += connectionBatch) {
        const batch = clients.slice(i, i + connectionBatch);
        await Promise.all(batch.map(client => client.connect()));
        await Promise.all(batch.map(client => client.authenticate()));
        
        if (i + connectionBatch < clients.length) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 배치 간 대기
        }
      }
      
      const connectionTime = Date.now() - startTime;
      console.log(`✅ All ${clients.length} clients connected in ${connectionTime}ms`);
      
      // 공통 채팅방 생성
      const room = await clients[0].createRoom({
        type: 'chat',
        name: '부하 테스트 방',
        isPublic: true
      });
      
      // 모든 클라이언트 룸 참여
      await Promise.all(clients.slice(1).map(client => client.joinRoom(room.id)));
      
      // 메시지 전송 부하 테스트
      const messageStartTime = Date.now();
      const messagePromises: Promise<any>[] = [];
      
      clients.forEach((client, index) => {
        for (let i = 0; i < config.messages; i++) {
          const promise = client.sendMessage(room.id, `부하테스트 메시지 ${index}-${i}`);
          messagePromises.push(promise);
        }
      });
      
      await Promise.all(messagePromises);
      const messageTime = Date.now() - messageStartTime;
      
      console.log(`✅ Sent ${messagePromises.length} messages in ${messageTime}ms`);
      console.log(`📊 Performance: ${(messagePromises.length / messageTime * 1000).toFixed(2)} msg/sec`);
      
      // 성능 기준 검증
      expect(connectionTime).toBeLessThan(10000); // 10초 내 연결 완료
      expect(messageTime).toBeLessThan(15000); // 15초 내 메시지 전송 완료
      
    } finally {
      // 정리 (배치 단위로 연결 해제)
      const disconnectionBatch = 10;
      for (let i = 0; i < clients.length; i += disconnectionBatch) {
        const batch = clients.slice(i, i + disconnectionBatch);
        batch.forEach(client => client.disconnect());
        
        if (i + disconnectionBatch < clients.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('🧹 All clients disconnected');
    }
  }).setTimeout(60000); // 1분 타임아웃

  test('메시지 지연 시간 측정', async () => {
    const client1 = new TestSocketClient(TEST_USERS[0]);
    const client2 = new TestSocketClient(TEST_USERS[1]);
    const latencies: number[] = [];
    
    try {
      await Promise.all([client1.connect(), client2.connect()]);
      await Promise.all([client1.authenticate(), client2.authenticate()]);
      
      const room = await client1.createRoom({
        type: 'chat',
        name: '지연 시간 테스트',
        isPublic: true
      });
      
      await client2.joinRoom(room.id);
      
      // 메시지 전송 및 지연 시간 측정
      const testCount = 10;
      for (let i = 0; i < testCount; i++) {
        const sendTime = Date.now();
        
        // 메시지 전송
        await client1.sendMessage(room.id, `지연시간 테스트 ${i + 1}`);
        
        // 수신 확인
        await new Promise<void>((resolve) => {
          const checkMessage = () => {
            if (client2.receivedMessages.length > i) {
              const receiveTime = Date.now();
              latencies.push(receiveTime - sendTime);
              resolve();
            } else {
              setTimeout(checkMessage, 10);
            }
          };
          checkMessage();
        });
        
        await new Promise(resolve => setTimeout(resolve, 100)); // 메시지 간격
      }
      
      // 지연 시간 통계
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      console.log(`📊 Latency Stats:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min: ${minLatency}ms`);
      console.log(`   Max: ${maxLatency}ms`);
      
      // 성능 기준 검증
      expect(avgLatency).toBeLessThan(200); // 평균 200ms 미만
      expect(maxLatency).toBeLessThan(500); // 최대 500ms 미만
      
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});

test.describe('크로스 브라우저 WebSocket 호환성', () => {
  test('브라우저별 WebSocket 연결 테스트', async ({ browserName, page }) => {
    console.log(`🌐 Testing WebSocket on ${browserName}`);
    
    const client = new TestSocketClient(TEST_USERS[0]);
    
    try {
      await client.connect();
      expect(client.isConnected).toBe(true);
      
      await client.authenticate();
      expect(client.isAuthenticated).toBe(true);
      
      // 간단한 채팅 테스트
      const room = await client.createRoom({
        type: 'chat',
        name: `${browserName} 테스트방`,
        isPublic: true
      });
      
      await client.sendMessage(room.id, `${browserName}에서 보낸 메시지`);
      
      // 메시지 수신 확인
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(client.receivedMessages.length).toBe(1);
      
      console.log(`✅ ${browserName} WebSocket test passed`);
      
    } finally {
      client.disconnect();
    }
  });

  test('WebSocket Transport 다운그레이드 테스트', async () => {
    // WebSocket이 차단될 경우 polling으로 다운그레이드되는지 테스트
    const client = new TestSocketClient(TEST_USERS[0]);
    
    // Polling 전용 클라이언트 생성
    const pollingClient = new (class extends TestSocketClient {
      async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
          this.socket = io(SOCKET_SERVER_URL, {
            transports: ['polling'], // WebSocket 비활성화
            timeout: 15000,
            forceNew: true
          });

          const timeout = setTimeout(() => {
            reject(new Error('Polling connection timeout'));
          }, 15000);

          this.socket.on('connect', () => {
            clearTimeout(timeout);
            this.connected = true;
            resolve();
          });

          this.socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });

          this.setupEventListeners();
        });
      }
    })(TEST_USERS[1]);
    
    try {
      // WebSocket 클라이언트와 Polling 클라이언트 모두 연결
      await Promise.all([client.connect(), pollingClient.connect()]);
      await Promise.all([client.authenticate(), pollingClient.authenticate()]);
      
      expect(client.isConnected).toBe(true);
      expect(pollingClient.isConnected).toBe(true);
      
      // 채팅방 생성 및 참여
      const room = await client.createRoom({
        type: 'chat',
        name: 'Transport 테스트',
        isPublic: true
      });
      
      await pollingClient.joinRoom(room.id);
      
      // 상호 메시지 전송 테스트
      await client.sendMessage(room.id, 'WebSocket에서 보낸 메시지');
      await pollingClient.sendMessage(room.id, 'Polling에서 보낸 메시지');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 메시지 수신 확인
      expect(client.receivedMessages.length).toBe(1);
      expect(pollingClient.receivedMessages.length).toBe(1);
      
    } finally {
      client.disconnect();
      pollingClient.disconnect();
    }
  });
});

test.describe('연결 복원력 및 에러 처리', () => {
  test('네트워크 중단 시뮬레이션', async ({ page, context }) => {
    const client = new TestSocketClient(TEST_USERS[0]);
    
    try {
      await client.connect();
      await client.authenticate();
      
      const room = await client.createRoom({
        type: 'chat',
        name: '복원력 테스트',
        isPublic: true
      });
      
      // 초기 메시지 전송
      await client.sendMessage(room.id, '네트워크 중단 전 메시지');
      
      // 네트워크 차단 시뮬레이션 (브라우저 컨텍스트 오프라인)
      await context.setOffline(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 네트워크 복구
      await context.setOffline(false);
      
      // 재연결 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 복구 후 메시지 전송 테스트
      await client.sendMessage(room.id, '네트워크 복구 후 메시지');
      
      // 메시지 전송 성공 확인
      expect(client.receivedMessages.length).toBeGreaterThan(0);
      
    } finally {
      await context.setOffline(false);
      client.disconnect();
    }
  });

  test('서버 과부하 상황 처리', async () => {
    const maxClients = 50;
    const clients: TestSocketClient[] = [];
    let successfulConnections = 0;
    let failedConnections = 0;
    
    try {
      console.log(`🔥 Testing server overload with ${maxClients} clients`);
      
      // 대량의 클라이언트 동시 연결 시도
      const connectionPromises = [];
      
      for (let i = 0; i < maxClients; i++) {
        const user = { ...TEST_USERS[i % TEST_USERS.length], id: `overload_${i}` };
        const client = new TestSocketClient(user);
        clients.push(client);
        
        const promise = client.connect()
          .then(() => client.authenticate())
          .then(() => successfulConnections++)
          .catch(() => failedConnections++);
        
        connectionPromises.push(promise);
      }
      
      // 모든 연결 시도 완료 대기
      await Promise.allSettled(connectionPromises);
      
      console.log(`📊 Overload test results:`);
      console.log(`   Successful connections: ${successfulConnections}`);
      console.log(`   Failed connections: ${failedConnections}`);
      console.log(`   Success rate: ${(successfulConnections / maxClients * 100).toFixed(2)}%`);
      
      // 최소 연결 성공률 검증 (70% 이상)
      expect(successfulConnections / maxClients).toBeGreaterThan(0.7);
      
    } finally {
      // 연결된 클라이언트들 정리
      clients.forEach(client => {
        if (client.isConnected) {
          client.disconnect();
        }
      });
    }
  });
});

// 테스트 설정
test.beforeAll(async () => {
  console.log('🔧 Setting up WebSocket comprehensive test suite');
  console.log(`📡 Socket Server: ${SOCKET_SERVER_URL}`);
  console.log(`🖥️  Backend API: ${BACKEND_API_URL}`);
});

test.afterAll(async () => {
  console.log('✅ WebSocket comprehensive test suite completed');
});