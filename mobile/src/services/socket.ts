import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(userId: string, clubId: string): void {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.socket?.emit('authenticate', { userId, clubId });
    });

    this.socket.on('authenticated', (data) => {
      console.log('Socket authenticated:', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // 모든 notification 이벤트 수신
    this.socket.on('notification', (data) => {
      console.log('Notification received:', data);
      this.emit(data.type, data);
    });

    // 게임 관련 이벤트
    this.socket.on('game:score_updated', (data) => {
      this.emit('game:score_updated', data);
    });

    this.socket.on('game:completed', (data) => {
      this.emit('game:completed', data);
    });

    this.socket.on('game:joined', (data) => {
      console.log('Joined game:', data.gameId);
    });

    this.socket.on('game:left', (data) => {
      console.log('Left game:', data.gameId);
    });

    // 채팅 관련 이벤트
    this.socket.on('chat:message_received', (data) => {
      this.emit('chat:message_received', data);
    });

    this.socket.on('chat:user_typing', (data) => {
      this.emit('chat:user_typing', data);
    });

    // 사용자 온라인/오프라인
    this.socket.on('user:online', (data) => {
      this.emit('user:online', data);
    });

    this.socket.on('user:offline', (data) => {
      this.emit('user:offline', data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  joinGame(gameId: string): void {
    this.socket?.emit('game:join', gameId);
  }

  leaveGame(gameId: string): void {
    this.socket?.emit('game:leave', gameId);
  }

  updateScore(gameId: string, team1Score: number, team2Score: number): void {
    this.socket?.emit('game:update_score', { gameId, team1Score, team2Score });
  }

  completeGame(gameId: string, winner: number, finalScore: { team1: number; team2: number }): void {
    this.socket?.emit('game:complete', { gameId, winner, finalScore });
  }

  sendMessage(clubId: string, message: string, userId: string, userName: string): void {
    this.socket?.emit('chat:send_message', { clubId, message, userId, userName });
  }

  setTyping(clubId: string, userId: string, userName: string, isTyping: boolean): void {
    this.socket?.emit('chat:typing', { clubId, userId, userName, isTyping });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
