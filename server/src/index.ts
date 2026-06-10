import express, { Express, NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import eloRoutes from './routes/elo.routes';
import matchingRoutes from './routes/matching.routes';
import memberRoutes from './routes/member.routes';
import gameRoutes from './routes/game.routes';
import clubRoutes from './routes/club.routes';
import statsRoutes from './routes/stats.routes';
import { socketService } from './services/socket.service';
import { database } from './utils/database';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
    credentials: true,
  })
);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', async (_req: Request, res: Response) => {
  const db = await database.healthCheck();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'yameyame-server',
    version: '1.0.0',
    database: db.status,
    connectedSockets: socketService.getConnectedUsersCount(),
  });
});

// API Routes
app.use('/api/elo', eloRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/stats', statsRoutes);

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'YameYame API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      elo: '/api/elo',
      matching: '/api/matching',
      members: '/api/members',
      games: '/api/games',
      clubs: '/api/clubs',
      stats: '/api/stats',
    },
  });
});

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

async function startServer() {
  // MongoDB는 옵션 — 미설정/실패 시에도 서버는 기동
  if (process.env.MONGODB_URI) {
    try {
      await database.connect();
    } catch {
      console.warn('⚠️ MongoDB connection failed, continuing without database');
    }
  } else {
    console.log('ℹ️ MONGODB_URI not set, starting without database');
  }

  socketService.initialize(httpServer);

  httpServer.listen(PORT, () => {
    console.log('');
    console.log('🚀 YameYame API Server');
    console.log('━'.repeat(50));
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🌍 env: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💚 health:   /api/health`);
    console.log(`🎯 elo:      /api/elo`);
    console.log(`🎲 matching: /api/matching`);
    console.log(`👥 members:  /api/members`);
    console.log(`🎮 games:    /api/games`);
    console.log(`🏛️  clubs:    /api/clubs`);
    console.log(`📊 stats:    /api/stats`);
    console.log(`🔌 socket:   ws://localhost:${PORT}`);
    console.log('━'.repeat(50));
  });
}

process.on('SIGTERM', async () => {
  await database.disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await database.disconnect();
  process.exit(0);
});

startServer();

export default app;
