/**
 * Socket.io 실시간 통신
 * - 룸: club:{id} (동호회), game:{id} (경기), user:{id} (개인 알림)
 * - 배터리 최적화: pingInterval 60s
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

export class SocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, string> = new Map(); // socketId -> userId

  initialize(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
        credentials: true,
      },
      pingInterval: 60000,
      pingTimeout: 30000,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    console.log('✅ Socket.io server initialized');
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      socket.on('authenticate', (data: { userId: string; clubId: string }) => {
        this.handleAuthenticate(socket, data);
      });

      socket.on('game:join', (gameId: string) => {
        socket.join(`game:${gameId}`);
        socket.emit('game:joined', { gameId });
      });

      socket.on('game:leave', (gameId: string) => {
        socket.leave(`game:${gameId}`);
        socket.emit('game:left', { gameId });
      });

      socket.on(
        'game:update_score',
        (data: { gameId: string; team1Score: number; team2Score: number }) => {
          this.io?.to(`game:${data.gameId}`).emit('game:score_updated', {
            ...data,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        'game:complete',
        (data: { gameId: string; winner: number; finalScore: unknown }) => {
          this.io?.to(`game:${data.gameId}`).emit('game:completed', {
            ...data,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        'chat:send_message',
        (data: { clubId: string; message: string; userId: string; userName: string }) => {
          this.io?.to(`club:${data.clubId}`).emit('chat:message_received', {
            messageId: `msg_${Date.now()}`,
            userId: data.userId,
            userName: data.userName,
            message: data.message,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        'chat:typing',
        (data: { clubId: string; userId: string; userName: string; isTyping: boolean }) => {
          socket.to(`club:${data.clubId}`).emit('chat:user_typing', data);
        }
      );

      socket.on('disconnect', () => {
        const userId = this.connectedUsers.get(socket.id);
        if (userId) {
          this.io?.emit('user:offline', { userId, timestamp: new Date().toISOString() });
          this.connectedUsers.delete(socket.id);
        }
      });
    });
  }

  private handleAuthenticate(socket: Socket, data: { userId: string; clubId: string }): void {
    const { userId, clubId } = data;
    this.connectedUsers.set(socket.id, userId);

    socket.join(`club:${clubId}`);
    socket.join(`user:${userId}`);

    socket.emit('authenticated', { success: true, userId, clubId });
    this.io?.to(`club:${clubId}`).emit('user:online', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  sendNotificationToUser(userId: string, notification: unknown): void {
    this.io?.to(`user:${userId}`).emit('notification', notification);
  }

  sendNotificationToClub(clubId: string, notification: unknown): void {
    this.io?.to(`club:${clubId}`).emit('notification', notification);
  }

  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}

export const socketService = new SocketService();
