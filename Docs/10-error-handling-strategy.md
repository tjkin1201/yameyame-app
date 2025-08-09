# 에러 처리 및 예외 상황 대응 전략

## 🚨 에러 처리 전략 개요

동배즐 앱의 안정적인 운영을 위해 체계적인 에러 처리 및 예외 상황 대응 전략을 수립합니다. 특히 Naver Band API 연동, 실시간 채팅, 게임 관리 등 핵심 기능의 장애 상황에 대한 대응책을 제공합니다.

## 📊 에러 분류 체계

### 1. 에러 심각도 레벨
```javascript
const ErrorSeverity = {
  CRITICAL: 'critical',    // 서비스 전체 중단
  HIGH: 'high',           // 핵심 기능 장애
  MEDIUM: 'medium',       // 일부 기능 제한
  LOW: 'low',            // 사용자 경험 저하
  INFO: 'info'           // 정보성 로그
};

const ErrorCategory = {
  NETWORK: 'network',           // 네트워크 관련
  AUTH: 'authentication',       // 인증/권한 관련
  BAND_API: 'band_api',        // Band API 관련
  DATABASE: 'database',        // 데이터베이스 관련
  VALIDATION: 'validation',    // 입력값 검증
  BUSINESS_LOGIC: 'business',  // 비즈니스 로직
  SYSTEM: 'system'            // 시스템/인프라
};
```

### 2. 표준 에러 응답 구조
```javascript
// utils/errorResponse.js
class ErrorResponse {
  constructor(message, statusCode, errorCode, details = null) {
    this.success = false;
    this.error = {
      message,
      statusCode,
      errorCode,
      details,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    };
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static badRequest(message, details = null) {
    return new ErrorResponse(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = '인증이 필요합니다') {
    return new ErrorResponse(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = '권한이 없습니다') {
    return new ErrorResponse(message, 403, 'FORBIDDEN');
  }

  static notFound(message = '리소스를 찾을 수 없습니다') {
    return new ErrorResponse(message, 404, 'NOT_FOUND');
  }

  static conflict(message, details = null) {
    return new ErrorResponse(message, 409, 'CONFLICT', details);
  }

  static tooManyRequests(message = '요청 횟수를 초과했습니다') {
    return new ErrorResponse(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internalServer(message = '서버 내부 오류가 발생했습니다') {
    return new ErrorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }

  static serviceUnavailable(message = '서비스를 일시적으로 사용할 수 없습니다') {
    return new ErrorResponse(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

module.exports = ErrorResponse;
```

## 🔗 Band API 에러 처리

### 1. Band API 에러 래퍼
```javascript
// services/bandAPIErrorHandler.js
class BandAPIErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1초
    this.maxDelay = 30000; // 30초
  }

  async executeWithRetry(apiCall, context = {}) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (!shouldRetry) {
          break;
        }

        const delay = this.calculateDelay(attempt, error);
        
        logger.warn(`Band API 재시도 ${attempt}/${this.maxRetries}`, {
          error: error.message,
          context,
          delay,
          attempt
        });

        await this.sleep(delay);
      }
    }

    throw this.createBandAPIError(lastError, context);
  }

  shouldRetry(error, attempt) {
    // 최대 재시도 횟수 체크
    if (attempt >= this.maxRetries) {
      return false;
    }

    // HTTP 상태 코드 기반 재시도 판단
    const status = error.response?.status;
    
    switch (status) {
      case 429: // Rate Limit - 항상 재시도
        return true;
      case 500: // Internal Server Error
      case 502: // Bad Gateway
      case 503: // Service Unavailable
      case 504: // Gateway Timeout
        return true;
      case 400: // Bad Request - 재시도 하지 않음
      case 401: // Unauthorized
      case 403: // Forbidden
      case 404: // Not Found
        return false;
      default:
        // 네트워크 에러인 경우 재시도
        return error.code === 'ECONNRESET' || 
               error.code === 'ENOTFOUND' ||
               error.code === 'ECONNREFUSED' ||
               error.code === 'ETIMEDOUT';
    }
  }

  calculateDelay(attempt, error) {
    // Rate Limit인 경우 Retry-After 헤더 확인
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // 초를 밀리초로 변환
      }
    }

    // 지수 백오프 (Exponential Backoff with Jitter)
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% 지터
    
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  createBandAPIError(originalError, context) {
    const status = originalError.response?.status;
    const bandErrorCode = originalError.response?.data?.error?.code;
    
    let errorMessage = 'Band API 호출 중 오류가 발생했습니다';
    let statusCode = 500;

    switch (status) {
      case 401:
        errorMessage = 'Band 인증이 만료되었습니다. 다시 로그인해주세요';
        statusCode = 401;
        break;
      case 403:
        errorMessage = 'Band 접근 권한이 없습니다';
        statusCode = 403;
        break;
      case 404:
        errorMessage = '요청한 Band 리소스를 찾을 수 없습니다';
        statusCode = 404;
        break;
      case 429:
        errorMessage = 'Band API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요';
        statusCode = 429;
        break;
      case 500:
      case 502:
      case 503:
        errorMessage = 'Band 서비스에 일시적인 문제가 발생했습니다';
        statusCode = 503;
        break;
    }

    const error = new Error(errorMessage);
    error.statusCode = statusCode;
    error.bandErrorCode = bandErrorCode;
    error.originalError = originalError;
    error.context = context;
    
    return error;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new BandAPIErrorHandler();
```

### 2. Band API 호출 래퍼 사용 예시
```javascript
// services/bandAPI.js
class BandAPI {
  constructor() {
    this.errorHandler = require('./bandAPIErrorHandler');
    this.baseURL = 'https://openapi.band.us/v2';
  }

  async getMembers(bandKey) {
    return await this.errorHandler.executeWithRetry(
      async () => {
        const response = await fetch(
          `${this.baseURL}/bands/${bandKey}/members`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      },
      { 
        operation: 'getMembers', 
        bandKey,
        userId: this.currentUserId 
      }
    );
  }

  async syncMembers(bandKey) {
    try {
      const members = await this.getMembers(bandKey);
      return await this.processMemberSync(members);
    } catch (error) {
      // 동기화 실패 시 캐시된 데이터 사용
      logger.error('멤버 동기화 실패, 캐시 데이터 사용', { error: error.message });
      return await this.getCachedMembers(bandKey);
    }
  }
}
```

## 🌐 네트워크 에러 처리

### 1. 네트워크 상태 감지 및 처리
```javascript
// utils/networkHandler.js
import NetInfo from '@react-native-async-storage/async-storage';

class NetworkHandler {
  constructor() {
    this.isConnected = true;
    this.connectionType = 'unknown';
    this.listeners = new Set();
    this.retryQueue = [];
    
    this.setupNetworkMonitoring();
  }

  setupNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected;
      this.connectionType = state.type;

      if (!wasConnected && this.isConnected) {
        // 네트워크 복구됨
        this.handleNetworkRecovery();
      } else if (wasConnected && !this.isConnected) {
        // 네트워크 연결 끊김
        this.handleNetworkLoss();
      }

      // 리스너들에게 알림
      this.notifyListeners(state);
    });
  }

  handleNetworkRecovery() {
    logger.info('네트워크 연결 복구됨');
    
    // 대기 중인 요청들 재시도
    this.processRetryQueue();
    
    // 사용자에게 알림
    this.showNetworkNotification('네트워크가 복구되었습니다', 'success');
  }

  handleNetworkLoss() {
    logger.warn('네트워크 연결 끊김');
    
    // 사용자에게 알림
    this.showNetworkNotification(
      '네트워크 연결이 끊어졌습니다. 오프라인 모드로 전환됩니다',
      'warning'
    );
  }

  async processRetryQueue() {
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const request of queue) {
      try {
        await request.retry();
        logger.info('네트워크 복구 후 요청 재시도 성공', { 
          url: request.url,
          id: request.id 
        });
      } catch (error) {
        logger.error('네트워크 복구 후 요청 재시도 실패', { 
          error: error.message,
          url: request.url,
          id: request.id 
        });
        
        // 재시도 실패 시 다시 큐에 추가 (최대 3회)
        if (request.retryCount < 3) {
          request.retryCount++;
          this.retryQueue.push(request);
        }
      }
    }
  }

  addToRetryQueue(request) {
    if (!this.isConnected) {
      this.retryQueue.push({
        ...request,
        retryCount: 0,
        addedAt: Date.now()
      });
    }
  }

  // 네트워크 상태 변경 리스너 등록
  addListener(callback) {
    this.listeners.add(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(networkState) {
    this.listeners.forEach(callback => {
      try {
        callback(networkState);
      } catch (error) {
        logger.error('네트워크 리스너 실행 중 오류', { error: error.message });
      }
    });
  }

  showNetworkNotification(message, type) {
    // React Native에서 알림 표시
    if (global.showNotification) {
      global.showNotification(message, type);
    }
  }
}

export default new NetworkHandler();
```

### 2. API 호출 시 네트워크 에러 처리
```javascript
// services/apiClient.js
class APIClient {
  constructor() {
    this.baseURL = process.env.API_BASE_URL;
    this.timeout = 30000; // 30초
    this.networkHandler = require('../utils/networkHandler');
  }

  async request(endpoint, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      // 네트워크 연결 확인
      if (!this.networkHandler.isConnected) {
        throw new NetworkError('네트워크 연결이 없습니다', 'NO_CONNECTION');
      }

      const response = await this.executeRequest(endpoint, options, requestId);
      return this.handleResponse(response);
      
    } catch (error) {
      return this.handleError(error, endpoint, options, requestId);
    }
  }

  async executeRequest(endpoint, options, requestId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async handleError(error, endpoint, options, requestId) {
    logger.error('API 요청 실패', {
      error: error.message,
      endpoint,
      requestId,
      networkConnected: this.networkHandler.isConnected
    });

    // 네트워크 에러 처리
    if (this.isNetworkError(error)) {
      // 재시도 큐에 추가
      this.networkHandler.addToRetryQueue({
        id: requestId,
        url: endpoint,
        retry: () => this.request(endpoint, options)
      });

      throw new NetworkError(
        '네트워크 연결을 확인해주세요',
        'NETWORK_ERROR',
        { originalError: error }
      );
    }

    // 서버 에러 처리
    if (this.isServerError(error)) {
      throw new ServerError(
        '서버에 일시적인 문제가 발생했습니다',
        'SERVER_ERROR',
        { statusCode: error.status }
      );
    }

    throw error;
  }

  isNetworkError(error) {
    return error.name === 'AbortError' ||
           error.code === 'NETWORK_REQUEST_FAILED' ||
           error.message.includes('Network request failed') ||
           error.message.includes('Unable to resolve host');
  }

  isServerError(error) {
    return error.status >= 500 && error.status < 600;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 커스텀 에러 클래스
class NetworkError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
    this.details = details;
  }
}

class ServerError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ServerError';
    this.code = code;
    this.details = details;
  }
}

export default APIClient;
```

## 💾 데이터베이스 에러 처리

### 1. MongoDB 연결 에러 처리
```javascript
// database/mongoErrorHandler.js
class MongoErrorHandler {
  static handleError(error, operation) {
    logger.error('MongoDB 에러 발생', {
      error: error.message,
      operation,
      code: error.code,
      stack: error.stack
    });

    switch (error.name) {
      case 'MongoNetworkError':
        return this.handleNetworkError(error);
      
      case 'MongoTimeoutError':
        return this.handleTimeoutError(error);
      
      case 'MongoWriteConcernError':
        return this.handleWriteConcernError(error);
      
      case 'MongoBulkWriteError':
        return this.handleBulkWriteError(error);
      
      case 'ValidationError':
        return this.handleValidationError(error);
      
      default:
        if (error.code) {
          return this.handleByErrorCode(error);
        }
        return this.handleGenericError(error);
    }
  }

  static handleNetworkError(error) {
    return {
      message: '데이터베이스 연결에 문제가 발생했습니다',
      statusCode: 503,
      errorCode: 'DATABASE_CONNECTION_ERROR',
      retry: true,
      userMessage: '일시적인 연결 문제입니다. 잠시 후 다시 시도해주세요'
    };
  }

  static handleTimeoutError(error) {
    return {
      message: '데이터베이스 응답 시간이 초과되었습니다',
      statusCode: 504,
      errorCode: 'DATABASE_TIMEOUT',
      retry: true,
      userMessage: '요청 처리 시간이 초과되었습니다. 다시 시도해주세요'
    };
  }

  static handleValidationError(error) {
    const validationErrors = Object.keys(error.errors).map(key => ({
      field: key,
      message: error.errors[key].message
    }));

    return {
      message: '입력 데이터 검증에 실패했습니다',
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      retry: false,
      details: validationErrors,
      userMessage: '입력한 정보를 다시 확인해주세요'
    };
  }

  static handleByErrorCode(error) {
    switch (error.code) {
      case 11000: // Duplicate key
        return {
          message: '중복된 데이터가 존재합니다',
          statusCode: 409,
          errorCode: 'DUPLICATE_KEY',
          retry: false,
          userMessage: '이미 등록된 정보입니다'
        };
      
      case 16500: // Request rate too large
        return {
          message: '요청이 너무 많습니다',
          statusCode: 429,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retry: true,
          userMessage: '잠시 후 다시 시도해주세요'
        };
      
      default:
        return this.handleGenericError(error);
    }
  }

  static handleGenericError(error) {
    return {
      message: '데이터베이스 처리 중 오류가 발생했습니다',
      statusCode: 500,
      errorCode: 'DATABASE_ERROR',
      retry: false,
      userMessage: '일시적인 문제가 발생했습니다. 계속 문제가 발생하면 관리자에게 문의해주세요'
    };
  }
}

module.exports = MongoErrorHandler;
```

## ⚡ 실시간 채팅 에러 처리

### 1. Socket.io 연결 에러 처리
```javascript
// services/chatErrorHandler.js
class ChatErrorHandler {
  constructor() {
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageQueue = [];
  }

  handleSocketError(error, context = {}) {
    logger.error('Socket 에러 발생', {
      error: error.message,
      context,
      type: error.type
    });

    switch (error.type) {
      case 'TransportError':
        return this.handleTransportError(error);
      
      case 'ConnectionError':
        return this.handleConnectionError(error);
      
      case 'AuthenticationError':
        return this.handleAuthError(error);
      
      default:
        return this.handleGenericSocketError(error);
    }
  }

  handleConnectionError(error) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnection();
    } else {
      this.showConnectionFailedMessage();
    }
  }

  attemptReconnection() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Socket 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
      delay
    });

    setTimeout(() => {
      if (global.socketInstance) {
        global.socketInstance.connect();
      }
    }, delay);
  }

  handleMessageSendError(message, error) {
    logger.error('메시지 전송 실패', {
      messageId: message.tempId,
      error: error.message
    });

    // 메시지를 큐에 저장하여 연결 복구 시 재전송
    this.messageQueue.push({
      ...message,
      retryCount: 0,
      failedAt: Date.now()
    });

    // 사용자에게 전송 실패 알림
    this.notifyMessageFailed(message.tempId);
  }

  onConnectionRecovered() {
    logger.info('Socket 연결 복구됨');
    this.reconnectAttempts = 0;
    
    // 대기 중인 메시지들 재전송
    this.resendQueuedMessages();
    
    // 사용자에게 연결 복구 알림
    this.notifyConnectionRecovered();
  }

  async resendQueuedMessages() {
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of queue) {
      try {
        await this.resendMessage(message);
        logger.info('큐에서 메시지 재전송 성공', { 
          messageId: message.tempId 
        });
      } catch (error) {
        logger.error('큐에서 메시지 재전송 실패', { 
          messageId: message.tempId,
          error: error.message 
        });
        
        // 재시도 횟수 확인 후 다시 큐에 추가
        if (message.retryCount < 3) {
          message.retryCount++;
          this.messageQueue.push(message);
        } else {
          // 최대 재시도 횟수 초과 시 사용자에게 알림
          this.notifyMessagePermanentlyFailed(message.tempId);
        }
      }
    }
  }

  showConnectionFailedMessage() {
    global.showNotification && global.showNotification(
      '채팅 서버에 연결할 수 없습니다. 네트워크 연결을 확인하고 앱을 다시 시작해주세요',
      'error'
    );
  }

  notifyConnectionRecovered() {
    global.showNotification && global.showNotification(
      '채팅 연결이 복구되었습니다',
      'success'
    );
  }

  notifyMessageFailed(messageId) {
    // Redux나 Context를 통해 UI에 메시지 전송 실패 상태 알림
    global.updateMessageStatus && global.updateMessageStatus(messageId, 'failed');
  }

  notifyMessagePermanentlyFailed(messageId) {
    global.updateMessageStatus && global.updateMessageStatus(messageId, 'permanently_failed');
    
    global.showNotification && global.showNotification(
      '메시지 전송에 실패했습니다',
      'error'
    );
  }
}

module.exports = new ChatErrorHandler();
```

## 🔐 인증 에러 처리

### 1. JWT 토큰 에러 처리
```javascript
// middleware/authErrorHandler.js
class AuthErrorHandler {
  static async handleAuthError(error, req, res, next) {
    logger.error('인증 에러 발생', {
      error: error.message,
      url: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    switch (error.name) {
      case 'TokenExpiredError':
        return this.handleTokenExpired(res, error);
      
      case 'JsonWebTokenError':
        return this.handleInvalidToken(res, error);
      
      case 'NotBeforeError':
        return this.handleTokenNotActive(res, error);
      
      default:
        return this.handleGenericAuthError(res, error);
    }
  }

  static handleTokenExpired(res, error) {
    return res.status(401).json({
      success: false,
      error: {
        message: '토큰이 만료되었습니다',
        statusCode: 401,
        errorCode: 'TOKEN_EXPIRED',
        action: 'REFRESH_TOKEN'
      }
    });
  }

  static handleInvalidToken(res, error) {
    return res.status(401).json({
      success: false,
      error: {
        message: '유효하지 않은 토큰입니다',
        statusCode: 401,
        errorCode: 'INVALID_TOKEN',
        action: 'RELOGIN'
      }
    });
  }

  static handleTokenNotActive(res, error) {
    return res.status(401).json({
      success: false,
      error: {
        message: '토큰이 아직 활성화되지 않았습니다',
        statusCode: 401,
        errorCode: 'TOKEN_NOT_ACTIVE',
        action: 'WAIT_OR_RELOGIN'
      }
    });
  }

  // 클라이언트 측 토큰 자동 갱신
  static async handleTokenRefresh(refreshToken) {
    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken
      });

      const { access_token } = response.data;
      
      // 새 토큰 저장
      await SecureStore.setItemAsync('access_token', access_token);
      
      return access_token;
    } catch (error) {
      // 리프레시 토큰도 만료된 경우
      if (error.response?.status === 401) {
        await this.handleLogout();
        throw new Error('RELOGIN_REQUIRED');
      }
      
      throw error;
    }
  }

  static async handleLogout() {
    // 토큰들 삭제
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    
    // 로그인 화면으로 이동
    global.navigateToLogin && global.navigateToLogin();
  }
}

module.exports = AuthErrorHandler;
```

## 📱 클라이언트 측 에러 처리

### 1. 글로벌 에러 바운더리
```javascript
// components/ErrorBoundary.js
import React from 'react';
import { View, Text, Button } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 에러를 Crashlytics로 전송
    crashlytics().recordError(error);
    
    // 로깅
    console.error('ErrorBoundary에서 에러 캐치:', error, errorInfo);
    
    // 에러 정보를 서버로 전송
    this.reportErrorToServer(error, errorInfo);
  }

  reportErrorToServer = async (error, errorInfo) => {
    try {
      await fetch('/api/v1/errors/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: error.toString(),
          errorInfo: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          userId: global.currentUserId
        })
      });
    } catch (reportError) {
      console.error('에러 리포트 전송 실패:', reportError);
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>앱에 오류가 발생했습니다</Text>
          <Text style={styles.errorMessage}>
            일시적인 문제일 수 있습니다. 다시 시도해보세요.
          </Text>
          
          <Button
            title="다시 시도"
            onPress={this.handleRetry}
          />
          
          <Button
            title="앱 다시 시작"
            onPress={() => {
              // 앱 재시작 로직
              global.restartApp && global.restartApp();
            }}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 2. 에러 알림 시스템
```javascript
// utils/errorNotification.js
import Toast from 'react-native-toast-message';

class ErrorNotificationManager {
  static showError(error, options = {}) {
    const {
      title = '오류 발생',
      duration = 4000,
      action = null
    } = options;

    let message = '알 수 없는 오류가 발생했습니다';

    // 에러 타입별 메시지 처리
    if (error.code === 'NETWORK_ERROR') {
      message = '네트워크 연결을 확인해주세요';
    } else if (error.code === 'TOKEN_EXPIRED') {
      message = '로그인이 만료되었습니다. 다시 로그인해주세요';
    } else if (error.code === 'BAND_API_ERROR') {
      message = 'Band 서비스 연결에 문제가 발생했습니다';
    } else if (error.message) {
      message = error.message;
    }

    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      visibilityTime: duration,
      onPress: action
    });
  }

  static showSuccess(message, options = {}) {
    const { duration = 3000 } = options;

    Toast.show({
      type: 'success',
      text1: '성공',
      text2: message,
      visibilityTime: duration
    });
  }

  static showWarning(message, options = {}) {
    const { duration = 4000, action = null } = options;

    Toast.show({
      type: 'warning',
      text1: '주의',
      text2: message,
      visibilityTime: duration,
      onPress: action
    });
  }

  static showInfo(message, options = {}) {
    const { duration = 3000 } = options;

    Toast.show({
      type: 'info',
      text1: '알림',
      text2: message,
      visibilityTime: duration
    });
  }
}

export default ErrorNotificationManager;
```

## 🔄 복구 전략

### 1. 자동 복구 시스템
```javascript
// utils/recoveryManager.js
class RecoveryManager {
  constructor() {
    this.recoveryStrategies = new Map();
    this.setupDefaultStrategies();
  }

  setupDefaultStrategies() {
    // Band API 복구 전략
    this.recoveryStrategies.set('BAND_API_ERROR', {
      maxAttempts: 3,
      delay: 2000,
      strategy: async (context) => {
        // 토큰 갱신 시도
        await this.refreshBandToken();
        // 캐시된 데이터 사용
        return await this.useCachedData(context.dataType);
      }
    });

    // 네트워크 복구 전략
    this.recoveryStrategies.set('NETWORK_ERROR', {
      maxAttempts: 5,
      delay: 1000,
      strategy: async (context) => {
        // 네트워크 연결 대기
        await this.waitForNetwork();
        // 대기 중인 요청들 재실행
        return await this.retryQueuedRequests();
      }
    });

    // 데이터베이스 복구 전략
    this.recoveryStrategies.set('DATABASE_ERROR', {
      maxAttempts: 3,
      delay: 5000,
      strategy: async (context) => {
        // 읽기 전용 모드로 전환
        await this.switchToReadOnlyMode();
        // 백업 데이터베이스 사용
        return await this.useBackupDatabase();
      }
    });
  }

  async attemptRecovery(errorCode, context = {}) {
    const strategy = this.recoveryStrategies.get(errorCode);
    
    if (!strategy) {
      logger.warn('복구 전략이 없는 에러', { errorCode });
      return false;
    }

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        logger.info(`복구 시도 ${attempt}/${strategy.maxAttempts}`, { 
          errorCode, 
          context 
        });

        await strategy.strategy(context);
        
        logger.info('복구 성공', { errorCode, attempt });
        return true;
        
      } catch (error) {
        logger.error(`복구 시도 ${attempt} 실패`, { 
          errorCode, 
          error: error.message 
        });

        if (attempt < strategy.maxAttempts) {
          await this.sleep(strategy.delay * attempt);
        }
      }
    }

    logger.error('모든 복구 시도 실패', { errorCode });
    return false;
  }

  async refreshBandToken() {
    // Band 토큰 갱신 로직
    const refreshToken = await SecureStore.getItemAsync('band_refresh_token');
    if (refreshToken) {
      const newTokens = await bandAPI.refreshToken(refreshToken);
      await this.saveNewTokens(newTokens);
    }
  }

  async useCachedData(dataType) {
    // 캐시된 데이터 사용 로직
    const cachedData = await AsyncStorage.getItem(`cached_${dataType}`);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    throw new Error('캐시된 데이터가 없습니다');
  }

  async waitForNetwork() {
    return new Promise((resolve) => {
      const checkNetwork = () => {
        if (NetworkHandler.isConnected) {
          resolve();
        } else {
          setTimeout(checkNetwork, 1000);
        }
      };
      checkNetwork();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new RecoveryManager();
```

### 2. 사용자 알림 및 안내
```javascript
// components/ErrorRecoveryModal.js
const ErrorRecoveryModal = ({ visible, error, onRetry, onCancel }) => {
  const getRecoveryMessage = (errorCode) => {
    switch (errorCode) {
      case 'BAND_API_ERROR':
        return {
          title: 'Band 연동 오류',
          message: 'Band 서비스와의 연결에 문제가 있습니다. 자동으로 복구를 시도하고 있습니다.',
          canRetry: true
        };
      
      case 'NETWORK_ERROR':
        return {
          title: '네트워크 연결 오류',
          message: '인터넷 연결을 확인하고 다시 시도해주세요.',
          canRetry: true
        };
      
      case 'SERVER_ERROR':
        return {
          title: '서버 오류',
          message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
          canRetry: true
        };
      
      default:
        return {
          title: '오류 발생',
          message: '예상치 못한 오류가 발생했습니다.',
          canRetry: false
        };
    }
  };

  const recoveryInfo = getRecoveryMessage(error?.code);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Icon name="alert-circle" size={48} color="#FF6B6B" />
          
          <Text style={styles.title}>{recoveryInfo.title}</Text>
          <Text style={styles.message}>{recoveryInfo.message}</Text>
          
          <View style={styles.buttons}>
            {recoveryInfo.canRetry && (
              <Button
                title="다시 시도"
                onPress={onRetry}
                style={styles.retryButton}
              />
            )}
            
            <Button
              title="확인"
              onPress={onCancel}
              style={styles.cancelButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ErrorRecoveryModal;
```

이 에러 처리 전략을 통해 다양한 예외 상황에서도 안정적인 서비스를 제공할 수 있으며, 사용자 경험을 최대한 보장할 수 있습니다. 특히 Band API 연동, 네트워크 불안정, 서버 장애 등의 상황에서 자동 복구 및 적절한 사용자 안내를 제공합니다.