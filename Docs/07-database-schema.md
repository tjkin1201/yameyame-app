# 데이터베이스 스키마 설계

## 🗂️ 데이터베이스 개요

동배즐 앱은 MongoDB를 사용하여 유연하고 확장 가능한 데이터 구조를 제공합니다. 주요 데이터는 클럽 정보, 멤버 관리, 게시글, 게임 현황, 채팅 메시지로 구성됩니다.

## 📋 핵심 데이터 모델

### 1. 클럽 정보 (Club)
```javascript
const ClubSchema = {
  _id: ObjectId,
  name: String,           // "서울 동배즐 배드민턴 클럽"
  description: String,    // 클럽 소개
  logo: String,          // 로고 이미지 URL
  maxMembers: Number,    // 최대 멤버 수 (200)
  currentMembers: Number, // 현재 멤버 수
  location: {
    name: String,        // "동탄 체육관"
    address: String,     // "경기도 화성시 동탄..."
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  settings: {
    bandKey: String,     // Naver Band 연동 키 ("61541241")
    adminIds: [ObjectId], // 운영진 ID 목록
    isPublic: Boolean,   // 공개 클럽 여부
    joinApproval: Boolean, // 가입 승인 필요 여부
    defaultGameDuration: Number, // 기본 게임 시간 (분)
    courtCount: Number,  // 보유 코트 수
    operatingHours: {
      start: String,     // "09:00"
      end: String        // "22:00"
    }
  },
  stats: {
    totalGames: Number,
    totalMembers: Number,
    monthlyGames: Number,
    averageAttendance: Number
  },
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
};
```

### 2. 멤버 정보 (Member)
```javascript
const MemberSchema = {
  _id: ObjectId,
  clubId: ObjectId,
  
  // Band 연동 정보
  bandUserId: String,    // Band 사용자 ID
  bandData: {
    name: String,
    profileImage: String,
    coverImage: String,
    description: String,
    role: String,        // Band 내 역할 ('admin', 'co_admin', 'member')
    joinedAt: Date,
    lastActiveAt: Date,
    syncedAt: Date
  },
  
  // 앱 사용자 정보
  email: String,
  phone: String,
  displayName: String,   // 앱 내 표시명
  customAvatar: String,  // 커스텀 아바타 URL
  
  // 역할 및 권한
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  permissions: [String], // ['write_posts', 'manage_games', ...]
  
  // 프로필 정보
  profile: {
    // 배드민턴 관련
    badminton: {
      skillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
      },
      preferredPosition: {
        type: String,
        enum: ['singles', 'doubles_front', 'doubles_back', 'any'],
        default: 'any'
      },
      playStyle: {
        type: String,
        enum: ['aggressive', 'defensive', 'balanced'],
        default: 'balanced'
      },
      dominantHand: {
        type: String,
        enum: ['right', 'left', 'both'],
        default: 'right'
      },
      experience: Number,  // 경력 (년)
      bio: String         // 개인 소개글
    },
    
    // 연락처 정보
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  
  // 게임 통계
  gameStats: {
    totalGames: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    favoritePartner: ObjectId,
    recentForm: [Number],    // 최근 10경기 결과 (1: 승, 0: 패)
    mvpCount: { type: Number, default: 0 },
    lastGameDate: Date,
    monthlyStats: [{
      month: String,        // "2025-01"
      games: Number,
      wins: Number,
      winRate: Number
    }]
  },
  
  // 개인 설정
  preferences: {
    notifications: {
      newGames: { type: Boolean, default: true },
      gameReminders: { type: Boolean, default: true },
      chatMessages: { type: Boolean, default: true },
      clubNews: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: false }
    },
    privacy: {
      showStats: { type: Boolean, default: true },
      showProfile: { type: Boolean, default: true },
      allowDirectMessages: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true }
    },
    gamePreferences: {
      preferredTimes: [String], // ['morning', 'afternoon', 'evening']
      maxTravelDistance: { type: Number, default: 10 }, // km
      skillLevelRange: [String], // ['beginner', 'intermediate']
      autoJoinGames: { type: Boolean, default: false }
    }
  },
  
  // 상태 정보
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'pending'],
    default: 'active'
  },
  
  // 활동 정보
  activity: {
    firstLoginAt: Date,
    lastLoginAt: Date,
    lastSeenAt: Date,
    loginCount: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }, // 분 단위
    favoriteFeatures: [String],
    deviceInfo: {
      platform: String,   // 'ios', 'android'
      version: String,
      deviceId: String
    }
  },
  
  joinedAt: Date,
  updatedAt: Date
};
```

### 3. 게시글 (Post)
```javascript
const PostSchema = {
  _id: ObjectId,
  clubId: ObjectId,
  authorId: ObjectId,
  
  // 기본 정보
  title: String,
  content: String,
  excerpt: String,       // 미리보기 텍스트 (자동 생성)
  
  // 분류 및 타입
  type: {
    type: String,
    enum: ['notice', 'general', 'event', 'poll'],
    default: 'general'
  },
  category: String,      // '공지사항', '자유게시판', '이벤트'
  tags: [String],        // 태그 목록
  
  // 표시 설정
  isPinned: { type: Boolean, default: false },
  isUrgent: { type: Boolean, default: false },
  isPrivate: { type: Boolean, default: false },
  
  // 첨부파일
  attachments: [{
    type: String,        // 'image', 'file', 'link'
    url: String,
    name: String,
    size: Number,
    mimeType: String
  }],
  
  // 상호작용
  likes: [ObjectId],     // 좋아요한 사용자 IDs
  views: [{
    userId: ObjectId,
    viewedAt: Date,
    ipAddress: String
  }],
  
  // 댓글 (임베디드)
  comments: [{
    _id: ObjectId,
    authorId: ObjectId,
    content: String,
    parentId: ObjectId,  // 대댓글인 경우
    likes: [ObjectId],
    isDeleted: { type: Boolean, default: false },
    createdAt: Date,
    updatedAt: Date
  }],
  
  // 읽음 상태
  readBy: [{
    userId: ObjectId,
    readAt: Date
  }],
  
  // 통계
  stats: {
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 }
  },
  
  // 메타데이터
  metadata: {
    source: String,      // 'app', 'band_sync', 'admin'
    bandPostKey: String, // Band 게시글 연동 키
    lastSyncAt: Date,
    version: { type: Number, default: 1 },
    editHistory: [{
      editedAt: Date,
      editedBy: ObjectId,
      changes: String
    }]
  },
  
  // 상태
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'published'
  },
  
  // 예약 발행
  publishAt: Date,
  
  createdAt: Date,
  updatedAt: Date
};
```

### 4. 게임 정보 (Game)
```javascript
const GameSchema = {
  _id: ObjectId,
  clubId: ObjectId,
  creatorId: ObjectId,   // 게임 생성자 (운영진)
  
  // 기본 정보
  title: String,
  description: String,
  gameType: {
    type: String,
    enum: ['singles', 'doubles', 'mixed_doubles', 'tournament'],
    default: 'doubles'
  },
  
  // 일정 정보
  gameDate: Date,
  duration: Number,      // 예상 소요시간 (분)
  registrationDeadline: Date,
  
  // 장소 정보
  location: {
    name: String,        // 체육관 이름
    address: String,
    courtNumber: String,
    mapUrl: String
  },
  
  // 참가자 관리
  participants: [{
    userId: ObjectId,
    joinedAt: Date,
    team: String,        // 'team1', 'team2', null
    position: String,    // 'front', 'back' (복식인 경우)
    isPaid: { type: Boolean, default: false },
    paymentAmount: Number
  }],
  
  waitingList: [{
    userId: ObjectId,
    joinedAt: Date,
    priority: Number     // 대기 순서
  }],
  
  // 게임 설정
  maxParticipants: Number,
  minParticipants: { type: Number, default: 2 },
  skillLevel: {
    type: String,
    enum: ['all', 'beginner', 'intermediate', 'advanced', 'expert'],
    default: 'all'
  },
  entryFee: { type: Number, default: 0 },
  
  // 게임 진행 상태
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  
  // 게임 결과
  gameResults: {
    isCompleted: { type: Boolean, default: false },
    startTime: Date,
    endTime: Date,
    
    // 팀 구성
    teams: [{
      name: String,      // 'Team A', 'Team B'
      members: [ObjectId],
      totalScore: Number,
      setsWon: Number
    }],
    
    // 세트별 결과
    sets: [{
      setNumber: Number,
      team1Score: Number,
      team2Score: Number,
      winner: String,    // 'team1', 'team2'
      duration: Number   // 세트 소요시간 (분)
    }],
    
    // 최종 결과
    winner: String,      // 'team1', 'team2', 'draw'
    finalScore: {
      team1: Number,
      team2: Number
    },
    mvp: ObjectId,       // MVP 선정
    
    // 게임 통계
    gameStats: {
      rallies: Number,
      longestRally: Number,
      aces: Number,
      errors: Number
    }
  },
  
  // 실시간 데이터
  liveData: {
    currentSet: Number,
    currentScore: {
      team1: Number,
      team2: Number
    },
    isLive: { type: Boolean, default: false },
    courtId: ObjectId,
    spectators: [ObjectId]
  },
  
  // 규칙 및 설정
  rules: {
    sets: Number,        // 세트 수 (보통 3세트)
    pointsPerSet: Number, // 세트당 점수 (보통 21점)
    timeLimit: Number,   // 시간 제한 (분)
    allowSubstitution: { type: Boolean, default: false }
  },
  
  // 메타데이터
  metadata: {
    isRecurring: Boolean, // 정기 게임 여부
    recurringPattern: String, // 'weekly', 'monthly'
    parentGameId: ObjectId, // 정기 게임인 경우 부모 게임
    visibility: {
      type: String,
      enum: ['public', 'private', 'members_only'],
      default: 'public'
    },
    tags: [String],
    difficulty: Number   // 1-5 (난이도)
  },
  
  createdAt: Date,
  updatedAt: Date
};
```

### 5. 채팅방 (ChatRoom)
```javascript
const ChatRoomSchema = {
  _id: ObjectId,
  clubId: ObjectId,
  
  // 기본 정보
  name: String,
  description: String,
  avatar: String,        // 채팅방 아바타 URL
  
  // 채팅방 타입
  type: {
    type: String,
    enum: ['global', 'private', 'group', 'game'],
    default: 'global'
  },
  
  // 참가자
  participants: [{
    userId: ObjectId,
    joinedAt: Date,
    role: String,        // 'admin', 'member'
    lastReadAt: Date,
    isMuted: { type: Boolean, default: false },
    nickname: String
  }],
  
  // 채팅방 설정
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowInvites: { type: Boolean, default: true },
    allowFileSharing: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 100 },
    autoDeleteMessages: Number, // 일 단위 (0 = 삭제 안함)
  },
  
  // 마지막 메시지
  lastMessage: {
    messageId: ObjectId,
    content: String,
    senderId: ObjectId,
    senderName: String,
    timestamp: Date,
    type: String
  },
  
  // 통계
  stats: {
    messageCount: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 },
    lastActivityAt: Date
  },
  
  // 상태
  isActive: { type: Boolean, default: true },
  
  createdAt: Date,
  updatedAt: Date
};
```

### 6. 채팅 메시지 (Message)
```javascript
const MessageSchema = {
  _id: ObjectId,
  roomId: ObjectId,
  senderId: ObjectId,
  
  // 메시지 내용
  content: String,
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'whisper', 'poll'],
    default: 'text'
  },
  
  // 첨부파일
  attachments: [{
    type: String,        // 'image', 'file', 'audio', 'video'
    url: String,
    name: String,
    size: Number,
    mimeType: String,
    thumbnail: String    // 썸네일 URL (이미지/비디오)
  }],
  
  // 답장 정보
  replyTo: {
    messageId: ObjectId,
    content: String,     // 원본 메시지 미리보기
    senderId: ObjectId,
    senderName: String
  },
  
  // 멘션
  mentions: [{
    userId: ObjectId,
    userName: String,
    startIndex: Number,
    endIndex: Number
  }],
  
  // 읽음 확인
  readBy: [{
    userId: ObjectId,
    readAt: Date
  }],
  
  // 반응 (이모지)
  reactions: [{
    emoji: String,       // '👍', '❤️', '😂'
    users: [ObjectId],
    count: Number
  }],
  
  // 메시지 상태
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  
  // 편집 정보
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    content: String,
    editedAt: Date
  }],
  
  // 삭제 정보
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: ObjectId,
  
  // 시스템 메시지 (type이 'system'인 경우)
  systemData: {
    action: String,      // 'join', 'leave', 'game_start', 'game_end'
    targetUserId: ObjectId,
    additionalData: Object
  },
  
  // 메타데이터
  metadata: {
    clientId: String,    // 클라이언트 임시 ID
    platform: String,   // 'ios', 'android', 'web'
    ipAddress: String,
    userAgent: String
  },
  
  createdAt: Date,
  updatedAt: Date
};
```

### 7. Naver Band 동기화 정보 (BandSync)
```javascript
const BandSyncSchema = {
  _id: ObjectId,
  clubId: ObjectId,
  
  // Band 연동 정보
  bandKey: String,       // "61541241"
  accessToken: String,
  refreshToken: String,
  tokenExpiresAt: Date,
  
  // 동기화 상태
  syncStatus: {
    type: String,
    enum: ['active', 'paused', 'error', 'disabled'],
    default: 'active'
  },
  
  // 마지막 동기화 시간
  lastSyncAt: {
    members: Date,
    posts: Date,
    photos: Date,
    albums: Date
  },
  
  // 동기화 설정
  syncSettings: {
    autoSync: { type: Boolean, default: true },
    syncInterval: { type: Number, default: 30 }, // 분 단위
    syncMembers: { type: Boolean, default: true },
    syncPosts: { type: Boolean, default: true },
    syncPhotos: { type: Boolean, default: true },
    memberSyncDirection: String, // 'band_to_app', 'bidirectional'
    postSyncDirection: String    // 'band_to_app', 'app_to_band', 'bidirectional'
  },
  
  // 동기화 통계
  syncStats: {
    totalSyncs: { type: Number, default: 0 },
    successfulSyncs: { type: Number, default: 0 },
    failedSyncs: { type: Number, default: 0 },
    lastSyncDuration: Number, // 초 단위
    averageSyncDuration: Number,
    dataTransferred: Number // 바이트 단위
  },
  
  // 오류 로그
  errorLog: [{
    timestamp: Date,
    errorType: String,   // 'auth_failed', 'api_error', 'network_error'
    errorMessage: String,
    errorDetails: Object,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date
  }],
  
  // 매핑 정보
  mappings: {
    members: [{
      bandUserId: String,
      appUserId: ObjectId,
      mappedAt: Date
    }],
    posts: [{
      bandPostKey: String,
      appPostId: ObjectId,
      mappedAt: Date
    }],
    albums: [{
      bandAlbumKey: String,
      appAlbumId: ObjectId,
      mappedAt: Date
    }]
  },
  
  createdAt: Date,
  updatedAt: Date
};
```

## 🔍 인덱스 전략

### 성능 최적화를 위한 인덱스
```javascript
// 멤버 관련 인덱스
db.members.createIndex({ clubId: 1, status: 1 });
db.members.createIndex({ bandUserId: 1 }, { unique: true });
db.members.createIndex({ email: 1 }, { unique: true, sparse: true });
db.members.createIndex({ "activity.lastLoginAt": -1 });

// 게시글 관련 인덱스
db.posts.createIndex({ clubId: 1, isPinned: -1, createdAt: -1 });
db.posts.createIndex({ clubId: 1, type: 1, status: 1 });
db.posts.createIndex({ authorId: 1, createdAt: -1 });
db.posts.createIndex({ tags: 1 });
db.posts.createIndex({ 
  title: "text", 
  content: "text" 
}, { 
  weights: { title: 10, content: 5 },
  name: "post_search_index"
});

// 게임 관련 인덱스
db.games.createIndex({ 
  clubId: 1, 
  status: 1, 
  gameDate: 1,
  skillLevel: 1 
});
db.games.createIndex({ creatorId: 1, createdAt: -1 });
db.games.createIndex({ "participants.userId": 1 });
db.games.createIndex({ gameDate: 1, status: 1 });

// 채팅 관련 인덱스
db.chatrooms.createIndex({ clubId: 1, type: 1 });
db.chatrooms.createIndex({ "participants.userId": 1 });

db.messages.createIndex({ roomId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1, createdAt: -1 });
db.messages.createIndex({ "mentions.userId": 1 });
db.messages.createIndex({ 
  content: "text" 
}, { 
  name: "message_search_index"
});

// Band 동기화 관련 인덱스
db.bandsync.createIndex({ clubId: 1 }, { unique: true });
db.bandsync.createIndex({ bandKey: 1 });
db.bandsync.createIndex({ "lastSyncAt.members": 1 });
```

### 복합 인덱스
```javascript
// 게임 검색 최적화
db.games.createIndex({ 
  clubId: 1, 
  status: 1, 
  gameDate: 1,
  skillLevel: 1,
  gameType: 1
});

// 메시지 실시간 조회 최적화
db.messages.createIndex({
  roomId: 1,
  createdAt: -1,
  status: 1
});

// 멤버 통계 조회 최적화
db.members.createIndex({
  clubId: 1,
  status: 1,
  "gameStats.totalGames": -1,
  "gameStats.winRate": -1
});
```

## 📊 데이터 관계도

### 주요 관계
```
Club (1) ←→ (N) Member
Club (1) ←→ (N) Post
Club (1) ←→ (N) Game
Club (1) ←→ (N) ChatRoom
Club (1) ←→ (1) BandSync

Member (1) ←→ (N) Post (author)
Member (N) ←→ (N) Game (participants)
Member (N) ←→ (N) ChatRoom (participants)
Member (1) ←→ (N) Message (sender)

Game (1) ←→ (N) Message (game 채팅방)
Post (1) ←→ (N) Comment (embedded)
ChatRoom (1) ←→ (N) Message
```

## 🔧 데이터 검증 규칙

### Mongoose 스키마 검증
```javascript
// 이메일 검증
email: {
  type: String,
  validate: {
    validator: function(v) {
      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
    },
    message: '유효한 이메일 주소를 입력해주세요.'
  }
},

// 전화번호 검증
phone: {
  type: String,
  validate: {
    validator: function(v) {
      return /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/.test(v);
    },
    message: '유효한 전화번호를 입력해주세요.'
  }
},

// 게임 날짜 검증
gameDate: {
  type: Date,
  validate: {
    validator: function(v) {
      return v > new Date();
    },
    message: '게임 날짜는 현재 시간 이후여야 합니다.'
  }
}
```

## 🗃️ 데이터 보관 정책

### 데이터 보관 기간
```javascript
const dataRetentionPolicy = {
  // 채팅 메시지: 1년 후 자동 삭제
  messages: {
    retentionPeriod: 365, // 일
    autoDelete: true
  },
  
  // 게임 기록: 영구 보관
  games: {
    retentionPeriod: -1, // 영구
    autoDelete: false
  },
  
  // 게시글: 3년 후 아카이브
  posts: {
    retentionPeriod: 1095, // 3년
    autoDelete: false,
    archiveAfter: 1095
  },
  
  // 오류 로그: 90일 후 삭제
  errorLogs: {
    retentionPeriod: 90,
    autoDelete: true
  },
  
  // 사용자 활동 로그: 180일 후 삭제
  activityLogs: {
    retentionPeriod: 180,
    autoDelete: true
  }
};
```

### 데이터 아카이브 전략
```javascript
// 월별 데이터 아카이브
const archiveOldData = async () => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  
  // 오래된 메시지 아카이브
  await db.messages.updateMany(
    { createdAt: { $lt: cutoffDate } },
    { $set: { archived: true } }
  );
  
  // 아카이브된 데이터를 별도 컬렉션으로 이동
  const archivedMessages = await db.messages.find({ archived: true });
  await db.archived_messages.insertMany(archivedMessages);
  await db.messages.deleteMany({ archived: true });
};
```

이 스키마 설계를 통해 확장 가능하고 효율적인 데이터 구조를 제공하며, Naver Band 연동과 실시간 기능을 원활하게 지원할 수 있습니다.