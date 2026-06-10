import * as SQLite from 'expo-sqlite';

export interface LocalMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  level: string;
  position: string;
  elo: number;
  highestElo: number;
  lowestElo: number;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  isActive: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastSyncAt?: string;
  updatedAt: string;
}

export interface LocalGame {
  id: string;
  clubId: string;
  date: string;
  courtNumber?: number;
  type: 'singles' | 'doubles';
  team1Players: string; // JSON array
  team2Players: string; // JSON array
  team1Score: number;
  team2Score: number;
  winner?: number;
  status: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncOperation {
  id: string;
  entity: 'member' | 'game';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: string; // JSON
  createdAt: string;
  attempts: number;
  lastError?: string;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('yameyame.db');
      await this.createTables();
      console.log('✅ Local database initialized');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Members table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        profileImage TEXT,
        level TEXT NOT NULL,
        position TEXT NOT NULL,
        elo INTEGER NOT NULL DEFAULT 1200,
        highestElo INTEGER NOT NULL DEFAULT 1200,
        lowestElo INTEGER NOT NULL DEFAULT 1200,
        totalGames INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        winRate REAL NOT NULL DEFAULT 0,
        currentStreak INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        syncStatus TEXT NOT NULL DEFAULT 'synced',
        lastSyncAt TEXT,
        updatedAt TEXT NOT NULL
      );
    `);

    // Games table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        clubId TEXT NOT NULL,
        date TEXT NOT NULL,
        courtNumber INTEGER,
        type TEXT NOT NULL,
        team1Players TEXT NOT NULL,
        team2Players TEXT NOT NULL,
        team1Score INTEGER NOT NULL DEFAULT 0,
        team2Score INTEGER NOT NULL DEFAULT 0,
        winner INTEGER,
        status TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'synced',
        lastSyncAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    // Sync queue table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        lastError TEXT
      );
    `);

    // Create indexes
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_members_elo ON members(elo DESC);
      CREATE INDEX IF NOT EXISTS idx_members_sync ON members(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_games_date ON games(date DESC);
      CREATE INDEX IF NOT EXISTS idx_games_sync ON games(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity, entityId);
    `);
  }

  // Members CRUD
  async getAllMembers(filter?: { search?: string; isActive?: boolean }): Promise<LocalMember[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM members';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.search) {
      conditions.push('name LIKE ?');
      params.push(`%${filter.search}%`);
    }

    if (filter?.isActive !== undefined) {
      conditions.push('isActive = ?');
      params.push(filter.isActive ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY elo DESC';

    const result = await this.db.getAllAsync<LocalMember>(query, params);
    return result;
  }

  async getMember(id: string): Promise<LocalMember | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<LocalMember>(
      'SELECT * FROM members WHERE id = ?',
      [id]
    );
    return result || null;
  }

  async saveMember(member: Partial<LocalMember>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const existing = member.id ? await this.getMember(member.id) : null;

    if (existing) {
      // Update
      await this.db.runAsync(
        `UPDATE members SET
          name = ?, email = ?, phone = ?, profileImage = ?,
          level = ?, position = ?, elo = ?, highestElo = ?,
          lowestElo = ?, totalGames = ?, wins = ?, losses = ?,
          winRate = ?, currentStreak = ?, isActive = ?,
          syncStatus = ?, updatedAt = ?
        WHERE id = ?`,
        [
          member.name || existing.name,
          member.email || existing.email || null,
          member.phone || existing.phone || null,
          member.profileImage || existing.profileImage || null,
          member.level || existing.level,
          member.position || existing.position,
          member.elo ?? existing.elo,
          member.highestElo ?? existing.highestElo,
          member.lowestElo ?? existing.lowestElo,
          member.totalGames ?? existing.totalGames,
          member.wins ?? existing.wins,
          member.losses ?? existing.losses,
          member.winRate ?? existing.winRate,
          member.currentStreak ?? existing.currentStreak,
          member.isActive ?? existing.isActive,
          member.syncStatus || 'pending',
          now,
          existing.id,
        ]
      );
    } else {
      // Insert
      await this.db.runAsync(
        `INSERT INTO members (
          id, name, email, phone, profileImage, level, position,
          elo, highestElo, lowestElo, totalGames, wins, losses,
          winRate, currentStreak, isActive, syncStatus, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          member.id || `local_${Date.now()}`,
          member.name || '',
          member.email || null,
          member.phone || null,
          member.profileImage || null,
          member.level || 'beginner',
          member.position || 'all',
          member.elo || 1200,
          member.highestElo || 1200,
          member.lowestElo || 1200,
          member.totalGames || 0,
          member.wins || 0,
          member.losses || 0,
          member.winRate || 0,
          member.currentStreak || 0,
          member.isActive ?? 1,
          member.syncStatus || 'pending',
          now,
        ]
      );
    }
  }

  async deleteMember(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('UPDATE members SET isActive = 0, syncStatus = ? WHERE id = ?', [
      'pending',
      id,
    ]);
  }

  // Games CRUD
  async getAllGames(filter?: { status?: string; limit?: number }): Promise<LocalGame[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM games';
    const params: any[] = [];

    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY date DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const result = await this.db.getAllAsync<LocalGame>(query, params);
    return result;
  }

  async saveGame(game: Partial<LocalGame>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    if (game.id) {
      // Update
      await this.db.runAsync(
        `UPDATE games SET
          team1Score = ?, team2Score = ?, winner = ?,
          status = ?, syncStatus = ?, updatedAt = ?
        WHERE id = ?`,
        [
          game.team1Score || 0,
          game.team2Score || 0,
          game.winner || null,
          game.status || 'scheduled',
          'pending',
          now,
          game.id,
        ]
      );
    } else {
      // Insert
      await this.db.runAsync(
        `INSERT INTO games (
          id, clubId, date, courtNumber, type,
          team1Players, team2Players, team1Score, team2Score,
          winner, status, syncStatus, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `local_${Date.now()}`,
          game.clubId || '',
          game.date || now,
          game.courtNumber || null,
          game.type || 'doubles',
          game.team1Players || '[]',
          game.team2Players || '[]',
          game.team1Score || 0,
          game.team2Score || 0,
          game.winner || null,
          game.status || 'scheduled',
          'pending',
          now,
          now,
        ]
      );
    }
  }

  // Sync Queue
  async addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO sync_queue (id, entity, entityId, operation, data, createdAt, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, operation.entity, operation.entityId, operation.operation, operation.data, now, 0]
    );
  }

  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync<SyncOperation>(
      'SELECT * FROM sync_queue ORDER BY createdAt ASC'
    );
    return result;
  }

  async removeSyncOperation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async updateSyncOperationError(id: string, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      'UPDATE sync_queue SET attempts = attempts + 1, lastError = ? WHERE id = ?',
      [error, id]
    );
  }

  async clearDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execAsync('DELETE FROM members; DELETE FROM games; DELETE FROM sync_queue;');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const dbService = new DatabaseService();
