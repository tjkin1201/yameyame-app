# 백엔드 API 서버 아키텍처 설계

## 🏗️ 시스템 아키텍처 개요

동배즐 백엔드는 Node.js/Express 기반의 RESTful API 서버로, Naver Band 연동, 실시간 채팅, 게임 관리 등의 핵심 기능을 제공합니다.

### 전체 시스템 구성도
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │◄──►│  Load Balancer  │◄──►│   Naver Band    │
│      앱         │    │   (AWS ALB)     │    │      API        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   API Gateway   │
                       │ (AWS API GW)    │
                       └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ Auth Service │ │ Core API    │ │ Socket.io  │
        │ (Node.js)    │ │ (Node.js)   │ │  Server    │
        └──────────────┘ └─────────────┘ └────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │    Redis     │ │  MongoDB    │ │   Redis    │
        │  (Session)   │ │ (Main DB)   │ │  (Cache)   │
        └──────────────┘ └─────────────┘ └────────────┘
```

## 🚀 서버 인프라 설계

### 1. AWS 인프라 구성
```yaml
# infrastructure/aws-architecture.yml
Production:
  Region: ap-northeast-2 (Seoul)
  VPC:
    CIDR: 10.0.0.0/16
    Subnets:
      Public: 
        - 10.0.1.0/24 (ALB)
        - 10.0.2.0/24 (NAT Gateway)
      Private:
        - 10.0.3.0/24 (API Servers)
        - 10.0.4.0/24 (Database)
        - 10.0.5.0/24 (Cache)

  Compute:
    ALB: Application Load Balancer
    ECS: 
      - Cluster: dongbaejul-cluster
      - Services: auth-service, api-service, socket-service
      - Tasks: Fargate (2 vCPU, 4GB RAM)
      
  Database:
    MongoDB: Atlas M10 cluster (3 nodes)
    Redis: ElastiCache (2 nodes, Multi-AZ)
    
  Storage:
    S3: Static assets, logs, backups
    CloudFront: CDN for image delivery
    
  Security:
    WAF: Web Application Firewall
    Certificate Manager: SSL/TLS certificates
    Secrets Manager: API keys, DB credentials
```

### 2. 환경별 설정
```javascript
// config/environments.js
const environments = {
  development: {
    port: 3000,
    mongodb_uri: process.env.MONGODB_DEV_URI,
    redis_url: process.env.REDIS_DEV_URL,
    band_api_url: 'https://openapi.band.us/v2',
    log_level: 'debug'
  },
  
  staging: {
    port: 3000,
    mongodb_uri: process.env.MONGODB_STAGING_URI,
    redis_url: process.env.REDIS_STAGING_URL,
    band_api_url: 'https://openapi.band.us/v2',
    log_level: 'info'
  },
  
  production: {
    port: 3000,
    mongodb_uri: process.env.MONGODB_PROD_URI,
    redis_url: process.env.REDIS_PROD_URL,
    band_api_url: 'https://openapi.band.us/v2',
    log_level: 'warn',
    rate_limit: {
      window_ms: 900000, // 15분
      max_requests: 1000
    }
  }
};
```

## 📡 API 엔드포인트 설계

### 1. API 버전 관리 및 구조
```
Base URL: https://api.dongbaejul.com/v1

Authentication: Bearer Token (JWT)
Content-Type: application/json
Rate Limit: 1000 requests/15min per user
```

### 2. 인증 관련 API
```javascript
// routes/auth.js
/**
 * @swagger
 * /api/v1/auth:
 */

// Band OAuth 인증 시작
POST   /api/v1/auth/band/login
Body: { band_code: string, redirect_uri: string }
Response: { auth_url: string, state: string }

// Band OAuth 콜백 처리
POST   /api/v1/auth/band/callback
Body: { code: string, state: string }
Response: { 
  access_token: string, 
  refresh_token: string, 
  user: UserProfile,
  permissions: string[]
}

// 토큰 갱신
POST   /api/v1/auth/refresh
Body: { refresh_token: string }
Response: { access_token: string, expires_in: number }

// 로그아웃
POST   /api/v1/auth/logout
Headers: { Authorization: "Bearer {token}" }
Response: { message: "success" }

// 토큰 검증
GET    /api/v1/auth/verify
Headers: { Authorization: "Bearer {token}" }
Response: { valid: boolean, user: UserProfile }
```

### 3. 사용자 관리 API
```javascript
// routes/users.js

// 사용자 프로필 조회
GET    /api/v1/users/profile
Headers: { Authorization: "Bearer {token}" }
Response: { user: UserProfile, stats: UserStats }

// 사용자 프로필 업데이트
PUT    /api/v1/users/profile
Body: { display_name: string, avatar: string, preferences: object }
Response: { user: UserProfile }

// 클럽 멤버 목록
GET    /api/v1/users/members
Query: { page: number, limit: number, search: string }
Response: { 
  members: Member[], 
  pagination: { total: number, page: number, pages: number }
}

// 멤버 상세 정보
GET    /api/v1/users/members/:memberId
Response: { member: Member, stats: MemberStats }

// Band 멤버 동기화
POST   /api/v1/users/sync-band
Headers: { Authorization: "Bearer {admin-token}" }
Response: { 
  synced_count: number, 
  new_members: number, 
  updated_members: number 
}
```

### 4. 게시판 API
```javascript
// routes/posts.js

// 게시글 목록
GET    /api/v1/posts
Query: { 
  page: number, 
  limit: number, 
  category: string, 
  search: string,
  pinned: boolean 
}
Response: { 
  posts: Post[], 
  pagination: PaginationInfo 
}

// 게시글 상세
GET    /api/v1/posts/:postId
Response: { 
  post: Post, 
  comments: Comment[], 
  user_interaction: { liked: boolean, read: boolean }
}

// 게시글 생성
POST   /api/v1/posts
Body: { 
  title: string, 
  content: string, 
  category: string,
  is_pinned: boolean,
  attachments: string[]
}
Response: { post: Post }

// 게시글 수정
PUT    /api/v1/posts/:postId
Body: { title: string, content: string, is_pinned: boolean }
Response: { post: Post }

// 게시글 삭제
DELETE /api/v1/posts/:postId
Response: { message: "success" }

// 게시글 좋아요
POST   /api/v1/posts/:postId/like
Response: { liked: boolean, like_count: number }

// 댓글 작성
POST   /api/v1/posts/:postId/comments
Body: { content: string, parent_id?: string }
Response: { comment: Comment }

// 댓글 수정
PUT    /api/v1/posts/:postId/comments/:commentId
Body: { content: string }
Response: { comment: Comment }

// 댓글 삭제
DELETE /api/v1/posts/:postId/comments/:commentId
Response: { message: "success" }
```

### 5. 게임 관리 API
```javascript
// routes/games.js

// 게임 목록
GET    /api/v1/games
Query: { 
  status: 'scheduled|ongoing|completed',
  date_from: string,
  date_to: string,
  page: number,
  limit: number
}
Response: { games: Game[], pagination: PaginationInfo }

// 게임 생성
POST   /api/v1/games
Body: {
  title: string,
  description: string,
  game_date: string,
  duration: number,
  max_participants: number,
  skill_level: string,
  game_type: string
}
Response: { game: Game }

// 게임 참가
POST   /api/v1/games/:gameId/join
Response: { 
  game: Game, 
  participant_status: 'joined|waiting_list' 
}

// 게임 참가 취소
DELETE /api/v1/games/:gameId/join
Response: { game: Game }

// 게임 시작
POST   /api/v1/games/:gameId/start
Body: { court_id: string }
Response: { game: Game }

// 점수 업데이트
PUT    /api/v1/games/:gameId/score
Body: { 
  set_number: number,
  team1_score: number,
  team2_score: number
}
Response: { game: Game }

// 게임 완료
POST   /api/v1/games/:gameId/complete
Body: { 
  final_score: object,
  winner: string,
  mvp: string,
  game_stats: object
}
Response: { game: Game }
```

### 6. 채팅 API
```javascript
// routes/chat.js

// 채팅방 목록
GET    /api/v1/chat/rooms
Response: { rooms: ChatRoom[] }

// 채팅방 생성
POST   /api/v1/chat/rooms
Body: { 
  name: string, 
  type: 'global|private|group',
  participants: string[]
}
Response: { room: ChatRoom }

// 메시지 히스토리
GET    /api/v1/chat/rooms/:roomId/messages
Query: { before: string, limit: number }
Response: { 
  messages: Message[], 
  has_more: boolean 
}

// 메시지 읽음 처리
PUT    /api/v1/chat/rooms/:roomId/read
Body: { message_ids: string[] }
Response: { message: "success" }
```

### 7. 사진첩 API (Band 연동)
```javascript
// routes/photos.js

// Band 앨범 동기화
POST   /api/v1/photos/sync
Response: { 
  albums_synced: number, 
  photos_synced: number,
  last_sync: string
}

// 앨범 목록
GET    /api/v1/photos/albums
Response: { 
  albums: BandAlbum[],
  sync_status: SyncStatus
}

// 앨범 사진 목록
GET    /api/v1/photos/albums/:albumId/photos
Query: { page: number, limit: number }
Response: { 
  photos: BandPhoto[],
  pagination: PaginationInfo
}
```

## 🔧 서비스 레이어 아키텍처

### 1. 마이크로서비스 구조
```javascript
// services/index.js
const services = {
  AuthService: require('./auth.service'),
  UserService: require('./user.service'),
  PostService: require('./post.service'),
  GameService: require('./game.service'),
  ChatService: require('./chat.service'),
  BandSyncService: require('./band-sync.service'),
  NotificationService: require('./notification.service')
};

module.exports = services;
```

### 2. 인증 서비스
```javascript
// services/auth.service.js
class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.bandAPI = new BandAPIClient();
  }

  // Band OAuth 인증
  async authenticateWithBand(authCode, redirectUri) {
    try {
      // 1. Band OAuth 토큰 교환
      const bandTokens = await this.bandAPI.exchangeCode(authCode, redirectUri);
      
      // 2. Band 사용자 정보 조회
      const bandUserInfo = await this.bandAPI.getUserInfo(bandTokens.access_token);
      
      // 3. 사용자 DB 조회/생성
      let user = await UserModel.findOne({ band_user_id: bandUserInfo.user_key });
      
      if (!user) {
        user = await this.createUserFromBand(bandUserInfo, bandTokens);
      } else {
        user = await this.updateUserFromBand(user, bandUserInfo, bandTokens);
      }
      
      // 4. JWT 토큰 생성
      const tokens = this.generateTokens(user);
      
      // 5. 세션 저장
      await this.saveUserSession(user.id, tokens.refresh_token);
      
      return {
        user,
        tokens,
        permissions: await this.getUserPermissions(user)
      };
    } catch (error) {
      throw new Error(`Band 인증 실패: ${error.message}`);
    }
  }

  // JWT 토큰 생성
  generateTokens(user) {
    const payload = {
      user_id: user._id,
      band_user_id: user.band_user_id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const access_token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refresh_token = jwt.sign(
      { user_id: user._id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: '30d' }
    );

    return { access_token, refresh_token };
  }

  // 토큰 검증
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await UserModel.findById(decoded.user_id);
      
      if (!user || user.status !== 'active') {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      return { user, decoded };
    } catch (error) {
      throw new Error('유효하지 않은 토큰입니다');
    }
  }

  // 토큰 갱신
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('유효하지 않은 refresh token입니다');
      }

      const user = await UserModel.findById(decoded.user_id);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 새 access token 생성
      const newTokens = this.generateTokens(user);
      
      // 새 refresh token으로 세션 업데이트
      await this.saveUserSession(user.id, newTokens.refresh_token);
      
      return newTokens;
    } catch (error) {
      throw new Error('토큰 갱신 실패');
    }
  }
}

module.exports = AuthService;
```

### 3. Band 동기화 서비스
```javascript
// services/band-sync.service.js
class BandSyncService {
  constructor() {
    this.bandAPI = new BandAPIClient();
    this.syncInterval = 30 * 60 * 1000; // 30분
    this.maxRetries = 3;
  }

  // 자동 동기화 시작
  startAutoSync() {
    setInterval(async () => {
      try {
        await this.syncAllData();
      } catch (error) {
        logger.error('자동 동기화 실패:', error);
      }
    }, this.syncInterval);
  }

  // 전체 데이터 동기화
  async syncAllData() {
    const clubId = process.env.CLUB_ID;
    const bandKey = process.env.BAND_KEY;

    try {
      // 1. 멤버 동기화
      const memberResult = await this.syncMembers(clubId, bandKey);
      
      // 2. 게시글 동기화 (선택적)
      const postResult = await this.syncPosts(clubId, bandKey);
      
      // 3. 앨범 동기화
      const albumResult = await this.syncAlbums(clubId, bandKey);

      // 4. 동기화 결과 저장
      await this.saveSyncResult(clubId, {
        members: memberResult,
        posts: postResult,
        albums: albumResult,
        timestamp: new Date()
      });

      return {
        success: true,
        results: { memberResult, postResult, albumResult }
      };
    } catch (error) {
      await this.saveSyncError(clubId, error);
      throw error;
    }
  }

  // 멤버 동기화
  async syncMembers(clubId, bandKey) {
    let syncedCount = 0;
    let newMembers = 0;
    let updatedMembers = 0;

    try {
      const bandMembers = await this.bandAPI.getMembers(bandKey);

      for (const bandMember of bandMembers) {
        const existingUser = await UserModel.findOne({ 
          band_user_id: bandMember.user_key 
        });

        if (existingUser) {
          // 기존 사용자 업데이트
          await this.updateUserFromBand(existingUser, bandMember);
          updatedMembers++;
        } else {
          // 새 사용자 생성
          await this.createUserFromBand(bandMember);
          newMembers++;
        }
        
        syncedCount++;
      }

      return { syncedCount, newMembers, updatedMembers };
    } catch (error) {
      throw new Error(`멤버 동기화 실패: ${error.message}`);
    }
  }

  // Retry 로직이 포함된 Band API 호출
  async callBandAPIWithRetry(apiCall, maxRetries = this.maxRetries) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        if (error.status === 429) { // Rate limit
          const delay = Math.pow(2, attempt) * 1000; // 지수 백오프
          logger.warn(`Rate limit 도달, ${delay}ms 후 재시도 (${attempt}/${maxRetries})`);
          await this.sleep(delay);
        } else if (attempt === maxRetries) {
          break;
        } else {
          await this.sleep(1000 * attempt);
        }
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BandSyncService;
```

## 🔌 Socket.io 서버 설계

### 1. Socket 서버 구조
```javascript
// socket/socket.server.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketServer {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket']
    });

    this.connectedUsers = new Map();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // JWT 인증 미들웨어
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await UserModel.findById(decoded.user_id);
        if (!user) {
          throw new Error('사용자를 찾을 수 없습니다');
        }

        socket.userId = user._id.toString();
        socket.userInfo = {
          id: user._id,
          name: user.display_name || user.band_data.name,
          avatar: user.custom_avatar || user.band_data.profile_image
        };

        next();
      } catch (error) {
        next(new Error('인증 실패'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    
    // 사용자 연결 관리
    this.connectedUsers.set(userId, socket.id);
    
    // 온라인 상태 브로드캐스트
    socket.broadcast.emit('user:online', userId);

    // 채팅방 이벤트
    this.setupChatEvents(socket);
    
    // 게임 이벤트
    this.setupGameEvents(socket);
    
    // 연결 해제 처리
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  setupChatEvents(socket) {
    // 채팅방 입장
    socket.on('room:join', ({ roomId }) => {
      socket.join(roomId);
      socket.to(roomId).emit('user:joined', socket.userInfo);
    });

    // 메시지 전송
    socket.on('message:send', async (messageData) => {
      try {
        // 메시지 DB 저장
        const message = await ChatService.saveMessage({
          ...messageData,
          senderId: socket.userId,
          senderInfo: socket.userInfo
        });

        // 채팅방 참가자들에게 전송
        socket.to(messageData.roomId).emit('message:received', message);
        
        // 전송자에게 확인 응답
        socket.emit('message:sent', { 
          tempId: messageData.tempId, 
          messageId: message._id 
        });

      } catch (error) {
        socket.emit('message:error', { 
          tempId: messageData.tempId, 
          error: error.message 
        });
      }
    });

    // 타이핑 상태
    socket.on('typing:status', ({ roomId, isTyping }) => {
      socket.to(roomId).emit(isTyping ? 'typing:start' : 'typing:stop', {
        userId: socket.userId,
        userName: socket.userInfo.name,
        roomId
      });
    });
  }

  setupGameEvents(socket) {
    // 게임 점수 업데이트
    socket.on('game:score_update', async ({ gameId, score }) => {
      try {
        const updatedGame = await GameService.updateScore(gameId, score);
        
        // 게임 참가자들에게 전송
        this.io.emit('game:score_updated', {
          gameId,
          score: updatedGame.score,
          updatedBy: socket.userInfo
        });

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // 게임 상태 변경
    socket.on('game:status_change', async ({ gameId, status }) => {
      try {
        const updatedGame = await GameService.updateStatus(gameId, status);
        
        this.io.emit('game:status_changed', {
          gameId,
          status: updatedGame.status,
          game: updatedGame
        });

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  }

  handleDisconnection(socket) {
    const userId = socket.userId;
    
    // 연결된 사용자 목록에서 제거
    this.connectedUsers.delete(userId);
    
    // 오프라인 상태 브로드캐스트
    socket.broadcast.emit('user:offline', userId);
  }

  // 특정 사용자에게 메시지 전송
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // 전체 브로드캐스트
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = SocketServer;
```

## 🗄️ 데이터베이스 최적화

### 1. MongoDB 연결 및 설정
```javascript
// database/mongodb.js
const mongoose = require('mongoose');

class MongoDBManager {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // 최대 연결 수
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0
      };

      this.connection = await mongoose.connect(
        process.env.MONGODB_URI,
        options
      );

      // 연결 이벤트 리스너
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB 연결됨');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB 연결 오류:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB 연결 끊김');
      });

    } catch (error) {
      logger.error('MongoDB 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.connection.close();
    }
  }
}

module.exports = new MongoDBManager();
```

### 2. 캐시 전략 (Redis)
```javascript
// cache/redis.manager.js
const redis = require('redis');

class CacheManager {
  constructor() {
    this.client = null;
    this.defaultTTL = 3600; // 1시간
  }

  async connect() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('Redis 서버가 거부됨');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis 재시도 시간 초과');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    await this.client.connect();
  }

  // 캐시 저장
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
    } catch (error) {
      logger.error('캐시 저장 실패:', error);
    }
  }

  // 캐시 조회
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('캐시 조회 실패:', error);
      return null;
    }
  }

  // 캐시 삭제
  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('캐시 삭제 실패:', error);
    }
  }

  // 패턴 기반 캐시 삭제
  async delPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('패턴 캐시 삭제 실패:', error);
    }
  }
}

module.exports = new CacheManager();
```

## 🔒 보안 설정

### 1. 보안 미들웨어
```javascript
// middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// CORS 설정
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단됨'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate Limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

const securityMiddleware = {
  // 기본 보안 헤더
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"]
      }
    }
  }),

  // CORS
  cors: cors(corsOptions),

  // Rate Limiting
  globalRateLimit: createRateLimit(
    15 * 60 * 1000, // 15분
    1000, // 요청 수
    '너무 많은 요청이 감지되었습니다. 나중에 다시 시도해주세요.'
  ),

  // 인증 관련 엄격한 제한
  authRateLimit: createRateLimit(
    15 * 60 * 1000, // 15분
    5, // 로그인 시도 5회
    '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.'
  ),

  // API 업로드 제한
  uploadRateLimit: createRateLimit(
    60 * 60 * 1000, // 1시간
    10, // 업로드 10회
    '파일 업로드 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.'
  )
};

module.exports = securityMiddleware;
```

## 📊 모니터링 및 로깅

### 1. 로깅 시스템
```javascript
// utils/logger.js
const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'dongbaejul-api',
    version: process.env.npm_package_version 
  },
  transports: [
    // 파일 로그
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// 개발 환경에서는 콘솔 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

### 2. 헬스체크 엔드포인트
```javascript
// routes/health.js
const express = require('express');
const router = express.Router();

// 기본 헬스체크
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

// 상세 헬스체크
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    services: {}
  };

  try {
    // MongoDB 연결 확인
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    health.services.mongodb = { status: mongoStatus };

    // Redis 연결 확인
    const redisStatus = await CacheManager.client.ping();
    health.services.redis = { status: redisStatus === 'PONG' ? 'Connected' : 'Disconnected' };

    // Band API 연결 확인
    try {
      await bandAPI.healthCheck();
      health.services.band_api = { status: 'Connected' };
    } catch (error) {
      health.services.band_api = { status: 'Error', error: error.message };
    }

    res.json(health);
  } catch (error) {
    health.status = 'ERROR';
    health.error = error.message;
    res.status(500).json(health);
  }
});

module.exports = router;
```

## 🚀 배포 설정

### 1. Docker 설정
```dockerfile
# Dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 비루트 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 권한 설정
USER nodejs

# 포트 노출
EXPOSE 3000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 애플리케이션 실행
CMD ["npm", "start"]
```

### 2. docker-compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

이 백엔드 아키텍처 설계를 통해 확장 가능하고 안정적인 서버 인프라를 구축할 수 있으며, 200명 규모의 동호회에서 발생하는 트래픽을 효율적으로 처리할 수 있습니다.