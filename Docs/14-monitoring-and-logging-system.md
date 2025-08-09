# 모니터링 및 로깅 시스템 설계

## 목차
1. [모니터링 전략 개요](#모니터링-전략-개요)
2. [애플리케이션 모니터링](#애플리케이션-모니터링)
3. [인프라 모니터링](#인프라-모니터링)
4. [로깅 시스템](#로깅-시스템)
5. [알림 및 경고 시스템](#알림-및-경고-시스템)
6. [성능 모니터링](#성능-모니터링)
7. [사용자 행동 분석](#사용자-행동-분석)
8. [보안 모니터링](#보안-모니터링)
9. [대시보드 및 시각화](#대시보드-및-시각화)

## 모니터링 전략 개요

### 모니터링 철학
```
Golden Signals:
1. Latency (지연시간) - 요청 처리 시간
2. Traffic (트래픽) - 초당 요청 수
3. Errors (오류) - 실패율
4. Saturation (포화도) - 리소스 사용률
```

### 모니터링 계층
```
┌─────────────────────────────────────┐
│           사용자 경험 모니터링           │
├─────────────────────────────────────┤
│           애플리케이션 모니터링          │
├─────────────────────────────────────┤
│           인프라 모니터링              │
├─────────────────────────────────────┤
│           네트워크 모니터링             │
└─────────────────────────────────────┘
```

### 주요 메트릭 카테고리

#### 비즈니스 메트릭
- 일일 활성 사용자 (DAU)
- 게임 생성/참가 율
- Band API 동기화 성공률
- 사용자 세션 시간

#### 기술 메트릭
- API 응답 시간
- 데이터베이스 쿼리 성능
- 메모리/CPU 사용률
- 네트워크 지연시간

#### 서비스 품질 메트릭
- 가용성 (Availability)
- 안정성 (Reliability)
- 확장성 (Scalability)
- 보안 (Security)

## 애플리케이션 모니터링

### Node.js 백엔드 모니터링

#### Express.js 미들웨어 설정
```javascript
// src/middleware/monitoring.js
import prometheus from 'prom-client';
import responseTime from 'response-time';
import { createLogger } from '../utils/logger';

const logger = createLogger('monitoring');

// Prometheus 메트릭 정의
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// 미들웨어 함수
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
    
    // 에러 로깅
    if (res.statusCode >= 400) {
      logger.error('HTTP Error', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
  });
  
  next();
};

// 커스텀 비즈니스 메트릭
export const gameMetrics = {
  gamesCreated: new prometheus.Counter({
    name: 'games_created_total',
    help: 'Total number of games created',
    labelNames: ['creator_role']
  }),
  
  gameParticipations: new prometheus.Counter({
    name: 'game_participations_total',
    help: 'Total number of game participations',
    labelNames: ['game_type']
  }),
  
  bandApiCalls: new prometheus.Counter({
    name: 'band_api_calls_total',
    help: 'Total number of Band API calls',
    labelNames: ['endpoint', 'status']
  }),
  
  activeSessions: new prometheus.Gauge({
    name: 'active_user_sessions',
    help: 'Number of active user sessions'
  })
};
```

#### Health Check 엔드포인트
```javascript
// src/routes/health.js
import express from 'express';
import mongoose from 'mongoose';
import redis from '../config/redis';
import { BandAPI } from '../services/bandAPI';

const router = express.Router();

// 기본 헬스 체크
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

// 상세 헬스 체크
router.get('/health/detailed', async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    bandAPI: 'unknown',
    memory: 'unknown'
  };

  try {
    // 데이터베이스 연결 확인
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.database = 'healthy';
    } else {
      checks.database = 'unhealthy';
    }
  } catch (error) {
    checks.database = 'unhealthy';
  }

  try {
    // Redis 연결 확인
    await redis.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
  }

  try {
    // Band API 연결 확인
    await BandAPI.healthCheck();
    checks.bandAPI = 'healthy';
  } catch (error) {
    checks.bandAPI = 'unhealthy';
  }

  // 메모리 사용량 확인
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  checks.memory = memoryUsagePercent < 80 ? 'healthy' : 'warning';

  const overallStatus = Object.values(checks).every(status => 
    status === 'healthy' || status === 'warning'
  ) ? 'healthy' : 'unhealthy';

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      percentage: Math.round(memoryUsagePercent)
    }
  });
});

export default router;
```

### React Native 클라이언트 모니터링

#### 성능 모니터링 서비스
```javascript
// src/services/performanceMonitoring.js
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import perf from '@react-native-firebase/perf';

class PerformanceMonitoringService {
  constructor() {
    this.metrics = new Map();
    this.traces = new Map();
  }

  // 화면 로딩 시간 측정
  startScreenTrace(screenName) {
    const trace = perf().newTrace(`screen_${screenName}_load`);
    trace.start();
    this.traces.set(screenName, trace);
    
    return {
      stop: () => {
        const existingTrace = this.traces.get(screenName);
        if (existingTrace) {
          existingTrace.stop();
          this.traces.delete(screenName);
        }
      }
    };
  }

  // API 호출 시간 측정
  async trackAPICall(endpoint, apiCall) {
    const trace = perf().newTrace(`api_${endpoint.replace(/\//g, '_')}`);
    trace.start();
    
    const startTime = Date.now();
    
    try {
      const result = await apiCall();
      
      trace.putAttribute('status', 'success');
      trace.putMetric('duration', Date.now() - startTime);
      
      // 성공 이벤트 로깅
      await analytics().logEvent('api_call_success', {
        endpoint,
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      trace.putAttribute('status', 'error');
      trace.putAttribute('error_type', error.name);
      trace.putMetric('duration', Date.now() - startTime);
      
      // 에러 이벤트 로깅
      await analytics().logEvent('api_call_error', {
        endpoint,
        error_message: error.message,
        duration: Date.now() - startTime
      });
      
      // Crashlytics에 에러 보고
      crashlytics().recordError(error);
      
      throw error;
    } finally {
      trace.stop();
    }
  }

  // 사용자 행동 추적
  async trackUserAction(action, parameters = {}) {
    try {
      await analytics().logEvent(action, {
        ...parameters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  // 앱 성능 메트릭 수집
  collectAppMetrics() {
    const metrics = {
      memory: this.getMemoryUsage(),
      battery: this.getBatteryLevel(),
      network: this.getNetworkInfo(),
      device: this.getDeviceInfo()
    };

    return metrics;
  }

  // 메모리 사용량 (React Native 메모리 정보는 제한적)
  getMemoryUsage() {
    // 플랫폼별 메모리 정보 수집
    return {
      timestamp: Date.now(),
      // iOS/Android 네이티브 모듈 필요
      estimated: 'native_module_required'
    };
  }

  // 배터리 레벨
  getBatteryLevel() {
    // react-native-device-info 사용
    return {
      timestamp: Date.now(),
      level: 'device_info_module_required'
    };
  }

  // 네트워크 정보
  getNetworkInfo() {
    // @react-native-community/netinfo 사용
    return {
      timestamp: Date.now(),
      type: 'netinfo_module_required'
    };
  }

  // 디바이스 정보
  getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      timestamp: Date.now()
    };
  }

  // 커스텀 메트릭 설정
  setCustomMetric(name, value, attributes = {}) {
    this.metrics.set(name, {
      value,
      attributes,
      timestamp: Date.now()
    });
  }

  // 에러 보고
  reportError(error, context = {}) {
    crashlytics().recordError(error);
    crashlytics().setAttributes(context);
  }

  // 사용자 정보 설정
  setUser(userId, attributes = {}) {
    crashlytics().setUserId(userId);
    analytics().setUserId(userId);
    
    Object.entries(attributes).forEach(([key, value]) => {
      analytics().setUserProperty(key, value);
    });
  }
}

export const performanceMonitoring = new PerformanceMonitoringService();
```

#### 사용 예시
```javascript
// src/screens/HomeScreen.js
import React, { useEffect } from 'react';
import { performanceMonitoring } from '../services/performanceMonitoring';

export const HomeScreen = () => {
  useEffect(() => {
    // 화면 로딩 시간 측정
    const trace = performanceMonitoring.startScreenTrace('home');
    
    const loadData = async () => {
      try {
        // API 호출 성능 측정
        const games = await performanceMonitoring.trackAPICall(
          '/api/games',
          () => gameAPI.getGames()
        );
        
        // 사용자 행동 추적
        await performanceMonitoring.trackUserAction('home_screen_loaded', {
          games_count: games.length
        });
        
      } catch (error) {
        performanceMonitoring.reportError(error, {
          screen: 'home',
          action: 'load_games'
        });
      } finally {
        trace.stop();
      }
    };

    loadData();
  }, []);

  return (
    // 컴포넌트 렌더링
  );
};
```

## 인프라 모니터링

### AWS CloudWatch 설정

#### 커스텀 메트릭 전송
```javascript
// src/utils/cloudwatch.js
import AWS from 'aws-sdk';

const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION
});

class CloudWatchMetrics {
  constructor(namespace = 'DongBaeJul') {
    this.namespace = namespace;
  }

  async putMetric(metricName, value, unit = 'Count', dimensions = []) {
    const params = {
      Namespace: this.namespace,
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Dimensions: dimensions,
        Timestamp: new Date()
      }]
    };

    try {
      await cloudwatch.putMetricData(params).promise();
    } catch (error) {
      console.error('CloudWatch metric failed:', error);
    }
  }

  async putCustomMetrics(metrics) {
    const metricData = metrics.map(metric => ({
      MetricName: metric.name,
      Value: metric.value,
      Unit: metric.unit || 'Count',
      Dimensions: metric.dimensions || [],
      Timestamp: new Date()
    }));

    const params = {
      Namespace: this.namespace,
      MetricData: metricData
    };

    try {
      await cloudwatch.putMetricData(params).promise();
    } catch (error) {
      console.error('CloudWatch batch metrics failed:', error);
    }
  }
}

export const cloudwatchMetrics = new CloudWatchMetrics();
```

#### Infrastructure as Code (CloudFormation)
```yaml
# monitoring-stack.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'DongBaeJul Monitoring Stack'

Resources:
  # CloudWatch Dashboard
  MonitoringDashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: DongBaeJul-Monitoring
      DashboardBody: !Sub |
        {
          "widgets": [
            {
              "type": "metric",
              "properties": {
                "metrics": [
                  ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${LoadBalancer}"],
                  [".", "TargetResponseTime", ".", "."],
                  [".", "HTTPCode_Target_4XX_Count", ".", "."],
                  [".", "HTTPCode_Target_5XX_Count", ".", "."]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "ap-northeast-2",
                "title": "ALB Metrics"
              }
            },
            {
              "type": "metric",
              "properties": {
                "metrics": [
                  ["AWS/ECS", "CPUUtilization", "ServiceName", "${ECSService}"],
                  [".", "MemoryUtilization", ".", "."]
                ],
                "period": 300,
                "stat": "Average",
                "region": "ap-northeast-2",
                "title": "ECS Service Metrics"
              }
            }
          ]
        }

  # SNS Topic for Alerts
  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: DongBaeJul-Alerts
      Subscription:
        - Protocol: email
          Endpoint: admin@dongbaejul.com
        - Protocol: https
          Endpoint: !Sub 'https://hooks.slack.com/services/${SlackWebhookPath}'

  # CloudWatch Alarms
  HighErrorRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: DongBaeJul-HighErrorRate
      AlarmDescription: High error rate detected
      MetricName: HTTPCode_Target_5XX_Count
      Namespace: AWS/ApplicationELB
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic
      Dimensions:
        - Name: LoadBalancer
          Value: !Ref LoadBalancer

  HighResponseTimeAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: DongBaeJul-HighResponseTime
      AlarmDescription: High response time detected
      MetricName: TargetResponseTime
      Namespace: AWS/ApplicationELB
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 2.0
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic
      Dimensions:
        - Name: LoadBalancer
          Value: !Ref LoadBalancer

  DatabaseConnectionsAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: DongBaeJul-HighDBConnections
      AlarmDescription: High database connections
      MetricName: DatabaseConnections
      Namespace: AWS/DocDB
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic
```

## 로깅 시스템

### 구조화된 로깅

#### Winston 로거 설정
```javascript
// src/utils/logger.js
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
  },
  index: 'dongbaejul-logs',
  indexTemplate: {
    name: 'dongbaejul-logs-template',
    body: {
      index_patterns: ['dongbaejul-logs-*'],
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1
      },
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          service: { type: 'keyword' },
          userId: { type: 'keyword' },
          requestId: { type: 'keyword' },
          action: { type: 'keyword' },
          duration: { type: 'integer' },
          error: {
            properties: {
              name: { type: 'keyword' },
              message: { type: 'text' },
              stack: { type: 'text' }
            }
          }
        }
      }
    }
  }
};

const createLogger = (service) => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ];

  // 프로덕션 환경에서는 Elasticsearch 추가
  if (process.env.NODE_ENV === 'production') {
    transports.push(new ElasticsearchTransport(esTransportOpts));
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service: svc, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          service: service || svc,
          ...meta
        });
      })
    ),
    defaultMeta: { service },
    transports
  });
};

export { createLogger };

// 특정 도메인별 로거
export const gameLogger = createLogger('game');
export const authLogger = createLogger('auth');
export const bandAPILogger = createLogger('band-api');
export const socketLogger = createLogger('socket');
```

#### 로깅 미들웨어
```javascript
// src/middleware/logging.js
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('http');

export const requestLoggingMiddleware = (req, res, next) => {
  // 요청 ID 생성
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);

  const startTime = Date.now();
  
  // 요청 로깅
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      logger.error('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

// 에러 로깅 미들웨어
export const errorLoggingMiddleware = (err, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.id,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    method: req.method,
    url: req.url,
    userId: req.user?.id
  });

  next(err);
};
```

#### 비즈니스 로직 로깅
```javascript
// src/services/gameService.js
import { gameLogger } from '../utils/logger';

export class GameService {
  async createGame(gameData, userId) {
    const startTime = Date.now();
    
    gameLogger.info('Game creation started', {
      userId,
      gameTitle: gameData.title,
      maxParticipants: gameData.maxParticipants
    });

    try {
      const game = await Game.create({
        ...gameData,
        creator: userId
      });

      // Band API 알림
      await this.notifyBandGroup(game);

      gameLogger.info('Game created successfully', {
        gameId: game.id,
        userId,
        duration: Date.now() - startTime
      });

      return game;
    } catch (error) {
      gameLogger.error('Game creation failed', {
        userId,
        error: {
          name: error.name,
          message: error.message
        },
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  }

  async joinGame(gameId, userId) {
    gameLogger.info('Game join attempt', { gameId, userId });

    try {
      const game = await Game.findById(gameId);
      
      if (!game) {
        gameLogger.warn('Game not found', { gameId, userId });
        throw new Error('Game not found');
      }

      if (game.participants.includes(userId)) {
        gameLogger.warn('User already in game', { gameId, userId });
        throw new Error('Already joined');
      }

      game.participants.push(userId);
      await game.save();

      gameLogger.info('User joined game', {
        gameId,
        userId,
        participantCount: game.participants.length
      });

      return game;
    } catch (error) {
      gameLogger.error('Game join failed', {
        gameId,
        userId,
        error: {
          name: error.name,
          message: error.message
        }
      });
      
      throw error;
    }
  }
}
```

### 로그 집계 및 분석

#### ELK Stack 설정 (docker-compose)
```yaml
# docker-compose-elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    container_name: logstash
    ports:
      - "5044:5044"
      - "9600:9600"
    volumes:
      - ./logstash/config:/usr/share/logstash/config:ro
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  elasticsearch-data:
```

#### Logstash 파이프라인 설정
```ruby
# logstash/pipeline/logstash.conf
input {
  beats {
    port => 5044
  }
  
  http {
    port => 8080
    codec => json
  }
}

filter {
  if [fields][service] == "dongbaejul-backend" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    if [error] {
      mutate {
        add_tag => ["error"]
      }
    }
    
    if [level] == "error" {
      mutate {
        add_tag => ["alert"]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "dongbaejul-logs-%{+YYYY.MM.dd}"
  }
  
  if "alert" in [tags] {
    http {
      url => "${SLACK_WEBHOOK_URL}"
      http_method => "post"
      content_type => "application/json"
      format => "message"
      message => '{"text": "🚨 Error in DongBaeJul: %{message}"}'
    }
  }
}
```

## 알림 및 경고 시스템

### Slack 통합

#### Slack 알림 서비스
```javascript
// src/services/alertService.js
import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('alerts');

class AlertService {
  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channels = {
      critical: process.env.SLACK_CRITICAL_CHANNEL || '#alerts-critical',
      warning: process.env.SLACK_WARNING_CHANNEL || '#alerts-warning',
      info: process.env.SLACK_INFO_CHANNEL || '#alerts-info'
    };
  }

  async sendSlackAlert(severity, title, message, fields = []) {
    if (!this.slackWebhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const colors = {
      critical: '#FF0000',
      warning: '#FFA500',
      info: '#00FF00'
    };

    const payload = {
      channel: this.channels[severity] || this.channels.info,
      username: 'DongBaeJul Monitor',
      icon_emoji: ':warning:',
      attachments: [{
        color: colors[severity],
        title,
        text: message,
        fields,
        footer: 'DongBaeJul Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    try {
      await axios.post(this.slackWebhookUrl, payload);
      logger.info('Slack alert sent', { severity, title });
    } catch (error) {
      logger.error('Failed to send Slack alert', {
        error: error.message,
        severity,
        title
      });
    }
  }

  async sendErrorAlert(error, context = {}) {
    const fields = Object.entries(context).map(([key, value]) => ({
      title: key,
      value: String(value),
      short: true
    }));

    await this.sendSlackAlert(
      'critical',
      `Error in ${context.service || 'Unknown Service'}`,
      error.message,
      fields
    );
  }

  async sendPerformanceAlert(metric, value, threshold, context = {}) {
    const fields = [
      { title: 'Metric', value: metric, short: true },
      { title: 'Current Value', value: String(value), short: true },
      { title: 'Threshold', value: String(threshold), short: true },
      ...Object.entries(context).map(([key, value]) => ({
        title: key,
        value: String(value),
        short: true
      }))
    ];

    await this.sendSlackAlert(
      'warning',
      'Performance Alert',
      `${metric} exceeded threshold`,
      fields
    );
  }

  async sendBusinessAlert(event, data = {}) {
    const fields = Object.entries(data).map(([key, value]) => ({
      title: key,
      value: String(value),
      short: true
    }));

    await this.sendSlackAlert(
      'info',
      'Business Event',
      event,
      fields
    );
  }
}

export const alertService = new AlertService();
```

### 이메일 알림

#### 이메일 서비스 (AWS SES)
```javascript
// src/services/emailService.js
import AWS from 'aws-sdk';
import { createLogger } from '../utils/logger';

const logger = createLogger('email');
const ses = new AWS.SES({ region: process.env.AWS_REGION });

class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@dongbaejul.com';
    this.adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
  }

  async sendAlert(subject, htmlBody, textBody) {
    if (this.adminEmails.length === 0) {
      logger.warn('No admin emails configured');
      return;
    }

    const params = {
      Source: this.fromEmail,
      Destination: {
        ToAddresses: this.adminEmails
      },
      Message: {
        Subject: {
          Data: `[DongBaeJul Alert] ${subject}`,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    };

    try {
      await ses.sendEmail(params).promise();
      logger.info('Alert email sent', { subject, recipients: this.adminEmails });
    } catch (error) {
      logger.error('Failed to send alert email', {
        error: error.message,
        subject
      });
    }
  }

  async sendCriticalAlert(title, message, details = {}) {
    const htmlBody = `
      <h2 style="color: #FF0000;">🚨 Critical Alert</h2>
      <h3>${title}</h3>
      <p>${message}</p>
      <h4>Details:</h4>
      <ul>
        ${Object.entries(details).map(([key, value]) => 
          `<li><strong>${key}:</strong> ${value}</li>`
        ).join('')}
      </ul>
      <p><small>Timestamp: ${new Date().toISOString()}</small></p>
    `;

    const textBody = `
CRITICAL ALERT

${title}

${message}

Details:
${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n')}

Timestamp: ${new Date().toISOString()}
    `;

    await this.sendAlert(title, htmlBody, textBody);
  }
}

export const emailService = new EmailService();
```

## 성능 모니터링

### APM (Application Performance Monitoring)

#### New Relic 통합
```javascript
// src/utils/newrelic.js
import newrelic from 'newrelic';

export const trackCustomMetric = (name, value) => {
  newrelic.recordCustomMetric(name, value);
};

export const trackCustomEvent = (eventType, attributes) => {
  newrelic.recordCustomEvent(eventType, attributes);
};

export const addCustomAttribute = (key, value) => {
  newrelic.addCustomAttribute(key, value);
};

// 비즈니스 메트릭 추적
export const trackBusinessMetrics = {
  gameCreated: (gameData) => {
    trackCustomEvent('GameCreated', {
      gameType: gameData.type,
      maxParticipants: gameData.maxParticipants,
      creatorRole: gameData.creatorRole
    });
  },

  userJoinedGame: (gameId, userId) => {
    trackCustomEvent('UserJoinedGame', {
      gameId,
      userId
    });
  },

  bandAPICall: (endpoint, duration, success) => {
    trackCustomMetric('Custom/BandAPI/Duration', duration);
    trackCustomEvent('BandAPICall', {
      endpoint,
      duration,
      success
    });
  }
};
```

### 데이터베이스 성능 모니터링

#### MongoDB 모니터링
```javascript
// src/utils/mongoMonitoring.js
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { cloudwatchMetrics } from './cloudwatch';

const logger = createLogger('mongo-monitoring');

// 슬로우 쿼리 모니터링
mongoose.set('debug', (coll, method, query, doc, options) => {
  const start = Date.now();
  
  // 쿼리 실행 후 측정
  setImmediate(() => {
    const duration = Date.now() - start;
    
    if (duration > 1000) { // 1초 이상 걸린 쿼리
      logger.warn('Slow query detected', {
        collection: coll,
        method,
        query: JSON.stringify(query),
        duration
      });
      
      // CloudWatch 메트릭 전송
      cloudwatchMetrics.putMetric('SlowQueryCount', 1, 'Count', [
        { Name: 'Collection', Value: coll },
        { Name: 'Method', Value: method }
      ]);
    }
    
    // 모든 쿼리 성능 메트릭
    cloudwatchMetrics.putMetric('QueryDuration', duration, 'Milliseconds', [
      { Name: 'Collection', Value: coll },
      { Name: 'Method', Value: method }
    ]);
  });
});

// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected');
  cloudwatchMetrics.putMetric('MongoDBConnection', 1, 'Count');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
  cloudwatchMetrics.putMetric('MongoDBConnectionError', 1, 'Count');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  cloudwatchMetrics.putMetric('MongoDBConnection', 0, 'Count');
});

// 연결 풀 모니터링
setInterval(() => {
  const stats = mongoose.connection.db?.stats();
  if (stats) {
    cloudwatchMetrics.putCustomMetrics([
      { name: 'MongoDBConnections', value: stats.connections || 0 },
      { name: 'MongoDBDataSize', value: stats.dataSize || 0, unit: 'Bytes' },
      { name: 'MongoDBIndexSize', value: stats.indexSize || 0, unit: 'Bytes' }
    ]);
  }
}, 60000); // 1분마다
```

## 사용자 행동 분석

### Google Analytics 4 통합

#### React Native Analytics
```javascript
// src/services/analytics.js
import analytics from '@react-native-firebase/analytics';
import { createLogger } from '../utils/logger';

const logger = createLogger('analytics');

class AnalyticsService {
  constructor() {
    this.isEnabled = true;
  }

  async initialize() {
    try {
      await analytics().setAnalyticsCollectionEnabled(this.isEnabled);
      logger.info('Analytics initialized');
    } catch (error) {
      logger.error('Analytics initialization failed', { error: error.message });
    }
  }

  // 화면 조회 추적
  async trackScreenView(screenName, screenClass) {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass
      });
    } catch (error) {
      logger.error('Screen view tracking failed', { error: error.message });
    }
  }

  // 사용자 행동 추적
  async trackEvent(eventName, parameters = {}) {
    try {
      await analytics().logEvent(eventName, {
        ...parameters,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Event tracking failed', { error: error.message });
    }
  }

  // 사용자 속성 설정
  async setUserProperties(properties) {
    try {
      for (const [key, value] of Object.entries(properties)) {
        await analytics().setUserProperty(key, String(value));
      }
    } catch (error) {
      logger.error('User properties setting failed', { error: error.message });
    }
  }

  // 비즈니스 특화 이벤트
  async trackGameEvents(event, gameData = {}) {
    const events = {
      game_created: () => this.trackEvent('game_created', {
        game_type: gameData.type,
        max_participants: gameData.maxParticipants
      }),
      
      game_joined: () => this.trackEvent('game_joined', {
        game_id: gameData.id,
        participants_count: gameData.participantsCount
      }),
      
      game_left: () => this.trackEvent('game_left', {
        game_id: gameData.id,
        time_spent: gameData.timeSpent
      }),
      
      game_completed: () => this.trackEvent('game_completed', {
        game_id: gameData.id,
        duration: gameData.duration,
        participants_count: gameData.participantsCount
      })
    };

    if (events[event]) {
      await events[event]();
    }
  }

  // 밴드 연동 이벤트
  async trackBandEvents(event, data = {}) {
    const events = {
      band_login_started: () => this.trackEvent('band_login_started'),
      band_login_completed: () => this.trackEvent('band_login_completed', {
        user_role: data.role
      }),
      band_sync_completed: () => this.trackEvent('band_sync_completed', {
        members_synced: data.membersCount,
        posts_synced: data.postsCount
      })
    };

    if (events[event]) {
      await events[event]();
    }
  }

  // 앱 사용성 메트릭
  async trackUsabilityMetrics(metric, value, context = {}) {
    await this.trackEvent('usability_metric', {
      metric_name: metric,
      metric_value: value,
      ...context
    });
  }
}

export const analyticsService = new AnalyticsService();
```

### 사용자 세션 추적

#### 세션 관리 서비스
```javascript
// src/services/sessionTracking.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from './analytics';
import { performanceMonitoring } from './performanceMonitoring';

class SessionTrackingService {
  constructor() {
    this.sessionStart = null;
    this.sessionId = null;
    this.interactions = [];
  }

  async startSession(userId) {
    this.sessionStart = Date.now();
    this.sessionId = `session_${userId}_${this.sessionStart}`;
    this.interactions = [];

    // 세션 시작 이벤트
    await analyticsService.trackEvent('session_start', {
      session_id: this.sessionId,
      user_id: userId
    });

    // 이전 세션 데이터 전송
    await this.sendPendingSessionData();
  }

  async endSession(userId) {
    if (!this.sessionStart) return;

    const sessionDuration = Date.now() - this.sessionStart;
    
    const sessionData = {
      session_id: this.sessionId,
      user_id: userId,
      duration: sessionDuration,
      interactions_count: this.interactions.length,
      interactions: this.interactions.slice(-50) // 최근 50개 상호작용만
    };

    // 세션 종료 이벤트
    await analyticsService.trackEvent('session_end', sessionData);

    // 로컬에 백업 저장 (오프라인 대응)
    await this.saveSessionDataLocally(sessionData);

    // 세션 데이터 초기화
    this.sessionStart = null;
    this.sessionId = null;
    this.interactions = [];
  }

  async trackInteraction(type, target, context = {}) {
    const interaction = {
      type,
      target,
      timestamp: Date.now(),
      context
    };

    this.interactions.push(interaction);

    // 실시간 상호작용 추적
    await analyticsService.trackEvent('user_interaction', {
      interaction_type: type,
      interaction_target: target,
      session_id: this.sessionId,
      ...context
    });

    // 성능 모니터링에도 전송
    await performanceMonitoring.trackUserAction(`interaction_${type}`, {
      target,
      ...context
    });
  }

  async saveSessionDataLocally(sessionData) {
    try {
      const existingSessions = await AsyncStorage.getItem('pending_sessions');
      const sessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      sessions.push(sessionData);
      
      // 최대 10개 세션만 보관
      if (sessions.length > 10) {
        sessions.shift();
      }
      
      await AsyncStorage.setItem('pending_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save session data locally:', error);
    }
  }

  async sendPendingSessionData() {
    try {
      const pendingSessions = await AsyncStorage.getItem('pending_sessions');
      if (!pendingSessions) return;

      const sessions = JSON.parse(pendingSessions);
      
      for (const sessionData of sessions) {
        await analyticsService.trackEvent('session_data_delayed', sessionData);
      }

      // 전송 완료 후 로컬 데이터 삭제
      await AsyncStorage.removeItem('pending_sessions');
    } catch (error) {
      console.error('Failed to send pending session data:', error);
    }
  }
}

export const sessionTracking = new SessionTrackingService();
```

## 보안 모니터링

### 보안 이벤트 추적

#### 보안 모니터링 서비스
```javascript
// src/services/securityMonitoring.js
import { createLogger } from '../utils/logger';
import { alertService } from './alertService';
import { cloudwatchMetrics } from '../utils/cloudwatch';

const logger = createLogger('security');

class SecurityMonitoringService {
  constructor() {
    this.suspiciousActivity = new Map();
    this.rateLimits = new Map();
  }

  // 로그인 시도 모니터링
  async trackLoginAttempt(userId, ip, success, context = {}) {
    const logData = {
      userId,
      ip,
      success,
      timestamp: Date.now(),
      userAgent: context.userAgent,
      location: context.location
    };

    if (success) {
      logger.info('Successful login', logData);
      
      // 성공 로그인 메트릭
      cloudwatchMetrics.putMetric('SuccessfulLogins', 1, 'Count');
      
      // 의심스러운 활동 초기화
      this.suspiciousActivity.delete(`login_${userId}`);
    } else {
      logger.warn('Failed login attempt', logData);
      
      // 실패 로그인 메트릭
      cloudwatchMetrics.putMetric('FailedLogins', 1, 'Count');
      
      // 연속 실패 추적
      await this.trackFailedAttempts(userId, ip);
    }
  }

  // 연속 실패 로그인 추적
  async trackFailedAttempts(userId, ip) {
    const key = `login_${userId}`;
    const ipKey = `ip_${ip}`;
    
    // 사용자별 실패 카운트
    const userFailures = this.suspiciousActivity.get(key) || 0;
    this.suspiciousActivity.set(key, userFailures + 1);
    
    // IP별 실패 카운트
    const ipFailures = this.suspiciousActivity.get(ipKey) || 0;
    this.suspiciousActivity.set(ipKey, ipFailures + 1);
    
    // 임계값 확인
    if (userFailures >= 5) {
      await this.reportSuspiciousActivity('multiple_failed_logins_user', {
        userId,
        attempts: userFailures + 1
      });
    }
    
    if (ipFailures >= 10) {
      await this.reportSuspiciousActivity('multiple_failed_logins_ip', {
        ip,
        attempts: ipFailures + 1
      });
    }
  }

  // Band API 보안 모니터링
  async trackBandAPIAccess(userId, endpoint, success, context = {}) {
    const logData = {
      userId,
      endpoint,
      success,
      timestamp: Date.now(),
      ...context
    };

    if (success) {
      logger.info('Band API access', logData);
    } else {
      logger.warn('Band API access failed', logData);
      
      // Band API 실패 추적
      const key = `band_api_${userId}`;
      const failures = this.suspiciousActivity.get(key) || 0;
      this.suspiciousActivity.set(key, failures + 1);
      
      if (failures >= 3) {
        await this.reportSuspiciousActivity('band_api_repeated_failures', {
          userId,
          endpoint,
          attempts: failures + 1
        });
      }
    }
  }

  // Rate Limiting 모니터링
  async trackRateLimit(userId, endpoint, exceeded = false) {
    const key = `rate_limit_${userId}_${endpoint}`;
    
    if (exceeded) {
      logger.warn('Rate limit exceeded', { userId, endpoint });
      
      const violations = this.rateLimits.get(key) || 0;
      this.rateLimits.set(key, violations + 1);
      
      cloudwatchMetrics.putMetric('RateLimitViolations', 1, 'Count', [
        { Name: 'Endpoint', Value: endpoint }
      ]);
      
      if (violations >= 5) {
        await this.reportSuspiciousActivity('excessive_rate_limit_violations', {
          userId,
          endpoint,
          violations: violations + 1
        });
      }
    }
  }

  // 의심스러운 활동 보고
  async reportSuspiciousActivity(activityType, details) {
    logger.error('Suspicious activity detected', {
      activityType,
      details
    });

    // CloudWatch 메트릭
    cloudwatchMetrics.putMetric('SuspiciousActivity', 1, 'Count', [
      { Name: 'ActivityType', Value: activityType }
    ]);

    // 즉시 알림
    await alertService.sendErrorAlert(
      new Error(`Suspicious activity: ${activityType}`),
      details
    );

    // 추가 보안 조치가 필요한 경우
    if (this.requiresImmediateAction(activityType)) {
      await this.triggerSecurityResponse(activityType, details);
    }
  }

  // 즉시 대응이 필요한 활동 확인
  requiresImmediateAction(activityType) {
    const criticalActivities = [
      'multiple_failed_logins_ip',
      'excessive_rate_limit_violations',
      'potential_account_takeover'
    ];
    
    return criticalActivities.includes(activityType);
  }

  // 자동 보안 대응
  async triggerSecurityResponse(activityType, details) {
    logger.error('Triggering automatic security response', {
      activityType,
      details
    });

    // 구체적인 보안 대응 로직 구현
    // 예: IP 차단, 계정 임시 잠금, 추가 인증 요구 등
  }

  // 정기적 정리 작업
  cleanupOldData() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // 1시간 이상 된 의심스러운 활동 데이터 정리
    for (const [key, timestamp] of this.suspiciousActivity.entries()) {
      if (timestamp < oneHourAgo) {
        this.suspiciousActivity.delete(key);
      }
    }
    
    // Rate limit 데이터도 정리
    for (const [key, timestamp] of this.rateLimits.entries()) {
      if (timestamp < oneHourAgo) {
        this.rateLimits.delete(key);
      }
    }
  }
}

export const securityMonitoring = new SecurityMonitoringService();

// 1시간마다 정리 작업 실행
setInterval(() => {
  securityMonitoring.cleanupOldData();
}, 60 * 60 * 1000);
```

## 대시보드 및 시각화

### Grafana 대시보드 설정

#### 대시보드 JSON 설정
```json
{
  "dashboard": {
    "title": "DongBaeJul Monitoring Dashboard",
    "tags": ["dongbaejul", "monitoring"],
    "timezone": "Asia/Seoul",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "seconds",
            "min": 0
          }
        ]
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "Total RPS"
          },
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m]))",
            "legendFormat": "Error RPS"
          }
        ]
      },
      {
        "id": 3,
        "title": "Active Games",
        "type": "singlestat",
        "targets": [
          {
            "expr": "games_active_total",
            "legendFormat": "Active Games"
          }
        ]
      },
      {
        "id": 4,
        "title": "Daily Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "daily_active_users",
            "legendFormat": "DAU"
          }
        ]
      },
      {
        "id": 5,
        "title": "Band API Health",
        "type": "table",
        "targets": [
          {
            "expr": "band_api_calls_total",
            "format": "table",
            "legendFormat": "Band API Calls"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

이 모니터링 및 로깅 시스템을 통해 애플리케이션의 상태를 실시간으로 파악하고 문제를 신속하게 대응할 수 있습니다.