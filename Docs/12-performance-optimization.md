# 성능 최적화 및 스케일링 계획

## ⚡ 성능 최적화 전략 개요

동배즐 앱은 200명 규모의 동호회에서 실시간 채팅, 게임 관리, Band 연동 등의 기능을 원활하게 제공하기 위해 다층적 성능 최적화 전략을 적용합니다.

### 성능 목표 지표
```javascript
const performanceTargets = {
  // 프론트엔드 성능
  app_launch_time: '< 3초',
  page_load_time: '< 2초',
  api_response_time: '< 500ms',
  
  // 백엔드 성능
  api_average_response: '< 200ms',
  database_query_time: '< 100ms',
  concurrent_users: '500+ 동시 사용자',
  
  // 실시간 기능
  chat_message_latency: '< 100ms',
  game_score_update: '< 50ms',
  notification_delivery: '< 200ms',
  
  // 메모리 및 리소스
  mobile_memory_usage: '< 150MB',
  mobile_cpu_usage: '< 30%',
  server_memory_usage: '< 4GB',
  server_cpu_usage: '< 70%',
  
  // 가용성
  uptime: '99.9%',
  error_rate: '< 0.1%'
};
```

## 📱 클라이언트 성능 최적화

### 1. React Native 앱 최적화
```javascript
// utils/performanceOptimizer.js
class PerformanceOptimizer {
  constructor() {
    this.memoryWarningListener = null;
    this.performanceMetrics = {};
  }

  // 앱 시작 성능 최적화
  optimizeAppLaunch() {
    // 1. 스플래시 스크린 최적화
    this.setupFastSplashScreen();
    
    // 2. 초기 번들 크기 최소화
    this.optimizeInitialBundle();
    
    // 3. 필수 데이터만 프리로드
    this.preloadEssentialData();
    
    // 4. 메모리 경고 모니터링
    this.setupMemoryMonitoring();
  }

  setupFastSplashScreen() {
    // 네이티브 스플래시 스크린 사용
    // 자바스크립트 로딩 완료까지 표시
    import('react-native-splash-screen').then(SplashScreen => {
      // 앱 로딩 완료 후 숨김
      setTimeout(() => {
        SplashScreen.hide();
      }, 1000);
    });
  }

  optimizeInitialBundle() {
    // 코드 스플리팅으로 초기 번들 크기 최소화
    const essentialModules = [
      'react-native-paper',
      '@react-navigation/native',
      'react-native-reanimated'
    ];

    // 나머지 모듈들은 lazy loading
    const lazyModules = [
      'react-native-image-viewing',
      'react-native-video',
      'react-native-camera'
    ];

    return {
      essential: essentialModules,
      lazy: lazyModules
    };
  }

  async preloadEssentialData() {
    try {
      // 병렬로 필수 데이터 로드
      const [userProfile, clubInfo, cachedData] = await Promise.all([
        this.loadUserProfile(),
        this.loadClubInfo(),
        this.loadCachedData()
      ]);

      return { userProfile, clubInfo, cachedData };
    } catch (error) {
      // 에러 발생 시 캐시된 데이터 사용
      return await this.loadCachedData();
    }
  }

  setupMemoryMonitoring() {
    const DeviceInfo = require('react-native-device-info');
    
    // 메모리 사용량 주기적 모니터링
    setInterval(async () => {
      try {
        const usedMemory = await DeviceInfo.getUsedMemory();
        const totalMemory = await DeviceInfo.getTotalMemory();
        const usagePercentage = (usedMemory / totalMemory) * 100;

        if (usagePercentage > 80) {
          this.handleHighMemoryUsage();
        }

        this.performanceMetrics.memoryUsage = usagePercentage;
      } catch (error) {
        console.warn('메모리 모니터링 실패:', error);
      }
    }, 30000); // 30초마다 확인
  }

  handleHighMemoryUsage() {
    // 메모리 사용량이 높을 때 최적화 조치
    
    // 1. 이미지 캐시 정리
    this.clearImageCache();
    
    // 2. 사용하지 않는 스크린 언마운트
    this.unmountInactiveScreens();
    
    // 3. 메모리 집약적 컴포넌트 최적화
    this.optimizeHeavyComponents();
    
    // 4. 가비지 컬렉션 강제 실행 (가능한 경우)
    if (global.gc) {
      global.gc();
    }
  }

  clearImageCache() {
    // FastImage 캐시 정리
    import('react-native-fast-image').then(FastImage => {
      FastImage.clearMemoryCache();
      FastImage.clearDiskCache();
    });
  }
}

export default new PerformanceOptimizer();
```

### 2. 이미지 최적화
```javascript
// components/OptimizedImage.js
import React, { useState, useCallback } from 'react';
import FastImage from 'react-native-fast-image';
import { Dimensions } from 'react-native';

const OptimizedImage = ({ 
  source, 
  style, 
  resizeMode = 'cover',
  lazy = true,
  ...props 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const screenWidth = Dimensions.get('window').width;

  // 이미지 크기 최적화
  const getOptimizedSource = useCallback((originalSource) => {
    if (typeof originalSource === 'string') {
      // URL에 크기 파라미터 추가 (Band API 지원)
      const url = new URL(originalSource);
      
      // 화면 밀도에 따른 적절한 크기 계산
      const pixelRatio = Dimensions.get('window').scale;
      const targetWidth = Math.min(screenWidth * pixelRatio, 1024);
      
      url.searchParams.set('w', targetWidth.toString());
      url.searchParams.set('q', '85'); // 품질 85%
      
      return { uri: url.toString() };
    }
    
    return originalSource;
  }, [screenWidth]);

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  if (error) {
    return (
      <View style={[style, styles.errorContainer]}>
        <Icon name="image-broken" size={24} color="#999" />
      </View>
    );
  }

  return (
    <>
      <FastImage
        source={getOptimizedSource(source)}
        style={style}
        resizeMode={FastImage.resizeMode[resizeMode]}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      
      {loading && (
        <View style={[style, styles.loadingContainer]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
    </>
  );
};

// 이미지 프리로딩 유틸리티
export const preloadImages = async (imageUrls) => {
  const preloadPromises = imageUrls.map(url => 
    FastImage.preload([{ uri: url }])
  );
  
  await Promise.all(preloadPromises);
};

export default OptimizedImage;
```

### 3. 리스트 성능 최적화
```javascript
// components/OptimizedFlatList.js
import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, VirtualizedList } from 'react-native';

const OptimizedFlatList = memo(({ 
  data, 
  renderItem, 
  keyExtractor,
  estimatedItemSize = 80,
  windowSize = 10,
  maxToRenderPerBatch = 5,
  updateCellsBatchingPeriod = 100,
  removeClippedSubviews = true,
  ...props 
}) => {
  // 아이템 렌더링 최적화
  const optimizedRenderItem = useCallback(({ item, index }) => {
    return (
      <MemoizedListItem 
        item={item} 
        index={index} 
        renderItem={renderItem}
      />
    );
  }, [renderItem]);

  // 키 추출 최적화
  const optimizedKeyExtractor = useCallback((item, index) => {
    if (keyExtractor) {
      return keyExtractor(item, index);
    }
    return item.id || item._id || index.toString();
  }, [keyExtractor]);

  // getItemLayout 최적화 (고정 높이인 경우)
  const getItemLayout = useMemo(() => {
    if (estimatedItemSize) {
      return (data, index) => ({
        length: estimatedItemSize,
        offset: estimatedItemSize * index,
        index,
      });
    }
    return undefined;
  }, [estimatedItemSize]);

  return (
    <FlatList
      data={data}
      renderItem={optimizedRenderItem}
      keyExtractor={optimizedKeyExtractor}
      getItemLayout={getItemLayout}
      
      // 성능 최적화 props
      windowSize={windowSize}
      maxToRenderPerBatch={maxToRenderPerBatch}
      updateCellsBatchingPeriod={updateCellsBatchingPeriod}
      removeClippedSubviews={removeClippedSubviews}
      
      // 메모리 최적화
      initialNumToRender={10}
      onEndReachedThreshold={0.1}
      
      {...props}
    />
  );
});

// 메모화된 리스트 아이템
const MemoizedListItem = memo(({ item, index, renderItem }) => {
  return renderItem({ item, index });
}, (prevProps, nextProps) => {
  // 얕은 비교로 리렌더링 최적화
  return (
    prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index
  );
});

export default OptimizedFlatList;
```

### 4. 상태 관리 최적화
```javascript
// hooks/useOptimizedState.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce, throttle } from 'lodash';

// 디바운스된 상태 업데이트
export const useDebouncedState = (initialValue, delay = 300) => {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  const debouncedSetValue = useCallback(
    debounce((newValue) => {
      setDebouncedValue(newValue);
    }, delay),
    [delay]
  );

  useEffect(() => {
    debouncedSetValue(value);
  }, [value, debouncedSetValue]);

  return [debouncedValue, setValue];
};

// 쓰로틀된 상태 업데이트
export const useThrottledState = (initialValue, limit = 100) => {
  const [value, setValue] = useState(initialValue);
  const throttledSetValue = useCallback(
    throttle(setValue, limit),
    [limit]
  );

  return [value, throttledSetValue];
};

// 메모리 효율적인 배열 상태 관리
export const useOptimizedArray = (initialArray = []) => {
  const [array, setArray] = useState(initialArray);
  const arrayRef = useRef(array);

  useEffect(() => {
    arrayRef.current = array;
  }, [array]);

  const addItem = useCallback((item) => {
    setArray(prev => [...prev, item]);
  }, []);

  const removeItem = useCallback((predicate) => {
    setArray(prev => prev.filter(predicate));
  }, []);

  const updateItem = useCallback((index, newItem) => {
    setArray(prev => {
      const newArray = [...prev];
      newArray[index] = newItem;
      return newArray;
    });
  }, []);

  const clearArray = useCallback(() => {
    setArray([]);
  }, []);

  return {
    array,
    addItem,
    removeItem,
    updateItem,
    clearArray,
    size: array.length
  };
};

// 캐시된 계산 훅
export const useMemoizedCalculation = (calculation, dependencies) => {
  return useMemo(() => {
    const startTime = performance.now();
    const result = calculation();
    const endTime = performance.now();
    
    if (endTime - startTime > 16) { // 16ms 이상이면 경고
      console.warn(`Slow calculation detected: ${endTime - startTime}ms`);
    }
    
    return result;
  }, dependencies);
};
```

## 🖥️ 백엔드 성능 최적화

### 1. 데이터베이스 쿼리 최적화
```javascript
// services/optimizedQueries.js
class OptimizedQueries {
  constructor() {
    this.cache = new Map();
    this.queryMetrics = new Map();
  }

  // 게시글 목록 최적화 쿼리
  async getPostsOptimized(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      search = null,
      userId = null
    } = options;

    const cacheKey = `posts:${page}:${limit}:${category}:${search}`;
    
    // 캐시 확인
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    try {
      // 집계 파이프라인 사용으로 최적화
      const pipeline = [
        // 1. 필터링
        {
          $match: {
            status: 'published',
            ...(category && { category }),
            ...(search && {
              $or: [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
              ]
            })
          }
        },
        
        // 2. 작성자 정보 조인 (필요한 필드만)
        {
          $lookup: {
            from: 'users',
            localField: 'author_id',
            foreignField: '_id',
            as: 'author',
            pipeline: [
              {
                $project: {
                  display_name: 1,
                  band_data: { profile_image: 1 },
                  role: 1
                }
              }
            ]
          }
        },
        
        // 3. 댓글 수 계산
        {
          $addFields: {
            comment_count: { $size: '$comments' },
            like_count: { $size: '$likes' },
            is_read: {
              $in: [userId ? ObjectId(userId) : null, '$read_by']
            }
          }
        },
        
        // 4. 정렬 (고정글 우선, 그 다음 생성일)
        {
          $sort: { is_pinned: -1, created_at: -1 }
        },
        
        // 5. 페이지네이션
        { $skip: (page - 1) * limit },
        { $limit: limit },
        
        // 6. 불필요한 필드 제거
        {
          $project: {
            comments: 0,
            likes: 0,
            read_by: 0,
            'author.band_data.access_token': 0
          }
        }
      ];

      const [posts, totalCount] = await Promise.all([
        PostModel.aggregate(pipeline).exec(),
        this.getPostsCount({ category, search })
      ]);

      const result = {
        posts,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          has_more: page * limit < totalCount
        }
      };

      // 결과 캐싱 (5분)
      await this.setCache(cacheKey, result, 300);

      // 성능 메트릭 기록
      const duration = performance.now() - startTime;
      this.recordQueryMetrics('getPosts', duration);

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordQueryMetrics('getPosts', duration, error);
      throw error;
    }
  }

  // 게임 목록 최적화 쿼리
  async getGamesOptimized(options = {}) {
    const {
      status = null,
      date_from = null,
      date_to = null,
      skill_level = null,
      page = 1,
      limit = 20
    } = options;

    const cacheKey = `games:${status}:${date_from}:${date_to}:${skill_level}:${page}:${limit}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    try {
      const matchConditions = {};
      
      if (status) matchConditions.status = status;
      if (skill_level) matchConditions.skill_level = skill_level;
      
      if (date_from || date_to) {
        matchConditions.game_date = {};
        if (date_from) matchConditions.game_date.$gte = new Date(date_from);
        if (date_to) matchConditions.game_date.$lte = new Date(date_to);
      }

      const pipeline = [
        { $match: matchConditions },
        
        // 참가자 정보 최적화 조인
        {
          $lookup: {
            from: 'users',
            localField: 'participants.user_id',
            foreignField: '_id',
            as: 'participant_details',
            pipeline: [
              {
                $project: {
                  display_name: 1,
                  band_data: { profile_image: 1 },
                  profile: { badminton: { skill_level: 1 } }
                }
              }
            ]
          }
        },
        
        // 통계 계산
        {
          $addFields: {
            participant_count: { $size: '$participants' },
            waiting_count: { $size: '$waiting_list' },
            is_full: {
              $gte: [{ $size: '$participants' }, '$max_participants']
            }
          }
        },
        
        { $sort: { game_date: 1, created_at: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ];

      const games = await GameModel.aggregate(pipeline).exec();
      
      const result = {
        games,
        pagination: {
          current_page: page,
          has_more: games.length === limit
        }
      };

      // 결과 캐싱 (2분)
      await this.setCache(cacheKey, result, 120);

      const duration = performance.now() - startTime;
      this.recordQueryMetrics('getGames', duration);

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordQueryMetrics('getGames', duration, error);
      throw error;
    }
  }

  // 캐시 관리
  async getFromCache(key) {
    try {
      const redis = require('../cache/redis.manager');
      const cached = await redis.get(`query:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async setCache(key, data, ttl) {
    try {
      const redis = require('../cache/redis.manager');
      await redis.setEx(`query:${key}`, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('캐시 저장 실패:', error);
    }
  }

  // 성능 메트릭 기록
  recordQueryMetrics(queryName, duration, error = null) {
    if (!this.queryMetrics.has(queryName)) {
      this.queryMetrics.set(queryName, {
        total_calls: 0,
        total_duration: 0,
        avg_duration: 0,
        error_count: 0,
        slow_queries: 0
      });
    }

    const metrics = this.queryMetrics.get(queryName);
    metrics.total_calls++;
    metrics.total_duration += duration;
    metrics.avg_duration = metrics.total_duration / metrics.total_calls;

    if (error) {
      metrics.error_count++;
    }

    if (duration > 1000) { // 1초 이상이면 느린 쿼리
      metrics.slow_queries++;
      logger.warn(`Slow query detected: ${queryName} - ${duration}ms`);
    }

    this.queryMetrics.set(queryName, metrics);
  }

  // 메트릭 조회
  getQueryMetrics() {
    return Object.fromEntries(this.queryMetrics);
  }
}

module.exports = new OptimizedQueries();
```

### 2. 캐싱 전략
```javascript
// cache/cacheManager.js
class CacheManager {
  constructor() {
    this.redis = require('./redis.manager');
    this.localCache = new Map();
    this.cacheHitRatio = {
      redis: { hits: 0, misses: 0 },
      local: { hits: 0, misses: 0 }
    };
  }

  // 다층 캐싱 전략
  async get(key, options = {}) {
    const {
      useLocal = true,
      ttl = 3600,
      refreshFunction = null
    } = options;

    try {
      // 1. 로컬 캐시 확인
      if (useLocal && this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (Date.now() < cached.expires) {
          this.cacheHitRatio.local.hits++;
          return cached.data;
        } else {
          this.localCache.delete(key);
        }
      }
      this.cacheHitRatio.local.misses++;

      // 2. Redis 캐시 확인
      const redisData = await this.redis.get(key);
      if (redisData) {
        const data = JSON.parse(redisData);
        
        // 로컬 캐시에도 저장 (TTL의 10%만큼)
        if (useLocal) {
          this.localCache.set(key, {
            data,
            expires: Date.now() + (ttl * 100) // 10% of TTL
          });
        }
        
        this.cacheHitRatio.redis.hits++;
        return data;
      }
      this.cacheHitRatio.redis.misses++;

      // 3. 캐시 미스 시 데이터 새로 로드
      if (refreshFunction) {
        const freshData = await refreshFunction();
        await this.set(key, freshData, ttl);
        return freshData;
      }

      return null;

    } catch (error) {
      logger.error('캐시 조회 실패:', error);
      return null;
    }
  }

  async set(key, data, ttl = 3600) {
    try {
      // Redis에 저장
      await this.redis.setEx(key, ttl, JSON.stringify(data));
      
      // 로컬 캐시에도 저장 (TTL의 10%)
      this.localCache.set(key, {
        data,
        expires: Date.now() + (ttl * 100)
      });

      return true;
    } catch (error) {
      logger.error('캐시 저장 실패:', error);
      return false;
    }
  }

  // 패턴 기반 캐시 무효화
  async invalidatePattern(pattern) {
    try {
      // Redis 패턴 삭제
      const keys = await this.redis.client.keys(pattern);
      if (keys.length > 0) {
        await this.redis.client.del(keys);
      }

      // 로컬 캐시에서 패턴 매칭 키 삭제
      for (const [key] of this.localCache) {
        if (key.match(pattern.replace('*', '.*'))) {
          this.localCache.delete(key);
        }
      }

      return true;
    } catch (error) {
      logger.error('캐시 무효화 실패:', error);
      return false;
    }
  }

  // 스마트 캐시 예열
  async warmupCache() {
    const warmupTasks = [
      // 인기 게시글 캐싱
      this.warmupPopularPosts(),
      
      // 활성 게임 캐싱
      this.warmupActiveGames(),
      
      // 멤버 프로필 캐싱
      this.warmupMemberProfiles(),
      
      // Band 데이터 캐싱
      this.warmupBandData()
    ];

    try {
      await Promise.all(warmupTasks);
      logger.info('캐시 예열 완료');
    } catch (error) {
      logger.error('캐시 예열 실패:', error);
    }
  }

  async warmupPopularPosts() {
    const popularPosts = await PostModel.find({ is_pinned: true })
      .limit(10)
      .lean();
    
    for (const post of popularPosts) {
      await this.set(`post:${post._id}`, post, 3600);
    }
  }

  async warmupActiveGames() {
    const activeGames = await GameModel.find({ 
      status: { $in: ['scheduled', 'ongoing'] }
    }).limit(20).lean();
    
    for (const game of activeGames) {
      await this.set(`game:${game._id}`, game, 1800);
    }
  }

  // 캐시 통계 조회
  getCacheStats() {
    const localHitRate = this.cacheHitRatio.local.hits / 
      (this.cacheHitRatio.local.hits + this.cacheHitRatio.local.misses) * 100;
    
    const redisHitRate = this.cacheHitRatio.redis.hits / 
      (this.cacheHitRatio.redis.hits + this.cacheHitRatio.redis.misses) * 100;

    return {
      local_cache: {
        size: this.localCache.size,
        hit_rate: localHitRate.toFixed(2) + '%',
        hits: this.cacheHitRatio.local.hits,
        misses: this.cacheHitRatio.local.misses
      },
      redis_cache: {
        hit_rate: redisHitRate.toFixed(2) + '%',
        hits: this.cacheHitRatio.redis.hits,
        misses: this.cacheHitRatio.redis.misses
      }
    };
  }

  // 메모리 사용량 모니터링
  monitorMemoryUsage() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const localCacheSize = this.localCache.size;

      if (memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB 초과
        logger.warn('높은 메모리 사용량 감지', {
          heapUsed: memoryUsage.heapUsed,
          localCacheSize
        });

        // 로컬 캐시 일부 정리
        this.cleanupLocalCache();
      }
    }, 60000); // 1분마다 확인
  }

  cleanupLocalCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.localCache) {
      if (now >= value.expires) {
        this.localCache.delete(key);
        cleaned++;
      }
    }

    logger.info(`로컬 캐시 정리 완료: ${cleaned}개 항목 제거`);
  }
}

module.exports = new CacheManager();
```

### 3. API 응답 최적화
```javascript
// middleware/responseOptimizer.js
const compression = require('compression');
const responseTime = require('response-time');

class ResponseOptimizer {
  // 응답 압축 미들웨어
  static compression = compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // 압축 레벨 (1-9, 6이 기본값)
    threshold: 1024, // 1KB 이상만 압축
    memLevel: 8
  });

  // 응답 시간 측정
  static responseTime = responseTime((req, res, time) => {
    // 느린 응답 로깅
    if (time > 1000) {
      logger.warn('Slow response detected', {
        method: req.method,
        url: req.originalUrl,
        responseTime: time,
        userAgent: req.get('User-Agent')
      });
    }

    // 메트릭 수집
    global.responseTimeMetrics = global.responseTimeMetrics || [];
    global.responseTimeMetrics.push({
      endpoint: req.route?.path || req.originalUrl,
      method: req.method,
      time: time,
      timestamp: Date.now()
    });

    // 메트릭 배열 크기 제한 (최근 1000개만 유지)
    if (global.responseTimeMetrics.length > 1000) {
      global.responseTimeMetrics = global.responseTimeMetrics.slice(-1000);
    }
  });

  // 조건부 응답 (ETag, Last-Modified)
  static conditionalResponse = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // GET 요청에만 적용
      if (req.method === 'GET' && data) {
        const etag = require('crypto')
          .createHash('md5')
          .update(JSON.stringify(data))
          .digest('hex');
        
        res.set('ETag', etag);
        res.set('Cache-Control', 'private, max-age=300'); // 5분 캐싱
        
        // 클라이언트 ETag와 비교
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };

  // 페이지네이션 최적화
  static optimizePagination = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // 최대 100개로 제한
    
    req.pagination = {
      page: Math.max(1, page),
      limit: limit,
      skip: (Math.max(1, page) - 1) * limit
    };
    
    next();
  };

  // 응답 데이터 필터링
  static filterResponseFields = (fields) => {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(data) {
        if (req.query.fields && data) {
          const requestedFields = req.query.fields.split(',');
          data = this.filterFields(data, requestedFields);
        }
        
        return originalJson.call(this, data);
      };
      
      res.filterFields = (data, fields) => {
        if (Array.isArray(data)) {
          return data.map(item => this.filterFields(item, fields));
        }
        
        if (typeof data === 'object' && data !== null) {
          const filtered = {};
          fields.forEach(field => {
            if (data.hasOwnProperty(field)) {
              filtered[field] = data[field];
            }
          });
          return filtered;
        }
        
        return data;
      };
      
      next();
    };
  };

  // JSON 스트리밍 (대용량 데이터)
  static streamLargeResponse = (threshold = 1024 * 1024) => { // 1MB
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(data) {
        const dataSize = JSON.stringify(data).length;
        
        if (dataSize > threshold) {
          // 스트리밍 응답
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
          });
          
          if (Array.isArray(data)) {
            res.write('[');
            data.forEach((item, index) => {
              if (index > 0) res.write(',');
              res.write(JSON.stringify(item));
            });
            res.write(']');
          } else {
            res.write(JSON.stringify(data));
          }
          
          res.end();
        } else {
          return originalJson.call(this, data);
        }
      };
      
      next();
    };
  };
}

module.exports = ResponseOptimizer;
```

## ⚡ 실시간 성능 최적화

### 1. Socket.io 최적화
```javascript
// socket/optimizedSocket.js
class OptimizedSocket {
  constructor(server) {
    this.io = require('socket.io')(server, {
      // 연결 최적화
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB
      
      // 압축 설정
      compression: true,
      
      // CORS 최적화
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(','),
        methods: ["GET", "POST"],
        credentials: true
      },
      
      // 어댑터 설정 (Redis)
      adapter: require('socket.io-redis')({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }),
      
      // 트랜스포트 최적화
      transports: ['websocket', 'polling'],
      allowEIO3: true
    });

    this.connectedUsers = new Map();
    this.roomMetrics = new Map();
    this.messageQueue = new Map();
    
    this.setupOptimizations();
    this.setupEventHandlers();
  }

  setupOptimizations() {
    // 메시지 배치 처리
    this.setupMessageBatching();
    
    // 연결 풀링
    this.setupConnectionPooling();
    
    // 메모리 사용량 모니터링
    this.monitorMemoryUsage();
  }

  setupMessageBatching() {
    // 메시지를 배치로 처리하여 성능 향상
    setInterval(() => {
      this.processMessageBatches();
    }, 100); // 100ms마다 배치 처리
  }

  processMessageBatches() {
    for (const [roomId, messages] of this.messageQueue) {
      if (messages.length > 0) {
        // 배치로 메시지 전송
        this.io.to(roomId).emit('message:batch', {
          messages: messages.splice(0, 10), // 최대 10개씩 처리
          timestamp: Date.now()
        });
      }
    }
  }

  // 채팅 메시지 최적화 처리
  handleChatMessage(socket, messageData) {
    const roomId = messageData.roomId;
    
    // 메시지 검증
    if (!this.validateMessage(messageData)) {
      socket.emit('message:error', { error: 'Invalid message format' });
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(socket.userId, 'message')) {
      socket.emit('message:rate_limited', { 
        error: 'Too many messages',
        retryAfter: 1000 
      });
      return;
    }

    // 메시지 큐에 추가
    if (!this.messageQueue.has(roomId)) {
      this.messageQueue.set(roomId, []);
    }
    
    this.messageQueue.get(roomId).push({
      ...messageData,
      senderId: socket.userId,
      timestamp: Date.now()
    });

    // 즉시 전송자에게 확인 응답
    socket.emit('message:sent', { 
      tempId: messageData.tempId,
      timestamp: Date.now()
    });
  }

  // 게임 점수 업데이트 최적화
  handleGameScoreUpdate(socket, scoreData) {
    const gameId = scoreData.gameId;
    
    // 쓰로틀링 적용 (100ms 간격)
    const throttleKey = `game_score:${gameId}`;
    if (this.isThrottled(throttleKey, 100)) {
      return;
    }

    // 게임 방 참가자들에게만 전송
    socket.to(`game:${gameId}`).emit('game:score_updated', {
      gameId: gameId,
      score: scoreData.score,
      updatedBy: socket.userId,
      timestamp: Date.now()
    });

    // 쓰로틀 기록
    this.setThrottle(throttleKey);
  }

  // Rate limiting 체크
  checkRateLimit(userId, action) {
    const key = `rate_limit:${userId}:${action}`;
    const limits = {
      message: { max: 30, window: 60000 }, // 1분에 30개 메시지
      game_action: { max: 10, window: 10000 }, // 10초에 10개 게임 액션
      typing: { max: 60, window: 60000 } // 1분에 60개 타이핑 이벤트
    };

    const limit = limits[action];
    if (!limit) return true;

    const now = Date.now();
    const windowStart = now - limit.window;
    
    let userActions = global.rateLimitData?.[key] || [];
    userActions = userActions.filter(timestamp => timestamp > windowStart);
    
    if (userActions.length >= limit.max) {
      return false;
    }

    userActions.push(now);
    global.rateLimitData = global.rateLimitData || {};
    global.rateLimitData[key] = userActions;

    return true;
  }

  // 쓰로틀링 체크
  isThrottled(key, interval) {
    const now = Date.now();
    const lastTime = global.throttleData?.[key] || 0;
    
    return (now - lastTime) < interval;
  }

  setThrottle(key) {
    global.throttleData = global.throttleData || {};
    global.throttleData[key] = Date.now();
  }

  // 메모리 사용량 모니터링
  monitorMemoryUsage() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const connectionCount = this.connectedUsers.size;
      
      logger.info('Socket 서버 메모리 사용량', {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        connectionCount: connectionCount
      });

      // 메모리 사용량이 높으면 최적화 조치
      if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB 초과
        this.optimizeMemoryUsage();
      }
    }, 60000); // 1분마다 확인
  }

  optimizeMemoryUsage() {
    // 비활성 연결 정리
    this.cleanupInactiveConnections();
    
    // 메시지 큐 정리
    this.cleanupMessageQueues();
    
    // Rate limit 데이터 정리
    this.cleanupRateLimitData();
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30분

    for (const [userId, connectionData] of this.connectedUsers) {
      if (now - connectionData.lastActivity > inactiveThreshold) {
        this.connectedUsers.delete(userId);
      }
    }
  }
}

module.exports = OptimizedSocket;
```

## 📈 스케일링 전략

### 1. 수평 확장 계획
```yaml
# infrastructure/scaling-plan.yml
scaling_strategy:
  current_capacity:
    users: 200
    concurrent_connections: 100
    api_requests_per_minute: 1000
    
  scaling_targets:
    phase_1: # 500명 동호회
      users: 500
      concurrent_connections: 250
      api_requests_per_minute: 2500
      timeline: "3개월"
      
    phase_2: # 1000명 동호회
      users: 1000
      concurrent_connections: 500
      api_requests_per_minute: 5000
      timeline: "6개월"
      
    phase_3: # 다중 동호회 지원
      users: 5000
      concurrent_connections: 2000
      api_requests_per_minute: 20000
      timeline: "12개월"

infrastructure_scaling:
  phase_1:
    api_servers: 2 # ECS 서비스 2개 인스턴스
    database: "MongoDB Atlas M20 (replica set)"
    cache: "Redis ElastiCache 2 nodes"
    load_balancer: "AWS ALB"
    
  phase_2:
    api_servers: 4 # ECS 서비스 4개 인스턴스
    database: "MongoDB Atlas M30 (sharded cluster)"
    cache: "Redis ElastiCache 4 nodes"
    cdn: "CloudFront"
    
  phase_3:
    api_servers: "Auto-scaling (2-10 instances)"
    database: "MongoDB Atlas M50+ (multi-region)"
    cache: "Redis Cluster (6+ nodes)"
    message_queue: "AWS SQS/SNS"
    search: "Elasticsearch"

monitoring_scaling:
  metrics:
    - cpu_utilization: "> 70%"
    - memory_utilization: "> 80%"
    - response_time: "> 500ms"
    - error_rate: "> 1%"
    - connection_count: "> threshold"
    
  auto_scaling_triggers:
    scale_out:
      - "CPU > 70% for 5 minutes"
      - "Memory > 80% for 5 minutes"
      - "Active connections > 80% capacity"
      
    scale_in:
      - "CPU < 30% for 15 minutes"
      - "Memory < 50% for 15 minutes"
      - "Active connections < 40% capacity"
```

### 2. 데이터베이스 샤딩 전략
```javascript
// database/shardingStrategy.js
class ShardingStrategy {
  constructor() {
    this.shardKey = 'club_id'; // 클럽 ID 기반 샤딩
    this.shardMapping = new Map();
  }

  // 샤드 라우팅 로직
  getShardForClub(clubId) {
    // 일관된 해싱 사용
    const hash = this.generateHash(clubId);
    const shardCount = process.env.SHARD_COUNT || 2;
    const shardIndex = hash % shardCount;
    
    return `shard_${shardIndex}`;
  }

  generateHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash);
  }

  // 샤드별 연결 관리
  async getConnection(clubId) {
    const shardName = this.getShardForClub(clubId);
    
    if (!this.shardMapping.has(shardName)) {
      const connectionString = process.env[`MONGODB_${shardName.toUpperCase()}_URI`];
      const connection = await mongoose.createConnection(connectionString);
      this.shardMapping.set(shardName, connection);
    }
    
    return this.shardMapping.get(shardName);
  }

  // 크로스 샤드 쿼리 (필요한 경우)
  async crossShardQuery(query, options = {}) {
    const results = [];
    const promises = [];
    
    for (const [shardName, connection] of this.shardMapping) {
      const promise = this.executeQueryOnShard(connection, query, options);
      promises.push(promise);
    }
    
    const shardResults = await Promise.all(promises);
    return this.mergeShardResults(shardResults, options);
  }

  mergeShardResults(shardResults, options) {
    let mergedResults = [];
    
    // 모든 샤드 결과 병합
    shardResults.forEach(result => {
      if (Array.isArray(result)) {
        mergedResults = mergedResults.concat(result);
      }
    });

    // 정렬 (필요한 경우)
    if (options.sort) {
      mergedResults.sort((a, b) => {
        // 정렬 로직 구현
        return this.compareBySortOption(a, b, options.sort);
      });
    }

    // 페이지네이션 (필요한 경우)
    if (options.limit) {
      const skip = options.skip || 0;
      mergedResults = mergedResults.slice(skip, skip + options.limit);
    }

    return mergedResults;
  }
}

module.exports = new ShardingStrategy();
```

### 3. 마이크로서비스 분리 계획
```javascript
// services/microservicesArchitecture.js
const microservicesArchitecture = {
  // 서비스 분리 계획
  services: {
    auth_service: {
      responsibilities: [
        'JWT 토큰 관리',
        'Band OAuth 인증',
        '사용자 세션 관리',
        '권한 검증'
      ],
      database: 'users, sessions, tokens',
      scaling_priority: 'high',
      stateless: true
    },
    
    content_service: {
      responsibilities: [
        '게시글 관리',
        '댓글 시스템',
        '파일 업로드',
        '검색 기능'
      ],
      database: 'posts, comments, files',
      scaling_priority: 'medium',
      stateless: true
    },
    
    game_service: {
      responsibilities: [
        '게임 생성/관리',
        '참가자 관리',
        '점수 처리',
        '게임 통계'
      ],
      database: 'games, game_results, statistics',
      scaling_priority: 'medium',
      stateless: true
    },
    
    chat_service: {
      responsibilities: [
        '실시간 채팅',
        '메시지 저장',
        '채팅방 관리',
        'Socket.io 처리'
      ],
      database: 'chat_rooms, messages',
      scaling_priority: 'high',
      stateless: false // Socket 연결 유지 필요
    },
    
    band_sync_service: {
      responsibilities: [
        'Band API 연동',
        '멤버 동기화',
        '사진 동기화',
        '데이터 캐싱'
      ],
      database: 'sync_logs, band_cache',
      scaling_priority: 'low',
      stateless: true,
      scheduled_jobs: true
    },
    
    notification_service: {
      responsibilities: [
        '푸시 알림 발송',
        '이메일 알림',
        '알림 스케줄링',
        '알림 템플릿 관리'
      ],
      database: 'notifications, notification_templates',
      scaling_priority: 'medium',
      stateless: true,
      message_queue: true
    }
  },

  // 서비스 간 통신
  communication: {
    api_gateway: {
      tool: 'AWS API Gateway',
      responsibilities: [
        '라우팅',
        'Rate limiting',
        '인증 검증',
        'Request/Response 변환'
      ]
    },
    
    service_mesh: {
      tool: 'AWS App Mesh',
      features: [
        '서비스 디스커버리',
        '로드 밸런싱',
        '회로 차단기',
        '분산 추적'
      ]
    },
    
    message_queue: {
      tool: 'AWS SQS',
      use_cases: [
        '비동기 작업 처리',
        '서비스 간 이벤트 전달',
        '배치 작업 큐잉'
      ]
    }
  },

  // 데이터 일관성
  data_consistency: {
    strategy: 'Eventually Consistent',
    patterns: [
      'Event Sourcing',
      'CQRS (Command Query Responsibility Segregation)',
      'Saga Pattern'
    ],
    
    distributed_transactions: {
      tool: 'AWS Step Functions',
      use_cases: [
        '사용자 가입 프로세스',
        '게임 결과 처리',
        'Band 데이터 동기화'
      ]
    }
  }
};

module.exports = microservicesArchitecture;
```

### 4. 성능 모니터링 및 알람
```javascript
// monitoring/performanceMonitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.alertThresholds = {
      response_time: 1000, // 1초
      error_rate: 0.01,    // 1%
      memory_usage: 0.8,   // 80%
      cpu_usage: 0.7,      // 70%
      connection_count: 1000
    };
  }

  // 실시간 성능 메트릭 수집
  collectMetrics() {
    setInterval(async () => {
      const metrics = await this.gatherSystemMetrics();
      this.analyzeMetrics(metrics);
      this.checkAlerts(metrics);
    }, 10000); // 10초마다 수집
  }

  async gatherSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      connections: global.activeConnections || 0,
      responseTime: this.getAverageResponseTime(),
      errorRate: this.getErrorRate(),
      throughput: this.getThroughput()
    };
  }

  checkAlerts(metrics) {
    const alerts = [];

    // 응답 시간 알림
    if (metrics.responseTime > this.alertThresholds.response_time) {
      alerts.push({
        type: 'SLOW_RESPONSE',
        severity: 'warning',
        message: `평균 응답 시간이 ${metrics.responseTime}ms입니다`,
        value: metrics.responseTime,
        threshold: this.alertThresholds.response_time
      });
    }

    // 에러율 알림
    if (metrics.errorRate > this.alertThresholds.error_rate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `에러율이 ${(metrics.errorRate * 100).toFixed(2)}%입니다`,
        value: metrics.errorRate,
        threshold: this.alertThresholds.error_rate
      });
    }

    // 메모리 사용량 알림
    const memoryUsageRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (memoryUsageRatio > this.alertThresholds.memory_usage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        message: `메모리 사용률이 ${(memoryUsageRatio * 100).toFixed(1)}%입니다`,
        value: memoryUsageRatio,
        threshold: this.alertThresholds.memory_usage
      });
    }

    // 알림 발송
    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }

  async sendAlerts(alerts) {
    for (const alert of alerts) {
      try {
        // Slack 알림
        await this.sendSlackAlert(alert);
        
        // 이메일 알림 (중요한 경우)
        if (alert.severity === 'critical') {
          await this.sendEmailAlert(alert);
        }

        // 로그 기록
        logger.warn('성능 알림 발생', alert);
      } catch (error) {
        logger.error('알림 발송 실패:', error);
      }
    }
  }

  // 자동 스케일링 트리거
  triggerAutoScaling(metrics) {
    const scaleOutConditions = [
      metrics.responseTime > 2000,
      metrics.memory.heapUsed / metrics.memory.heapTotal > 0.85,
      metrics.connections > this.alertThresholds.connection_count * 0.8
    ];

    const scaleInConditions = [
      metrics.responseTime < 200,
      metrics.memory.heapUsed / metrics.memory.heapTotal < 0.3,
      metrics.connections < this.alertThresholds.connection_count * 0.2
    ];

    if (scaleOutConditions.some(condition => condition)) {
      this.requestScaleOut();
    } else if (scaleInConditions.every(condition => condition)) {
      this.requestScaleIn();
    }
  }

  async requestScaleOut() {
    logger.info('스케일 아웃 요청');
    
    // AWS ECS 서비스 스케일링
    try {
      const ecs = new AWS.ECS();
      await ecs.updateService({
        cluster: process.env.ECS_CLUSTER,
        service: process.env.ECS_SERVICE,
        desiredCount: await this.getCurrentInstanceCount() + 1
      }).promise();
      
      logger.info('스케일 아웃 완료');
    } catch (error) {
      logger.error('스케일 아웃 실패:', error);
    }
  }

  // 성능 리포트 생성
  generatePerformanceReport(timeRange = '24h') {
    const metrics = this.getMetricsForTimeRange(timeRange);
    
    return {
      summary: {
        average_response_time: this.calculateAverage(metrics, 'responseTime'),
        peak_response_time: Math.max(...metrics.map(m => m.responseTime)),
        average_memory_usage: this.calculateAverage(metrics, 'memory.heapUsed'),
        error_rate: this.calculateAverage(metrics, 'errorRate'),
        uptime_percentage: this.calculateUptime(metrics)
      },
      trends: {
        response_time_trend: this.calculateTrend(metrics, 'responseTime'),
        memory_usage_trend: this.calculateTrend(metrics, 'memory.heapUsed'),
        error_rate_trend: this.calculateTrend(metrics, 'errorRate')
      },
      recommendations: this.generateRecommendations(metrics)
    };
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    const avgResponseTime = this.calculateAverage(metrics, 'responseTime');
    if (avgResponseTime > 500) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: '평균 응답 시간이 높습니다. 데이터베이스 쿼리 최적화를 검토하세요.'
      });
    }

    const avgMemoryUsage = this.calculateAverage(metrics, 'memory.heapUsed');
    if (avgMemoryUsage > 1024 * 1024 * 1024) { // 1GB
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: '메모리 사용량이 높습니다. 메모리 누수를 확인하고 캐시 정리를 고려하세요.'
      });
    }

    return recommendations;
  }
}

module.exports = new PerformanceMonitor();
```

이 성능 최적화 및 스케일링 계획을 통해 동배즐 앱이 안정적으로 성장하고 사용자 증가에 대응할 수 있는 견고한 기반을 마련할 수 있습니다.