# API Rate Limiting 및 오프라인 UX 개선

## 목차
1. [API Rate Limiting 전략](#api-rate-limiting-전략)
2. [Rate Limiting 구현](#rate-limiting-구현)
3. [Band API Rate Limiting 대응](#band-api-rate-limiting-대응)
4. [오프라인 UX 설계](#오프라인-ux-설계)
5. [데이터 동기화 전략](#데이터-동기화-전략)
6. [캐싱 최적화](#캐싱-최적화)
7. [Progressive Web App 기능](#progressive-web-app-기능)
8. [오프라인 상태 관리](#오프라인-상태-관리)

## API Rate Limiting 전략

### Rate Limiting 목적
- **API 남용 방지**: 악의적인 요청으로부터 서버 보호
- **공정한 리소스 사용**: 모든 사용자에게 균등한 서비스 제공
- **서버 안정성**: 과도한 요청으로 인한 서버 다운 방지
- **비용 최적화**: Band API 호출량 제한으로 비용 절약

### Rate Limiting 계층
```
┌─────────────────────────────────────┐
│         CDN/WAF Level              │  <- 기본 DDoS 보호
├─────────────────────────────────────┤
│         Load Balancer              │  <- 연결 수 제한
├─────────────────────────────────────┤
│         API Gateway                │  <- API 키별 제한
├─────────────────────────────────────┤
│         Application Level          │  <- 세부 비즈니스 로직
└─────────────────────────────────────┘
```

### Rate Limiting 정책

#### 사용자별 제한
```yaml
user_rate_limits:
  authentication:
    login_attempts: "5 per 15 minutes"
    token_refresh: "10 per hour"
  
  api_calls:
    general_api: "100 per minute"
    game_creation: "5 per hour"
    game_participation: "20 per hour"
    chat_messages: "30 per minute"
  
  band_api:
    member_sync: "1 per 5 minutes"
    post_fetch: "10 per hour"
    photo_fetch: "50 per hour"
```

#### IP별 제한
```yaml
ip_rate_limits:
  global: "1000 per minute"
  authentication: "20 per minute"
  registration: "5 per hour"
```

#### 엔드포인트별 제한
```yaml
endpoint_limits:
  "/api/auth/login": "10 per minute per IP"
  "/api/games": "30 per minute per user"
  "/api/games/:id/join": "5 per minute per user"
  "/api/chat/messages": "60 per minute per user"
  "/api/band/sync": "1 per 5 minutes per user"
```

## Rate Limiting 구현

### Express.js Rate Limiting 미들웨어

#### 기본 Rate Limiter 설정
```javascript
// src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { createLogger } from '../utils/logger';

const logger = createLogger('rate-limiter');
const redis = new Redis(process.env.REDIS_URL);

// Redis Store 설정
const store = new RedisStore({
  sendCommand: (...args) => redis.call(...args),
});

// 기본 Rate Limiter
export const generalLimiter = rateLimit({
  store,
  windowMs: 60 * 1000, // 1분
  max: 100, // 분당 100회
  message: {
    error: 'Too many requests',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 인증된 사용자는 userId, 그렇지 않으면 IP 사용
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Health check 요청은 제외
    return req.path === '/health' || req.path === '/metrics';
  },
  onLimitReached: (req, res, options) => {
    logger.warn('Rate limit exceeded', {
      key: options.keyGenerator(req),
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
  }
});

// 인증 관련 강화된 Rate Limiter
export const authLimiter = rateLimit({
  store,
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 15분당 5회
  message: {
    error: 'Too many authentication attempts',
    retryAfter: 900
  },
  keyGenerator: (req) => `auth:${req.ip}`,
  skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
  onLimitReached: (req, res, options) => {
    logger.error('Authentication rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
  }
});

// 게임 생성 Rate Limiter
export const gameCreationLimiter = rateLimit({
  store,
  windowMs: 60 * 60 * 1000, // 1시간
  max: 5, // 시간당 5개 게임
  message: {
    error: 'Too many games created',
    retryAfter: 3600
  },
  keyGenerator: (req) => `game_creation:${req.user?.id || req.ip}`,
  skip: (req) => !req.user, // 인증되지 않은 사용자는 게임 생성 불가
});

// Band API Rate Limiter
export const bandAPILimiter = rateLimit({
  store,
  windowMs: 5 * 60 * 1000, // 5분
  max: 1, // 5분당 1회
  message: {
    error: 'Band API sync too frequent',
    retryAfter: 300
  },
  keyGenerator: (req) => `band_sync:${req.user?.id}`,
});
```

#### 동적 Rate Limiting
```javascript
// src/middleware/dynamicRateLimiter.js
import { createLogger } from '../utils/logger';
import { securityMonitoring } from '../services/securityMonitoring';

const logger = createLogger('dynamic-rate-limiter');

export class DynamicRateLimiter {
  constructor() {
    this.userLimits = new Map();
    this.suspiciousUsers = new Set();
  }

  // 사용자별 동적 제한 설정
  setUserLimit(userId, endpoint, limit, windowMs) {
    const key = `${userId}:${endpoint}`;
    this.userLimits.set(key, {
      limit,
      windowMs,
      requests: [],
      createdAt: Date.now()
    });
  }

  // 의심스러운 사용자 마킹
  markSuspicious(userId) {
    this.suspiciousUsers.add(userId);
    
    // 의심스러운 사용자에게 더 엄격한 제한 적용
    this.setUserLimit(userId, 'general', 10, 60 * 1000); // 분당 10회로 제한
    
    logger.warn('User marked as suspicious', { userId });
  }

  // 제한 확인 미들웨어
  checkLimit(endpoint) {
    return async (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) {
        return next();
      }

      const key = `${userId}:${endpoint}`;
      const userLimit = this.userLimits.get(key);
      
      if (!userLimit) {
        return next();
      }

      const now = Date.now();
      const windowStart = now - userLimit.windowMs;
      
      // 윈도우 내 요청만 필터링
      userLimit.requests = userLimit.requests.filter(time => time > windowStart);
      
      if (userLimit.requests.length >= userLimit.limit) {
        // Rate limit 위반 보고
        await securityMonitoring.trackRateLimit(userId, endpoint, true);
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(userLimit.windowMs / 1000)
        });
      }

      // 요청 기록
      userLimit.requests.push(now);
      
      // Rate limit 통과 보고
      await securityMonitoring.trackRateLimit(userId, endpoint, false);
      
      next();
    };
  }

  // 정기 정리 작업
  cleanup() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [key, limit] of this.userLimits.entries()) {
      if (limit.createdAt < oneHourAgo) {
        this.userLimits.delete(key);
      }
    }
  }
}

export const dynamicRateLimiter = new DynamicRateLimiter();

// 1시간마다 정리
setInterval(() => {
  dynamicRateLimiter.cleanup();
}, 60 * 60 * 1000);
```

### API Gateway Rate Limiting (AWS)

#### API Gateway 설정
```yaml
# api-gateway-rate-limiting.yml
Resources:
  ApiGateway:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: DongBaeJul-API
      Description: DongBaeJul API Gateway with Rate Limiting
      
  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: DongBaeJul-Usage-Plan
      Description: Usage plan for DongBaeJul API
      Quota:
        Limit: 10000
        Period: DAY
      Throttle:
        BurstLimit: 20
        RateLimit: 10
      ApiStages:
        - ApiId: !Ref ApiGateway
          Stage: prod
          
  ApiKey:
    Type: AWS::ApiGateway::ApiKey
    Properties:
      Name: DongBaeJul-API-Key
      Description: API Key for DongBaeJul
      Enabled: true
      
  UsagePlanKey:
    Type: AWS::ApiGateway::UsagePlanKey
    Properties:
      KeyId: !Ref ApiKey
      KeyType: API_KEY
      UsagePlanId: !Ref UsagePlan
```

## Band API Rate Limiting 대응

### Band API 호출 최적화

#### 지능형 요청 스케줄러
```javascript
// src/services/bandAPIScheduler.js
import { createLogger } from '../utils/logger';
import { BandAPI } from './bandAPI';

const logger = createLogger('band-api-scheduler');

export class BandAPIScheduler {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minInterval = 5000; // 5초 최소 간격
    this.rateLimitResetTime = null;
  }

  // API 호출 요청 추가
  async scheduleRequest(apiCall, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const request = {
        apiCall,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0
      };

      // 우선순위에 따라 삽입
      if (priority === 'high') {
        this.queue.unshift(request);
      } else {
        this.queue.push(request);
      }

      this.processQueue();
    });
  }

  // 큐 처리
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      
      try {
        // Rate limit 체크
        await this.waitForRateLimit();
        
        // API 호출 실행
        const result = await request.apiCall();
        request.resolve(result);
        
        logger.info('Band API request completed', {
          priority: request.priority,
          duration: Date.now() - request.timestamp
        });
        
      } catch (error) {
        await this.handleAPIError(error, request);
      }
    }

    this.isProcessing = false;
  }

  // Rate limit 대기
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      logger.debug('Waiting for rate limit', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  // API 에러 처리
  async handleAPIError(error, request) {
    if (error.response?.status === 429) {
      // Rate limit 에러 처리
      const retryAfter = error.response.headers['retry-after'] || 60;
      this.rateLimitResetTime = Date.now() + (retryAfter * 1000);
      
      logger.warn('Band API rate limit hit', { retryAfter });
      
      // 재시도 큐에 추가
      if (request.retryCount < 3) {
        request.retryCount++;
        setTimeout(() => {
          this.queue.unshift(request);
          this.processQueue();
        }, retryAfter * 1000);
        return;
      }
    }
    
    logger.error('Band API request failed', {
      error: error.message,
      retryCount: request.retryCount
    });
    
    request.reject(error);
  }

  // 우선순위가 높은 요청 (실시간 필요)
  async scheduleHighPriority(apiCall) {
    return this.scheduleRequest(apiCall, 'high');
  }

  // 일반 요청 (배치 처리 가능)
  async scheduleNormal(apiCall) {
    return this.scheduleRequest(apiCall, 'normal');
  }

  // 저우선순위 요청 (백그라운드)
  async scheduleLowPriority(apiCall) {
    return this.scheduleRequest(apiCall, 'low');
  }
}

export const bandAPIScheduler = new BandAPIScheduler();
```

#### 배치 처리 최적화
```javascript
// src/services/bandAPIBatch.js
import { bandAPIScheduler } from './bandAPIScheduler';
import { createLogger } from '../utils/logger';

const logger = createLogger('band-api-batch');

export class BandAPIBatch {
  constructor() {
    this.memberSyncQueue = [];
    this.postSyncQueue = [];
    this.photoSyncQueue = [];
    
    // 배치 처리 간격
    this.batchInterval = 30 * 60 * 1000; // 30분
    
    this.startBatchProcessing();
  }

  // 멤버 동기화 요청 추가
  queueMemberSync(userId) {
    if (!this.memberSyncQueue.includes(userId)) {
      this.memberSyncQueue.push(userId);
      logger.debug('Added member sync to queue', { userId });
    }
  }

  // 게시물 동기화 요청 추가
  queuePostSync(userId, since) {
    const request = { userId, since };
    this.postSyncQueue.push(request);
    logger.debug('Added post sync to queue', { userId, since });
  }

  // 사진 동기화 요청 추가
  queuePhotoSync(userId, albumId) {
    const request = { userId, albumId };
    this.photoSyncQueue.push(request);
    logger.debug('Added photo sync to queue', { userId, albumId });
  }

  // 배치 처리 시작
  startBatchProcessing() {
    setInterval(() => {
      this.processBatches();
    }, this.batchInterval);
  }

  // 모든 배치 처리
  async processBatches() {
    logger.info('Starting batch processing', {
      memberSyncCount: this.memberSyncQueue.length,
      postSyncCount: this.postSyncQueue.length,
      photoSyncCount: this.photoSyncQueue.length
    });

    // 멤버 동기화 배치 처리
    await this.processMemberSyncBatch();
    
    // 게시물 동기화 배치 처리
    await this.processPostSyncBatch();
    
    // 사진 동기화 배치 처리
    await this.processPhotoSyncBatch();
    
    logger.info('Batch processing completed');
  }

  // 멤버 동기화 배치 처리
  async processMemberSyncBatch() {
    if (this.memberSyncQueue.length === 0) return;

    const batch = this.memberSyncQueue.splice(0, 10); // 최대 10명씩 처리
    
    for (const userId of batch) {
      try {
        await bandAPIScheduler.scheduleLowPriority(async () => {
          return await BandAPI.syncMembers(userId);
        });
        
        logger.debug('Member sync completed', { userId });
      } catch (error) {
        logger.error('Member sync failed', { userId, error: error.message });
      }
    }
  }

  // 게시물 동기화 배치 처리
  async processPostSyncBatch() {
    if (this.postSyncQueue.length === 0) return;

    const batch = this.postSyncQueue.splice(0, 5); // 최대 5개씩 처리
    
    for (const request of batch) {
      try {
        await bandAPIScheduler.scheduleLowPriority(async () => {
          return await BandAPI.syncPosts(request.userId, request.since);
        });
        
        logger.debug('Post sync completed', { userId: request.userId });
      } catch (error) {
        logger.error('Post sync failed', { 
          userId: request.userId, 
          error: error.message 
        });
      }
    }
  }

  // 사진 동기화 배치 처리
  async processPhotoSyncBatch() {
    if (this.photoSyncQueue.length === 0) return;

    const batch = this.photoSyncQueue.splice(0, 3); // 최대 3개씩 처리
    
    for (const request of batch) {
      try {
        await bandAPIScheduler.scheduleLowPriority(async () => {
          return await BandAPI.syncPhotos(request.userId, request.albumId);
        });
        
        logger.debug('Photo sync completed', { 
          userId: request.userId,
          albumId: request.albumId 
        });
      } catch (error) {
        logger.error('Photo sync failed', { 
          userId: request.userId,
          albumId: request.albumId,
          error: error.message 
        });
      }
    }
  }
}

export const bandAPIBatch = new BandAPIBatch();
```

## 오프라인 UX 설계

### 오프라인 상태 감지

#### React Native 네트워크 상태 모니터링
```javascript
// src/hooks/useNetworkStatus.js
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { performanceMonitoring } from '../services/performanceMonitoring';

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState({
    isConnected: true,
    connectionType: 'unknown',
    isInternetReachable: true,
    strength: null
  });

  useEffect(() => {
    // 초기 네트워크 상태 확인
    NetInfo.fetch().then(state => {
      setNetworkStatus({
        isConnected: state.isConnected,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
        strength: state.details?.strength || null
      });
    });

    // 네트워크 상태 변화 감지
    const unsubscribe = NetInfo.addEventListener(state => {
      const newStatus = {
        isConnected: state.isConnected,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
        strength: state.details?.strength || null
      };

      setNetworkStatus(prevStatus => {
        // 상태 변화가 있을 때만 업데이트
        if (
          prevStatus.isConnected !== newStatus.isConnected ||
          prevStatus.connectionType !== newStatus.connectionType
        ) {
          // 네트워크 상태 변화 추적
          performanceMonitoring.trackUserAction('network_status_change', {
            from: `${prevStatus.connectionType}_${prevStatus.isConnected}`,
            to: `${newStatus.connectionType}_${newStatus.isConnected}`
          });
          
          return newStatus;
        }
        
        return prevStatus;
      });
    });

    return () => unsubscribe();
  }, []);

  return networkStatus;
};
```

#### 오프라인 배너 컴포넌트
```javascript
// src/components/OfflineBanner.js
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { theme } from '../utils/theme';

export const OfflineBanner = () => {
  const networkStatus = useNetworkStatus();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (!networkStatus.isConnected) {
      // 오프라인 상태일 때 배너 표시
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // 온라인 상태일 때 배너 숨김
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [networkStatus.isConnected]);

  if (networkStatus.isConnected) {
    return null;
  }

  const getBannerMessage = () => {
    if (!networkStatus.isInternetReachable) {
      return '인터넷 연결을 확인해주세요';
    }
    
    return '오프라인 모드 - 일부 기능이 제한될 수 있습니다';
  };

  return (
    <Animated.View 
      style={[styles.banner, { opacity: fadeAnim }]}
      pointerEvents="none"
    >
      <Text style={styles.bannerText}>
        📡 {getBannerMessage()}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.warning,
    padding: 12,
    zIndex: 1000,
  },
  bannerText: {
    color: theme.colors.onWarning,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
```

### 오프라인 데이터 저장

#### AsyncStorage 기반 오프라인 스토리지
```javascript
// src/services/offlineStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('offline-storage');

export class OfflineStorageService {
  constructor() {
    this.keyPrefix = 'dongbaejul_offline_';
    this.maxStorageSize = 50 * 1024 * 1024; // 50MB 제한
  }

  // 데이터 저장
  async saveData(key, data, expirationMinutes = 60) {
    try {
      const fullKey = this.keyPrefix + key;
      const storageData = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (expirationMinutes * 60 * 1000)
      };

      await AsyncStorage.setItem(fullKey, JSON.stringify(storageData));
      logger.debug('Data saved to offline storage', { key, size: JSON.stringify(data).length });
      
      // 스토리지 크기 확인 및 정리
      await this.cleanupIfNeeded();
      
    } catch (error) {
      logger.error('Failed to save data to offline storage', { key, error: error.message });
    }
  }

  // 데이터 조회
  async getData(key) {
    try {
      const fullKey = this.keyPrefix + key;
      const stored = await AsyncStorage.getItem(fullKey);
      
      if (!stored) {
        return null;
      }

      const storageData = JSON.parse(stored);
      
      // 만료 시간 확인
      if (Date.now() > storageData.expiresAt) {
        await AsyncStorage.removeItem(fullKey);
        logger.debug('Expired data removed from offline storage', { key });
        return null;
      }

      logger.debug('Data retrieved from offline storage', { key });
      return storageData.data;
      
    } catch (error) {
      logger.error('Failed to retrieve data from offline storage', { key, error: error.message });
      return null;
    }
  }

  // 데이터 삭제
  async removeData(key) {
    try {
      const fullKey = this.keyPrefix + key;
      await AsyncStorage.removeItem(fullKey);
      logger.debug('Data removed from offline storage', { key });
    } catch (error) {
      logger.error('Failed to remove data from offline storage', { key, error: error.message });
    }
  }

  // 모든 오프라인 데이터 조회
  async getAllOfflineData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(key => key.startsWith(this.keyPrefix));
      
      if (offlineKeys.length === 0) {
        return {};
      }

      const keyValuePairs = await AsyncStorage.multiGet(offlineKeys);
      const result = {};

      for (const [fullKey, value] of keyValuePairs) {
        if (value) {
          const key = fullKey.replace(this.keyPrefix, '');
          const storageData = JSON.parse(value);
          
          // 만료되지 않은 데이터만 포함
          if (Date.now() <= storageData.expiresAt) {
            result[key] = storageData.data;
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to retrieve all offline data', { error: error.message });
      return {};
    }
  }

  // 스토리지 정리
  async cleanupIfNeeded() {
    try {
      // 전체 스토리지 크기 확인
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(key => key.startsWith(this.keyPrefix));
      
      if (offlineKeys.length === 0) return;

      const keyValuePairs = await AsyncStorage.multiGet(offlineKeys);
      let totalSize = 0;
      const dataItems = [];

      for (const [key, value] of keyValuePairs) {
        if (value) {
          const size = value.length;
          totalSize += size;
          
          const storageData = JSON.parse(value);
          dataItems.push({
            key,
            size,
            timestamp: storageData.timestamp,
            expiresAt: storageData.expiresAt
          });
        }
      }

      // 크기 제한 초과 시 정리
      if (totalSize > this.maxStorageSize) {
        // 오래된 데이터부터 삭제
        dataItems.sort((a, b) => a.timestamp - b.timestamp);
        
        let removedSize = 0;
        const keysToRemove = [];
        
        for (const item of dataItems) {
          keysToRemove.push(item.key);
          removedSize += item.size;
          
          if (totalSize - removedSize <= this.maxStorageSize * 0.8) {
            break;
          }
        }
        
        await AsyncStorage.multiRemove(keysToRemove);
        logger.info('Offline storage cleanup completed', { 
          removedItems: keysToRemove.length,
          removedSize 
        });
      }

      // 만료된 데이터 정리
      const now = Date.now();
      const expiredKeys = dataItems
        .filter(item => now > item.expiresAt)
        .map(item => item.key);
      
      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        logger.debug('Expired offline data removed', { count: expiredKeys.length });
      }
      
    } catch (error) {
      logger.error('Offline storage cleanup failed', { error: error.message });
    }
  }

  // 오프라인 액션 큐 저장
  async saveOfflineAction(action) {
    try {
      const existingActions = await this.getData('offline_actions') || [];
      const newAction = {
        ...action,
        id: Date.now().toString(),
        timestamp: Date.now()
      };
      
      existingActions.push(newAction);
      await this.saveData('offline_actions', existingActions, 24 * 60); // 24시간 보관
      
      logger.debug('Offline action saved', { actionType: action.type });
    } catch (error) {
      logger.error('Failed to save offline action', { error: error.message });
    }
  }

  // 오프라인 액션 조회 및 실행
  async processOfflineActions() {
    try {
      const actions = await this.getData('offline_actions') || [];
      
      if (actions.length === 0) {
        return;
      }

      logger.info('Processing offline actions', { count: actions.length });
      
      const completedActions = [];
      
      for (const action of actions) {
        try {
          await this.executeOfflineAction(action);
          completedActions.push(action.id);
        } catch (error) {
          logger.error('Failed to execute offline action', { 
            actionId: action.id,
            actionType: action.type,
            error: error.message 
          });
        }
      }

      // 완료된 액션 제거
      const remainingActions = actions.filter(action => 
        !completedActions.includes(action.id)
      );
      
      await this.saveData('offline_actions', remainingActions, 24 * 60);
      
      logger.info('Offline actions processed', { 
        completed: completedActions.length,
        remaining: remainingActions.length 
      });
      
    } catch (error) {
      logger.error('Failed to process offline actions', { error: error.message });
    }
  }

  // 오프라인 액션 실행
  async executeOfflineAction(action) {
    // 액션 타입별 실행 로직 구현
    switch (action.type) {
      case 'CREATE_GAME':
        await this.executeCreateGame(action.data);
        break;
      case 'JOIN_GAME':
        await this.executeJoinGame(action.data);
        break;
      case 'SEND_CHAT_MESSAGE':
        await this.executeSendChatMessage(action.data);
        break;
      default:
        throw new Error(`Unknown offline action type: ${action.type}`);
    }
  }

  async executeCreateGame(gameData) {
    // 게임 생성 API 호출
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(gameData)
    });

    if (!response.ok) {
      throw new Error('Failed to create game');
    }
  }

  async executeJoinGame(data) {
    // 게임 참가 API 호출
    const response = await fetch(`/api/games/${data.gameId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to join game');
    }
  }

  async executeSendChatMessage(data) {
    // 채팅 메시지 전송 API 호출
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }
  }

  async getAuthToken() {
    // 인증 토큰 조회 로직
    return await AsyncStorage.getItem('auth_token');
  }
}

export const offlineStorage = new OfflineStorageService();
```

## 데이터 동기화 전략

### 동기화 큐 관리

#### 스마트 동기화 서비스
```javascript
// src/services/syncService.js
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineStorage } from './offlineStorage';
import { createLogger } from '../utils/logger';

const logger = createLogger('sync-service');

export class SyncService {
  constructor() {
    this.syncQueue = [];
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.conflictResolutions = new Map();
  }

  // 동기화 아이템 추가
  addToSyncQueue(item) {
    const syncItem = {
      id: Date.now().toString(),
      type: item.type,
      data: item.data,
      timestamp: Date.now(),
      priority: item.priority || 'normal',
      retryCount: 0,
      maxRetries: 3
    };

    // 우선순위에 따라 정렬
    if (syncItem.priority === 'high') {
      this.syncQueue.unshift(syncItem);
    } else {
      this.syncQueue.push(syncItem);
    }

    logger.debug('Item added to sync queue', { 
      itemId: syncItem.id,
      type: syncItem.type,
      priority: syncItem.priority 
    });
  }

  // 동기화 시작
  async startSync(networkStatus) {
    if (this.isSyncing || !networkStatus.isConnected) {
      return;
    }

    this.isSyncing = true;
    logger.info('Starting data synchronization', { queueSize: this.syncQueue.length });

    try {
      // 오프라인 액션부터 처리
      await offlineStorage.processOfflineActions();

      // 동기화 큐 처리
      while (this.syncQueue.length > 0) {
        const item = this.syncQueue.shift();
        
        try {
          await this.processSyncItem(item);
          logger.debug('Sync item processed successfully', { itemId: item.id });
        } catch (error) {
          await this.handleSyncError(item, error);
        }
      }

      this.lastSyncTime = Date.now();
      logger.info('Data synchronization completed');

    } catch (error) {
      logger.error('Synchronization failed', { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  // 동기화 아이템 처리
  async processSyncItem(item) {
    switch (item.type) {
      case 'USER_PROFILE':
        await this.syncUserProfile(item.data);
        break;
      case 'GAME_DATA':
        await this.syncGameData(item.data);
        break;
      case 'CHAT_MESSAGES':
        await this.syncChatMessages(item.data);
        break;
      case 'BAND_DATA':
        await this.syncBandData(item.data);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  // 동기화 에러 처리
  async handleSyncError(item, error) {
    item.retryCount++;
    
    if (item.retryCount <= item.maxRetries) {
      // 재시도 큐에 추가 (지수 백오프)
      const retryDelay = Math.pow(2, item.retryCount) * 1000;
      
      setTimeout(() => {
        this.syncQueue.unshift(item);
      }, retryDelay);
      
      logger.warn('Sync item will be retried', { 
        itemId: item.id,
        retryCount: item.retryCount,
        retryDelay 
      });
    } else {
      logger.error('Sync item failed permanently', { 
        itemId: item.id,
        type: item.type,
        error: error.message 
      });
      
      // 실패한 아이템을 오프라인 스토리지에 저장
      await offlineStorage.saveData(`failed_sync_${item.id}`, item, 24 * 60);
    }
  }

  // 사용자 프로필 동기화
  async syncUserProfile(data) {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to sync user profile');
    }

    const updatedProfile = await response.json();
    await offlineStorage.saveData('user_profile', updatedProfile);
  }

  // 게임 데이터 동기화
  async syncGameData(data) {
    const response = await fetch(`/api/games/${data.gameId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to sync game data');
    }
  }

  // 채팅 메시지 동기화
  async syncChatMessages(data) {
    // 채팅 메시지는 Socket.io를 통해 실시간 동기화
    // 오프라인 중 누락된 메시지만 REST API로 조회
    const lastMessageTime = await offlineStorage.getData('last_chat_sync');
    
    const response = await fetch(`/api/chat/messages?since=${lastMessageTime}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to sync chat messages');
    }

    const messages = await response.json();
    
    // 로컬 메시지와 병합
    const localMessages = await offlineStorage.getData('chat_messages') || [];
    const mergedMessages = this.mergeChatMessages(localMessages, messages);
    
    await offlineStorage.saveData('chat_messages', mergedMessages);
    await offlineStorage.saveData('last_chat_sync', Date.now());
  }

  // Band 데이터 동기화
  async syncBandData(data) {
    // Band API를 통한 데이터 동기화
    const response = await fetch('/api/band/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to sync Band data');
    }

    const syncedData = await response.json();
    
    // 동기화된 데이터를 로컬에 저장
    await offlineStorage.saveData('band_members', syncedData.members);
    await offlineStorage.saveData('band_posts', syncedData.posts);
  }

  // 채팅 메시지 병합 (충돌 해결)
  mergeChatMessages(localMessages, remoteMessages) {
    const messageMap = new Map();
    
    // 로컬 메시지 추가
    localMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // 원격 메시지 추가 (덮어쓰기)
    remoteMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // 시간순 정렬
    return Array.from(messageMap.values()).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  async getAuthToken() {
    return await AsyncStorage.getItem('auth_token');
  }
}

export const syncService = new SyncService();
```

### 충돌 해결 전략

#### 데이터 충돌 해결 서비스
```javascript
// src/services/conflictResolution.js
import { createLogger } from '../utils/logger';

const logger = createLogger('conflict-resolution');

export class ConflictResolutionService {
  constructor() {
    this.strategies = {
      'last_write_wins': this.lastWriteWins,
      'manual_resolution': this.manualResolution,
      'merge_fields': this.mergeFields,
      'keep_both': this.keepBoth
    };
  }

  // 충돌 해결
  async resolveConflict(localData, remoteData, conflictType, strategy = 'last_write_wins') {
    logger.info('Resolving data conflict', { 
      conflictType,
      strategy,
      localTimestamp: localData.updatedAt,
      remoteTimestamp: remoteData.updatedAt
    });

    const resolutionFunction = this.strategies[strategy];
    if (!resolutionFunction) {
      throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }

    const resolvedData = await resolutionFunction.call(this, localData, remoteData, conflictType);
    
    logger.info('Conflict resolved', { 
      conflictType,
      strategy,
      resolution: resolvedData.resolution 
    });

    return resolvedData;
  }

  // Last Write Wins 전략
  async lastWriteWins(localData, remoteData, conflictType) {
    const localTime = new Date(localData.updatedAt).getTime();
    const remoteTime = new Date(remoteData.updatedAt).getTime();

    if (localTime > remoteTime) {
      return {
        data: localData,
        resolution: 'local_wins',
        reason: 'Local data is newer'
      };
    } else {
      return {
        data: remoteData,
        resolution: 'remote_wins',
        reason: 'Remote data is newer'
      };
    }
  }

  // 수동 해결 전략
  async manualResolution(localData, remoteData, conflictType) {
    // 사용자에게 충돌 해결 UI 표시
    return new Promise((resolve) => {
      // 실제 구현에서는 UI 컴포넌트를 표시하고 사용자 선택을 기다림
      this.showConflictResolutionUI(localData, remoteData, conflictType, resolve);
    });
  }

  // 필드별 병합 전략
  async mergeFields(localData, remoteData, conflictType) {
    const mergedData = { ...remoteData };
    
    // 특정 필드들은 로컬 데이터 우선
    const localPriorityFields = ['preferences', 'lastActiveTime', 'offlineChanges'];
    
    localPriorityFields.forEach(field => {
      if (localData[field] !== undefined) {
        mergedData[field] = localData[field];
      }
    });

    return {
      data: mergedData,
      resolution: 'merged',
      reason: 'Fields merged with local priority for specific fields'
    };
  }

  // 둘 다 보관 전략
  async keepBoth(localData, remoteData, conflictType) {
    // 버전 관리를 통해 둘 다 보관
    const timestamp = Date.now();
    
    return {
      data: {
        current: remoteData,
        versions: [
          {
            ...localData,
            version: `local_${timestamp}`,
            isLocal: true
          },
          {
            ...remoteData,
            version: `remote_${timestamp}`,
            isRemote: true
          }
        ]
      },
      resolution: 'both_kept',
      reason: 'Both versions preserved for manual review'
    };
  }

  // 충돌 해결 UI 표시 (실제 구현 필요)
  showConflictResolutionUI(localData, remoteData, conflictType, resolve) {
    // React Native Alert 또는 모달을 통한 사용자 선택
    // 실제 앱에서는 전용 ConflictResolutionScreen을 표시
    
    // 임시 구현: 자동으로 원격 데이터 선택
    setTimeout(() => {
      resolve({
        data: remoteData,
        resolution: 'user_chose_remote',
        reason: 'User selected remote data'
      });
    }, 1000);
  }

  // 게임 데이터 전용 충돌 해결
  async resolveGameConflict(localGame, remoteGame) {
    // 게임 상태에 따른 충돌 해결
    if (localGame.status === 'completed' && remoteGame.status !== 'completed') {
      return {
        data: localGame,
        resolution: 'local_wins',
        reason: 'Local game completion takes priority'
      };
    }

    if (remoteGame.status === 'cancelled') {
      return {
        data: remoteGame,
        resolution: 'remote_wins',
        reason: 'Game cancellation is authoritative'
      };
    }

    // 참가자 목록 병합
    const mergedParticipants = Array.from(new Set([
      ...localGame.participants,
      ...remoteGame.participants
    ]));

    const mergedGame = {
      ...remoteGame,
      participants: mergedParticipants,
      localChanges: localGame.localChanges || []
    };

    return {
      data: mergedGame,
      resolution: 'merged',
      reason: 'Participant lists merged'
    };
  }

  // 채팅 메시지 충돌 해결
  async resolveChatConflict(localMessages, remoteMessages) {
    // 메시지 ID 기반 병합
    const messageMap = new Map();
    
    // 원격 메시지 먼저 추가
    remoteMessages.forEach(msg => {
      messageMap.set(msg.id, { ...msg, source: 'remote' });
    });
    
    // 로컬 메시지 추가 (오프라인 중 작성된 메시지 우선)
    localMessages.forEach(msg => {
      if (msg.isOffline || !messageMap.has(msg.id)) {
        messageMap.set(msg.id, { ...msg, source: 'local' });
      }
    });

    const mergedMessages = Array.from(messageMap.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      data: mergedMessages,
      resolution: 'merged',
      reason: 'Messages merged with offline message priority'
    };
  }
}

export const conflictResolution = new ConflictResolutionService();
```

## 캐싱 최적화

### 다층 캐싱 전략

#### 메모리 + AsyncStorage 캐싱
```javascript
// src/services/cacheService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('cache-service');

export class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cachePrefix = 'dongbaejul_cache_';
    this.defaultTTL = 30 * 60 * 1000; // 30분
    this.maxMemoryCacheSize = 100; // 최대 100개 항목
  }

  // 데이터 캐시
  async set(key, data, ttl = this.defaultTTL) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    // 메모리 캐시에 저장
    this.memoryCache.set(key, cacheEntry);
    
    // 메모리 캐시 크기 제한
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      this.evictOldestMemoryCache();
    }

    // AsyncStorage에도 저장
    try {
      await AsyncStorage.setItem(
        this.cachePrefix + key,
        JSON.stringify(cacheEntry)
      );
    } catch (error) {
      logger.error('Failed to save to persistent cache', { key, error: error.message });
    }

    logger.debug('Data cached', { key, ttl });
  }

  // 데이터 조회
  async get(key) {
    // 메모리 캐시 우선 확인
    let cacheEntry = this.memoryCache.get(key);
    
    if (cacheEntry) {
      if (Date.now() < cacheEntry.expiresAt) {
        logger.debug('Data retrieved from memory cache', { key });
        return cacheEntry.data;
      } else {
        // 만료된 메모리 캐시 제거
        this.memoryCache.delete(key);
      }
    }

    // AsyncStorage 확인
    try {
      const stored = await AsyncStorage.getItem(this.cachePrefix + key);
      if (stored) {
        cacheEntry = JSON.parse(stored);
        
        if (Date.now() < cacheEntry.expiresAt) {
          // 메모리 캐시에 다시 로드
          this.memoryCache.set(key, cacheEntry);
          logger.debug('Data retrieved from persistent cache', { key });
          return cacheEntry.data;
        } else {
          // 만료된 persistent 캐시 제거
          await AsyncStorage.removeItem(this.cachePrefix + key);
        }
      }
    } catch (error) {
      logger.error('Failed to retrieve from persistent cache', { key, error: error.message });
    }

    logger.debug('Cache miss', { key });
    return null;
  }

  // 캐시 삭제
  async remove(key) {
    this.memoryCache.delete(key);
    
    try {
      await AsyncStorage.removeItem(this.cachePrefix + key);
      logger.debug('Cache entry removed', { key });
    } catch (error) {
      logger.error('Failed to remove from persistent cache', { key, error: error.message });
    }
  }

  // 패턴 기반 캐시 삭제
  async removeByPattern(pattern) {
    // 메모리 캐시에서 패턴 매칭 제거
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // AsyncStorage에서 패턴 매칭 제거
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith(this.cachePrefix) && key.includes(pattern)
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.debug('Cache entries removed by pattern', { pattern, count: cacheKeys.length });
      }
    } catch (error) {
      logger.error('Failed to remove cache by pattern', { pattern, error: error.message });
    }
  }

  // 전체 캐시 정리
  async clear() {
    this.memoryCache.clear();
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.cachePrefix));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.info('All cache cleared', { removedKeys: cacheKeys.length });
      }
    } catch (error) {
      logger.error('Failed to clear persistent cache', { error: error.message });
    }
  }

  // 메모리 캐시 크기 제한을 위한 LRU 제거
  evictOldestMemoryCache() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      logger.debug('Evicted oldest memory cache entry', { key: oldestKey });
    }
  }

  // 캐시 상태 정보
  getCacheStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      maxMemoryCacheSize: this.maxMemoryCacheSize,
      memoryUsagePercent: (this.memoryCache.size / this.maxMemoryCacheSize) * 100
    };
  }
}

export const cacheService = new CacheService();
```

## Progressive Web App 기능

### Service Worker 구현 (웹 플랫폼용)

#### 기본 Service Worker
```javascript
// public/sw.js (웹 빌드용)
const CACHE_NAME = 'dongbaejul-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 있으면 캐시에서 반환
        if (response) {
          return response;
        }

        // 네트워크 요청
        return fetch(event.request)
          .then((response) => {
            // 유효하지 않은 응답인지 확인
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 응답 복제
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // 오프라인 중 쌓인 작업 처리
  const offlineActions = await getOfflineActions();
  
  for (const action of offlineActions) {
    try {
      await processOfflineAction(action);
      await removeOfflineAction(action.id);
    } catch (error) {
      console.error('Background sync failed for action:', action.id, error);
    }
  }
}
```

이 API Rate Limiting 및 오프라인 UX 개선 전략을 통해 안정적이고 사용자 친화적인 애플리케이션을 구현할 수 있습니다.