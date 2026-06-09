import mongoose from 'mongoose';

/** MongoDB 연결 관리 (MONGODB_URI 미설정 시 DB 없이 기동 가능) */
export class Database {
  private static instance: Database;
  private isConnected = false;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yameyame';

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    this.isConnected = true;
    console.log(`💚 MongoDB connected: ${mongoose.connection.name}`);

    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
      this.isConnected = false;
    });
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
    });
    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
    });
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await mongoose.disconnect();
    this.isConnected = false;
  }

  isDbConnected(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      if (!this.isDbConnected()) {
        return { status: 'unhealthy', message: 'Database not connected' };
      }
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      return { status: 'healthy', message: 'Database connection is healthy' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return { status: 'unhealthy', message };
    }
  }
}

export const database = Database.getInstance();
