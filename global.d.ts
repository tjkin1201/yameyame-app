/**
 * YameYame 프로젝트 전역 타입 정의
 * 모노레포 전체에서 사용되는 공통 타입들
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // 공통 환경 변수
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      
      // 데이터베이스
      DATABASE_URL: string;
      REDIS_URL: string;
      
      // 인증
      JWT_SECRET: string;
      JWT_REFRESH_SECRET: string;
      BAND_API_KEY: string;
      BAND_CLIENT_ID: string;
      BAND_CLIENT_SECRET: string;
      
      // 소켓 서버
      SOCKET_PORT: string;
      SOCKET_CORS_ORIGIN: string;
      
      // 파일 업로드
      UPLOAD_MAX_SIZE: string;
      STORAGE_PATH: string;
      
      // 외부 서비스
      PUSH_NOTIFICATION_KEY: string;
      ANALYTICS_KEY: string;
    }
  }
  
  // React Native 전역 타입
  namespace ReactNative {
    interface NativeModules {
      // 커스텀 네이티브 모듈들이 있다면 여기에 추가
    }
  }
  
  // Expo 관련 전역 타입
  namespace Expo {
    interface Constants {
      expoConfig?: {
        extra?: {
          apiUrl?: string;
          socketUrl?: string;
          bandApiUrl?: string;
        };
      };
    }
  }
}

// 모듈 확장
declare module '*.png' {
  const value: any;
  export = value;
}

declare module '*.jpg' {
  const value: any;
  export = value;
}

declare module '*.jpeg' {
  const value: any;
  export = value;
}

declare module '*.gif' {
  const value: any;
  export = value;
}

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// React Native Paper 테마 확장
declare module 'react-native-paper' {
  interface MD3Colors {
    // 커스텀 컬러가 있다면 여기에 추가
    gym?: string;
    badminton?: string;
    warning?: string;
  }
  
  interface Theme {
    // 커스텀 테마 속성이 있다면 여기에 추가
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  }
}

// Socket.IO 타입 확장
declare module 'socket.io-client' {
  interface Socket {
    // 커스텀 이벤트 타입들
    on(event: 'game-update', listener: (data: GameUpdatePayload) => void): this;
    on(event: 'chat-message', listener: (data: ChatMessagePayload) => void): this;
    on(event: 'member-status', listener: (data: MemberStatusPayload) => void): this;
    
    emit(event: 'join-game', data: JoinGamePayload): this;
    emit(event: 'send-message', data: SendMessagePayload): this;
    emit(event: 'update-status', data: UpdateStatusPayload): this;
  }
}

// 유틸리티 타입들
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys];

// API 응답 타입들
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// 소켓 이벤트 페이로드 타입들
interface GameUpdatePayload {
  gameId: string;
  type: 'start' | 'end' | 'pause' | 'resume' | 'score';
  data: unknown;
  timestamp: string;
}

interface ChatMessagePayload {
  messageId: string;
  roomId: string;
  userId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
}

interface MemberStatusPayload {
  userId: string;
  status: 'online' | 'offline' | 'playing' | 'away';
  lastSeen: string;
}

interface JoinGamePayload {
  gameId: string;
  userId: string;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
  type: 'text' | 'image' | 'file';
}

interface UpdateStatusPayload {
  status: 'online' | 'offline' | 'playing' | 'away';
}

export {};