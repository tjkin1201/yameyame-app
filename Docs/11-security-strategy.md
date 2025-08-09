# 보안 및 JWT 토큰 관리 전략

## 🔒 보안 전략 개요

동배즐 앱의 보안은 다층 방어(Defense in Depth) 원칙을 기반으로 설계되었습니다. Naver Band 연동, 개인정보 보호, API 보안, 클라이언트 보안을 포괄하는 종합적인 보안 체계를 구축합니다.

## 🔐 JWT 토큰 관리 전략

### 1. 토큰 구조 설계
```javascript
// JWT Payload 구조
const accessTokenPayload = {
  // 사용자 식별 정보
  user_id: "ObjectId",
  band_user_id: "string",
  
  // 권한 정보
  role: "admin|member",
  permissions: ["write_posts", "manage_games", ...],
  
  // 메타데이터
  iat: 1234567890,    // 발급 시간
  exp: 1234567890,    // 만료 시간
  aud: "dongbaejul",  // 대상 서비스
  iss: "dongbaejul-auth", // 발급자
  sub: "user_authentication", // 주제
  
  // 세션 정보
  session_id: "unique_session_id",
  device_id: "device_fingerprint",
  
  // Band 연동 정보 (선택적)
  band_token_expires: 1234567890
};

const refreshTokenPayload = {
  user_id: "ObjectId",
  type: "refresh",
  session_id: "unique_session_id",
  iat: 1234567890,
  exp: 1234567890,    // 30일 후 만료
  jti: "unique_refresh_token_id" // 토큰 무효화용 ID
};
```

### 2. 토큰 생명주기 관리
```javascript
// services/tokenManager.js
class TokenManager {
  constructor() {
    this.accessTokenExpiry = '1h';      // Access Token: 1시간
    this.refreshTokenExpiry = '30d';    // Refresh Token: 30일
    this.maxActiveSessions = 3;         // 사용자당 최대 동시 세션
    this.blacklistedTokens = new Set(); // 무효화된 토큰 목록
  }

  // JWT 토큰 생성
  generateTokenPair(user, deviceInfo = {}) {
    const sessionId = this.generateSessionId();
    
    const accessTokenPayload = {
      user_id: user._id,
      band_user_id: user.band_user_id,
      role: user.role,
      permissions: user.permissions,
      session_id: sessionId,
      device_id: deviceInfo.device_id || 'unknown',
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshTokenPayload = {
      user_id: user._id,
      type: 'refresh',
      session_id: sessionId,
      jti: this.generateJTI(),
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_ACCESS_SECRET,
      { 
        expiresIn: this.accessTokenExpiry,
        algorithm: 'HS256',
        audience: 'dongbaejul',
        issuer: 'dongbaejul-auth'
      }
    );

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: this.refreshTokenExpiry,
        algorithm: 'HS256'
      }
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_id: sessionId,
      expires_in: 3600, // 1시간 (초 단위)
      token_type: 'Bearer'
    };
  }

  // Access Token 갱신
  async refreshAccessToken(refreshToken) {
    try {
      // Refresh Token 검증
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // 토큰이 블랙리스트에 있는지 확인
      if (this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Refresh token has been revoked');
      }

      // 사용자 정보 조회
      const user = await UserModel.findById(decoded.user_id);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      // 세션 검증
      const session = await this.getSession(decoded.session_id);
      if (!session || session.status !== 'active') {
        throw new Error('Session not found or expired');
      }

      // 새 Access Token 생성 (같은 세션 ID 유지)
      const accessTokenPayload = {
        user_id: user._id,
        band_user_id: user.band_user_id,
        role: user.role,
        permissions: user.permissions,
        session_id: decoded.session_id,
        device_id: session.device_id,
        iat: Math.floor(Date.now() / 1000)
      };

      const newAccessToken = jwt.sign(
        accessTokenPayload,
        process.env.JWT_ACCESS_SECRET,
        { 
          expiresIn: this.accessTokenExpiry,
          algorithm: 'HS256'
        }
      );

      // 세션 마지막 활동 시간 업데이트
      await this.updateSessionActivity(decoded.session_id);

      return {
        access_token: newAccessToken,
        expires_in: 3600,
        token_type: 'Bearer'
      };

    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // 토큰 무효화
  async revokeToken(token, type = 'access') {
    try {
      const secret = type === 'access' 
        ? process.env.JWT_ACCESS_SECRET 
        : process.env.JWT_REFRESH_SECRET;
        
      const decoded = jwt.verify(token, secret);

      if (type === 'refresh') {
        // Refresh Token을 블랙리스트에 추가
        this.blacklistedTokens.add(decoded.jti);
        
        // 데이터베이스에도 저장
        await this.saveBlacklistedToken(decoded.jti, decoded.exp);
      }

      // 해당 세션 무효화
      if (decoded.session_id) {
        await this.revokeSession(decoded.session_id);
      }

      return true;
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  // 사용자의 모든 세션 무효화
  async revokeAllUserSessions(userId) {
    try {
      const sessions = await SessionModel.find({ 
        user_id: userId, 
        status: 'active' 
      });

      for (const session of sessions) {
        await this.revokeSession(session.session_id);
      }

      return sessions.length;
    } catch (error) {
      throw new Error(`Session revocation failed: ${error.message}`);
    }
  }

  // 세션 관리
  async createSession(userId, deviceInfo, tokenPair) {
    const session = new SessionModel({
      session_id: tokenPair.session_id,
      user_id: userId,
      device_info: {
        device_id: deviceInfo.device_id,
        platform: deviceInfo.platform,
        app_version: deviceInfo.app_version,
        device_name: deviceInfo.device_name
      },
      ip_address: deviceInfo.ip_address,
      user_agent: deviceInfo.user_agent,
      refresh_token_jti: this.extractJTI(tokenPair.refresh_token),
      created_at: new Date(),
      last_activity: new Date(),
      status: 'active'
    });

    await session.save();

    // 최대 세션 수 초과 시 오래된 세션 제거
    await this.cleanupOldSessions(userId);

    return session;
  }

  async cleanupOldSessions(userId) {
    const sessions = await SessionModel.find({ 
      user_id: userId, 
      status: 'active' 
    }).sort({ last_activity: -1 });

    if (sessions.length > this.maxActiveSessions) {
      const sessionsToRemove = sessions.slice(this.maxActiveSessions);
      
      for (const session of sessionsToRemove) {
        await this.revokeSession(session.session_id);
      }
    }
  }

  // 보안 유틸리티
  generateSessionId() {
    return `sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateJTI() {
    return `jti_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  isTokenBlacklisted(jti) {
    return this.blacklistedTokens.has(jti);
  }

  // 토큰 보안 검증
  async validateTokenSecurity(token, req) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      // 세션 검증
      const session = await this.getSession(decoded.session_id);
      if (!session) {
        throw new Error('Session not found');
      }

      // IP 주소 검증 (선택적, 설정에 따라)
      if (process.env.VALIDATE_IP === 'true') {
        if (session.ip_address !== req.ip) {
          logger.warn('IP address mismatch detected', {
            session_ip: session.ip_address,
            request_ip: req.ip,
            user_id: decoded.user_id
          });
          
          // 의심스러운 활동으로 기록
          await this.logSuspiciousActivity(decoded.user_id, 'IP_MISMATCH', {
            session_ip: session.ip_address,
            request_ip: req.ip
          });
        }
      }

      // Device ID 검증
      if (decoded.device_id !== 'unknown' && 
          session.device_info.device_id !== decoded.device_id) {
        throw new Error('Device mismatch detected');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }
}

module.exports = new TokenManager();
```

### 3. 클라이언트 토큰 저장 및 관리
```javascript
// utils/secureTokenStorage.js
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

class SecureTokenStorage {
  constructor() {
    this.keyPrefix = 'dongbaejul_';
    this.encryptionKey = null;
  }

  // 암호화 키 초기화
  async initializeEncryption() {
    let key = await SecureStore.getItemAsync(`${this.keyPrefix}encryption_key`);
    
    if (!key) {
      // 새 암호화 키 생성
      key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Date.now()}_${Math.random().toString(36)}`
      );
      
      await SecureStore.setItemAsync(`${this.keyPrefix}encryption_key`, key);
    }
    
    this.encryptionKey = key;
  }

  // 토큰 저장
  async storeTokens(tokens) {
    try {
      await this.initializeEncryption();

      // Access Token 저장 (메모리 + SecureStore)
      global.accessToken = tokens.access_token;
      await SecureStore.setItemAsync(
        `${this.keyPrefix}access_token`,
        await this.encrypt(tokens.access_token)
      );

      // Refresh Token 저장 (SecureStore만)
      await SecureStore.setItemAsync(
        `${this.keyPrefix}refresh_token`,
        await this.encrypt(tokens.refresh_token)
      );

      // 토큰 메타데이터 저장
      const metadata = {
        expires_at: Date.now() + (tokens.expires_in * 1000),
        session_id: tokens.session_id,
        stored_at: Date.now()
      };

      await SecureStore.setItemAsync(
        `${this.keyPrefix}token_metadata`,
        JSON.stringify(metadata)
      );

      return true;
    } catch (error) {
      logger.error('토큰 저장 실패:', error);
      throw new Error('Failed to store tokens securely');
    }
  }

  // Access Token 조회
  async getAccessToken() {
    try {
      // 메모리에서 먼저 확인
      if (global.accessToken) {
        const isValid = await this.validateTokenExpiry();
        if (isValid) {
          return global.accessToken;
        }
      }

      // SecureStore에서 조회
      const encryptedToken = await SecureStore.getItemAsync(`${this.keyPrefix}access_token`);
      if (!encryptedToken) {
        return null;
      }

      const token = await this.decrypt(encryptedToken);
      
      // 토큰 만료 검증
      const isValid = await this.validateTokenExpiry();
      if (!isValid) {
        await this.refreshToken();
        return await this.getAccessToken();
      }

      global.accessToken = token;
      return token;
    } catch (error) {
      logger.error('Access Token 조회 실패:', error);
      return null;
    }
  }

  // Refresh Token 조회
  async getRefreshToken() {
    try {
      const encryptedToken = await SecureStore.getItemAsync(`${this.keyPrefix}refresh_token`);
      if (!encryptedToken) {
        return null;
      }

      return await this.decrypt(encryptedToken);
    } catch (error) {
      logger.error('Refresh Token 조회 실패:', error);
      return null;
    }
  }

  // 토큰 갱신
  async refreshToken() {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens = await response.json();
      
      // 새 토큰 저장
      await this.storeTokens({
        ...newTokens,
        refresh_token: refreshToken // 기존 refresh token 유지
      });

      return newTokens.access_token;
    } catch (error) {
      logger.error('토큰 갱신 실패:', error);
      await this.clearTokens();
      throw error;
    }
  }

  // 토큰 만료 검증
  async validateTokenExpiry() {
    try {
      const metadataStr = await SecureStore.getItemAsync(`${this.keyPrefix}token_metadata`);
      if (!metadataStr) {
        return false;
      }

      const metadata = JSON.parse(metadataStr);
      const now = Date.now();
      
      // 만료 5분 전에 갱신 필요로 표시
      const bufferTime = 5 * 60 * 1000; // 5분
      return (metadata.expires_at - bufferTime) > now;
    } catch (error) {
      return false;
    }
  }

  // 토큰 삭제
  async clearTokens() {
    try {
      global.accessToken = null;
      
      await Promise.all([
        SecureStore.deleteItemAsync(`${this.keyPrefix}access_token`),
        SecureStore.deleteItemAsync(`${this.keyPrefix}refresh_token`),
        SecureStore.deleteItemAsync(`${this.keyPrefix}token_metadata`)
      ]);

      return true;
    } catch (error) {
      logger.error('토큰 삭제 실패:', error);
      return false;
    }
  }

  // 암호화/복호화 (간단한 XOR 방식, 실제로는 더 강력한 암호화 사용)
  async encrypt(text) {
    // 실제 구현에서는 AES 등 강력한 암호화 사용
    return btoa(text);
  }

  async decrypt(encryptedText) {
    // 실제 구현에서는 AES 등 강력한 암호화 사용
    return atob(encryptedText);
  }
}

export default new SecureTokenStorage();
```

## 🛡️ API 보안 강화

### 1. 인증 미들웨어
```javascript
// middleware/authentication.js
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

class AuthenticationMiddleware {
  // JWT 토큰 검증 미들웨어
  static authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: '인증 토큰이 필요합니다',
          errorCode: 'MISSING_TOKEN'
        }
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      // 토큰 보안 검증
      TokenManager.validateTokenSecurity(token, req)
        .then(validatedDecoded => {
          req.user = validatedDecoded;
          req.session_id = validatedDecoded.session_id;
          next();
        })
        .catch(error => {
          res.status(401).json({
            success: false,
            error: {
              message: '토큰 검증에 실패했습니다',
              errorCode: 'TOKEN_VALIDATION_FAILED',
              details: error.message
            }
          });
        });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            message: '토큰이 만료되었습니다',
            errorCode: 'TOKEN_EXPIRED',
            action: 'REFRESH_TOKEN'
          }
        });
      }

      return res.status(403).json({
        success: false,
        error: {
          message: '유효하지 않은 토큰입니다',
          errorCode: 'INVALID_TOKEN'
        }
      });
    }
  }

  // 권한 검증 미들웨어
  static requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: '인증이 필요합니다',
            errorCode: 'AUTHENTICATION_REQUIRED'
          }
        });
      }

      if (!req.user.permissions || !req.user.permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: {
            message: '권한이 부족합니다',
            errorCode: 'INSUFFICIENT_PERMISSIONS',
            required_permission: permission
          }
        });
      }

      next();
    };
  }

  // 관리자 권한 검증
  static requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: '관리자 권한이 필요합니다',
          errorCode: 'ADMIN_REQUIRED'
        }
      });
    }
    next();
  }

  // Rate Limiting (인증 관련)
  static authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // 15분 동안 최대 5회 로그인 시도
    message: {
      success: false,
      error: {
        message: '로그인 시도 횟수를 초과했습니다',
        errorCode: 'TOO_MANY_AUTH_ATTEMPTS',
        retryAfter: 15 * 60 // 15분 후 재시도
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Auth rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        success: false,
        error: {
          message: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요',
          errorCode: 'TOO_MANY_AUTH_ATTEMPTS',
          retryAfter: 15 * 60
        }
      });
    }
  });
}

module.exports = AuthenticationMiddleware;
```

### 2. API 보안 헤더
```javascript
// middleware/security.js
const helmet = require('helmet');

const securityMiddleware = {
  // 보안 헤더 설정
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://openapi.band.us'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "https://openapi.band.us"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "same-origin" }
  }),

  // CORS 설정
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      
      // 개발 환경에서는 localhost 허용
      if (process.env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:19006', 'exp://');
      }

      if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        callback(new Error('CORS 정책에 의해 차단됨'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-Request-ID',
      'X-Device-ID'
    ]
  },

  // Request 보안 검증
  validateRequest: (req, res, next) => {
    // Content-Type 검증
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (!req.is('application/json')) {
        return res.status(400).json({
          success: false,
          error: {
            message: '잘못된 Content-Type입니다',
            errorCode: 'INVALID_CONTENT_TYPE'
          }
        });
      }
    }

    // Request 크기 제한
    if (req.get('Content-Length') > 10 * 1024 * 1024) { // 10MB
      return res.status(413).json({
        success: false,
        error: {
          message: '요청 크기가 너무 큽니다',
          errorCode: 'REQUEST_TOO_LARGE'
        }
      });
    }

    next();
  }
};

module.exports = securityMiddleware;
```

## 🔒 데이터 암호화

### 1. 개인정보 암호화
```javascript
// utils/encryption.js
const crypto = require('crypto');

class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.saltLength = 64;
    this.tagLength = 16;
    this.encryptionKey = process.env.DATA_ENCRYPTION_KEY;
  }

  // 개인정보 암호화
  encryptPII(data) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const salt = crypto.randomBytes(this.saltLength);
      
      // PBKDF2로 키 유도
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, this.keyLength, 'sha512');
      
      const cipher = crypto.createCipher(this.algorithm, key, iv);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  // 개인정보 복호화
  decryptPII(encryptedData) {
    try {
      const { encrypted, iv, salt, authTag } = encryptedData;
      
      const key = crypto.pbkdf2Sync(
        this.encryptionKey, 
        Buffer.from(salt, 'hex'), 
        100000, 
        this.keyLength, 
        'sha512'
      );
      
      const decipher = crypto.createDecipher(
        this.algorithm, 
        key, 
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // 비밀번호 해싱 (추가 보안용)
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(32).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    
    return {
      hash: hash,
      salt: salt
    };
  }

  // 비밀번호 검증
  verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  // 데이터 해싱 (무결성 검증용)
  generateDataHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}

module.exports = new DataEncryption();
```

### 2. 데이터베이스 필드 레벨 암호화
```javascript
// models/encryptedUser.js
const mongoose = require('mongoose');
const encryption = require('../utils/encryption');

const encryptedFieldPlugin = function(schema, options) {
  const fieldsToEncrypt = options.fields || [];
  
  // 저장 전 암호화
  schema.pre('save', function() {
    fieldsToEncrypt.forEach(field => {
      if (this[field] && !this[field].encrypted) {
        this[field] = encryption.encryptPII(this[field]);
      }
    });
  });

  // 조회 후 복호화
  schema.post('findOne', function(doc) {
    if (doc) {
      fieldsToEncrypt.forEach(field => {
        if (doc[field] && doc[field].encrypted) {
          try {
            doc[field] = encryption.decryptPII(doc[field]);
          } catch (error) {
            logger.error('Field decryption failed', { field, error: error.message });
          }
        }
      });
    }
  });
};

const UserSchema = new mongoose.Schema({
  // 공개 정보
  band_user_id: { type: String, required: true, unique: true },
  display_name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  
  // 암호화된 개인정보
  personal_info: {
    email: String,        // 암호화됨
    phone: String,        // 암호화됨
    real_name: String,    // 암호화됨
    birth_date: Date,     // 암호화됨
    emergency_contact: Object // 암호화됨
  },
  
  // 시스템 정보
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' }
});

// 개인정보 필드 암호화 플러그인 적용
UserSchema.plugin(encryptedFieldPlugin, {
  fields: ['personal_info']
});

module.exports = mongoose.model('User', UserSchema);
```

## 🚨 보안 모니터링

### 1. 보안 이벤트 로깅
```javascript
// utils/securityLogger.js
class SecurityLogger {
  constructor() {
    this.criticalEvents = [
      'FAILED_LOGIN_ATTEMPT',
      'SUSPICIOUS_IP_ACCESS',
      'TOKEN_TAMPERING',
      'UNAUTHORIZED_ACCESS',
      'DATA_BREACH_ATTEMPT',
      'ADMIN_ACTION',
      'PASSWORD_CHANGE',
      'ACCOUNT_LOCKOUT'
    ];
  }

  // 보안 이벤트 로그
  logSecurityEvent(eventType, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      severity: this.getSeverity(eventType),
      details: details,
      request_id: details.request_id,
      user_id: details.user_id,
      ip_address: details.ip_address,
      user_agent: details.user_agent,
      session_id: details.session_id
    };

    // 파일 로그
    logger.security(JSON.stringify(logEntry));

    // 심각한 이벤트는 즉시 알림
    if (this.isCriticalEvent(eventType)) {
      this.sendSecurityAlert(logEntry);
    }

    // 데이터베이스 저장
    this.saveSecurityLog(logEntry);
  }

  getSeverity(eventType) {
    const severityMap = {
      'FAILED_LOGIN_ATTEMPT': 'medium',
      'SUSPICIOUS_IP_ACCESS': 'high',
      'TOKEN_TAMPERING': 'critical',
      'UNAUTHORIZED_ACCESS': 'high',
      'DATA_BREACH_ATTEMPT': 'critical',
      'ADMIN_ACTION': 'medium',
      'PASSWORD_CHANGE': 'low',
      'ACCOUNT_LOCKOUT': 'medium'
    };

    return severityMap[eventType] || 'low';
  }

  isCriticalEvent(eventType) {
    return ['TOKEN_TAMPERING', 'DATA_BREACH_ATTEMPT'].includes(eventType);
  }

  async sendSecurityAlert(logEntry) {
    // 관리자에게 이메일/Slack 알림
    try {
      await notificationService.sendSecurityAlert({
        title: `보안 이벤트 발생: ${logEntry.event_type}`,
        message: `심각도: ${logEntry.severity}\n상세: ${JSON.stringify(logEntry.details)}`,
        urgency: 'high'
      });
    } catch (error) {
      logger.error('보안 알림 전송 실패:', error);
    }
  }

  async saveSecurityLog(logEntry) {
    try {
      await SecurityLogModel.create(logEntry);
    } catch (error) {
      logger.error('보안 로그 저장 실패:', error);
    }
  }

  // 의심스러운 활동 패턴 감지
  async detectSuspiciousPatterns(userId) {
    const recentLogs = await SecurityLogModel.find({
      user_id: userId,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24시간
    });

    const patterns = {
      multipleFailedLogins: this.checkMultipleFailedLogins(recentLogs),
      unusualIPAccess: this.checkUnusualIPAccess(recentLogs),
      rapidRequests: this.checkRapidRequests(recentLogs)
    };

    // 의심스러운 패턴이 감지되면 알림
    Object.keys(patterns).forEach(pattern => {
      if (patterns[pattern].detected) {
        this.logSecurityEvent('SUSPICIOUS_PATTERN_DETECTED', {
          user_id: userId,
          pattern: pattern,
          details: patterns[pattern].details
        });
      }
    });

    return patterns;
  }

  checkMultipleFailedLogins(logs) {
    const failedAttempts = logs.filter(log => 
      log.event_type === 'FAILED_LOGIN_ATTEMPT'
    );

    return {
      detected: failedAttempts.length >= 5,
      details: {
        attempts: failedAttempts.length,
        timespan: '24h'
      }
    };
  }

  checkUnusualIPAccess(logs) {
    const uniqueIPs = [...new Set(logs.map(log => log.ip_address))];
    
    return {
      detected: uniqueIPs.length > 3,
      details: {
        unique_ips: uniqueIPs.length,
        ips: uniqueIPs
      }
    };
  }

  checkRapidRequests(logs) {
    const requestsInLastHour = logs.filter(log => 
      new Date(log.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
    );

    return {
      detected: requestsInLastHour.length > 100,
      details: {
        requests: requestsInLastHour.length,
        timespan: '1h'
      }
    };
  }
}

module.exports = new SecurityLogger();
```

### 2. 실시간 보안 모니터링
```javascript
// services/securityMonitor.js
class SecurityMonitor {
  constructor() {
    this.alertThresholds = {
      failedLoginAttempts: 10,        // 10분간 10회 실패
      suspiciousIPs: 5,               // 동시 접속 IP 5개
      rapidRequests: 1000,            // 1분간 1000회 요청
      tokenAnomalies: 5               // 5분간 토큰 이상 5회
    };

    this.startMonitoring();
  }

  startMonitoring() {
    // 실시간 로그 모니터링 (매분 실행)
    setInterval(() => {
      this.checkSecurityMetrics();
    }, 60000); // 1분

    // 의심스러운 활동 패턴 검사 (매 5분 실행)
    setInterval(() => {
      this.analyzeSuspiciousPatterns();
    }, 300000); // 5분
  }

  async checkSecurityMetrics() {
    const now = new Date();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

    try {
      // 실패한 로그인 시도 확인
      const failedLogins = await SecurityLogModel.countDocuments({
        event_type: 'FAILED_LOGIN_ATTEMPT',
        timestamp: { $gte: tenMinutesAgo }
      });

      if (failedLogins >= this.alertThresholds.failedLoginAttempts) {
        await this.triggerSecurityAlert('HIGH_FAILED_LOGIN_RATE', {
          count: failedLogins,
          timeframe: '10분'
        });
      }

      // 의심스러운 IP 활동 확인
      const suspiciousIPs = await this.findSuspiciousIPs(tenMinutesAgo);
      if (suspiciousIPs.length >= this.alertThresholds.suspiciousIPs) {
        await this.triggerSecurityAlert('SUSPICIOUS_IP_ACTIVITY', {
          ips: suspiciousIPs,
          count: suspiciousIPs.length
        });
      }

    } catch (error) {
      logger.error('보안 메트릭 확인 중 오류:', error);
    }
  }

  async findSuspiciousIPs(since) {
    const ipActivity = await SecurityLogModel.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          event_type: { $in: ['FAILED_LOGIN_ATTEMPT', 'UNAUTHORIZED_ACCESS'] }
        }
      },
      {
        $group: {
          _id: '$ip_address',
          count: { $sum: 1 },
          events: { $push: '$event_type' }
        }
      },
      {
        $match: { count: { $gte: 5 } } // 5회 이상 의심스러운 활동
      }
    ]);

    return ipActivity.map(item => item._id);
  }

  async triggerSecurityAlert(alertType, details) {
    logger.warn(`보안 알림: ${alertType}`, details);

    // 슬랙/이메일 알림 전송
    await notificationService.sendUrgentAlert({
      type: alertType,
      details: details,
      timestamp: new Date().toISOString()
    });

    // 필요한 경우 자동 대응 조치
    await this.executeAutoResponse(alertType, details);
  }

  async executeAutoResponse(alertType, details) {
    switch (alertType) {
      case 'HIGH_FAILED_LOGIN_RATE':
        // IP 기반 일시적 차단 (1시간)
        await this.temporarilyBlockSuspiciousIPs(details);
        break;

      case 'SUSPICIOUS_IP_ACTIVITY':
        // 해당 IP들의 요청 속도 제한 강화
        await this.enhanceRateLimitForIPs(details.ips);
        break;

      case 'TOKEN_TAMPERING_DETECTED':
        // 해당 사용자의 모든 세션 무효화
        await this.revokeAllUserSessions(details.user_id);
        break;
    }
  }

  async temporarilyBlockSuspiciousIPs(details) {
    // Redis에 차단된 IP 목록 저장
    const redis = require('../cache/redis.manager');
    const blockDuration = 60 * 60; // 1시간

    for (const ip of details.ips || []) {
      await redis.setEx(`blocked_ip:${ip}`, blockDuration, 'true');
    }

    logger.info('의심스러운 IP들을 일시적으로 차단했습니다', { ips: details.ips });
  }
}

module.exports = new SecurityMonitor();
```

## 🔐 Band API 보안 연동

### 1. Band OAuth 보안 강화
```javascript
// services/secureBandIntegration.js
class SecureBandIntegration {
  constructor() {
    this.clientId = process.env.BAND_CLIENT_ID;
    this.clientSecret = process.env.BAND_CLIENT_SECRET;
    this.redirectUri = process.env.BAND_REDIRECT_URI;
    this.stateStore = new Map(); // 실제로는 Redis 사용
  }

  // 안전한 OAuth 시작
  initiateSecureOAuth(userId, additionalParams = {}) {
    // CSRF 방지를 위한 state 생성
    const state = this.generateSecureState(userId);
    
    // state를 임시 저장 (10분 후 만료)
    this.stateStore.set(state, {
      user_id: userId,
      created_at: Date.now(),
      additional_params: additionalParams
    });

    const authUrl = new URL('https://auth.band.us/oauth2/authorize');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', 'band.read band.write');

    return {
      auth_url: authUrl.toString(),
      state: state
    };
  }

  // OAuth 콜백 처리 (보안 강화)
  async handleSecureCallback(code, state, ip, userAgent) {
    try {
      // State 검증
      const stateData = this.stateStore.get(state);
      if (!stateData) {
        throw new Error('Invalid or expired state parameter');
      }

      // State 만료 확인 (10분)
      if (Date.now() - stateData.created_at > 10 * 60 * 1000) {
        this.stateStore.delete(state);
        throw new Error('State parameter has expired');
      }

      // State 사용 후 삭제 (재사용 방지)
      this.stateStore.delete(state);

      // Band에서 액세스 토큰 교환
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      // Band 사용자 정보 조회
      const bandUserInfo = await this.getBandUserInfo(tokenResponse.access_token);
      
      // 보안 검증
      await this.validateBandUserInfo(bandUserInfo);

      // 로컬 사용자 생성/업데이트
      const user = await this.syncUserWithBand(bandUserInfo, tokenResponse);

      // 보안 로그 기록
      securityLogger.logSecurityEvent('BAND_OAUTH_SUCCESS', {
        user_id: user._id,
        band_user_id: bandUserInfo.user_key,
        ip_address: ip,
        user_agent: userAgent
      });

      return user;

    } catch (error) {
      // 실패 로그 기록
      securityLogger.logSecurityEvent('BAND_OAUTH_FAILED', {
        error: error.message,
        state: state,
        ip_address: ip,
        user_agent: userAgent
      });

      throw error;
    }
  }

  async exchangeCodeForToken(code) {
    const tokenEndpoint = 'https://auth.band.us/oauth2/token';
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('redirect_uri', this.redirectUri);
    params.append('code', code);

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DongBaeJul/1.0'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  }

  async validateBandUserInfo(userInfo) {
    // 필수 필드 검증
    const requiredFields = ['user_key', 'name'];
    for (const field of requiredFields) {
      if (!userInfo[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Band 사용자 ID 형식 검증
    if (!/^[a-zA-Z0-9_-]+$/.test(userInfo.user_key)) {
      throw new Error('Invalid Band user key format');
    }

    // 밴 목록 확인
    const isBanned = await this.checkIfUserBanned(userInfo.user_key);
    if (isBanned) {
      throw new Error('User is banned from the service');
    }

    return true;
  }

  generateSecureState(userId) {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${userId}_${timestamp}_${random}`;
    
    return crypto
      .createHmac('sha256', process.env.BAND_STATE_SECRET)
      .update(data)
      .digest('hex');
  }

  // Band API 호출 시 보안 강화
  async secureAPICall(endpoint, accessToken, options = {}) {
    const requestId = crypto.randomUUID();
    
    try {
      const response = await fetch(`https://openapi.band.us/v2${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'User-Agent': 'DongBaeJul/1.0',
          ...options.headers
        }
      });

      // API 응답 검증
      if (!response.ok) {
        await this.handleBandAPIError(response, endpoint, requestId);
      }

      const data = await response.json();
      
      // 응답 데이터 검증
      await this.validateBandAPIResponse(data, endpoint);

      return data;

    } catch (error) {
      securityLogger.logSecurityEvent('BAND_API_ERROR', {
        endpoint: endpoint,
        error: error.message,
        request_id: requestId
      });

      throw error;
    }
  }

  async handleBandAPIError(response, endpoint, requestId) {
    const errorData = await response.json().catch(() => ({}));
    
    securityLogger.logSecurityEvent('BAND_API_ERROR', {
      endpoint: endpoint,
      status: response.status,
      error: errorData.error || 'Unknown error',
      request_id: requestId
    });

    // 특정 에러에 대한 보안 대응
    if (response.status === 401) {
      throw new Error('Band access token is invalid or expired');
    } else if (response.status === 429) {
      throw new Error('Band API rate limit exceeded');
    } else {
      throw new Error(`Band API error: ${response.status}`);
    }
  }
}

module.exports = new SecureBandIntegration();
```

이 보안 전략을 통해 다층 보안 체계를 구축하여 사용자 데이터와 시스템을 안전하게 보호할 수 있습니다. 특히 JWT 토큰 관리, API 보안, 데이터 암호화, 보안 모니터링을 통해 종합적인 보안 솔루션을 제공합니다.