import NetInfo from '@react-native-community/netinfo';
import { dbService, SyncOperation } from './database';
import * as apiService from './api';

class SyncService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  async initialize(): Promise<void> {
    // 네트워크 상태 감지
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log('Network status:', this.isOnline ? 'online' : 'offline');

      // 온라인으로 전환되면 자동 동기화
      if (!wasOnline && this.isOnline) {
        console.log('🌐 Back online - starting sync');
        this.syncNow();
      }

      // 리스너에게 알림
      this.listeners.forEach((listener) => listener(this.isOnline));
    });

    // 초기 상태 확인
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;

    // 주기적 동기화 (5분마다)
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncNow();
      }
    }, 5 * 60 * 1000);

    console.log('✅ Sync service initialized');
  }

  onNetworkChange(listener: (isOnline: boolean) => void): void {
    this.listeners.add(listener);
  }

  offNetworkChange(listener: (isOnline: boolean) => void): void {
    this.listeners.delete(listener);
  }

  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!this.isOnline) {
      console.log('Offline - skipping sync');
      return;
    }

    try {
      this.isSyncing = true;
      console.log('🔄 Starting sync...');

      // 1. 서버에서 최신 데이터 가져오기
      await this.pullFromServer();

      // 2. 로컬 변경사항을 서버로 푸시
      await this.pushToServer();

      console.log('✅ Sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async pullFromServer(): Promise<void> {
    try {
      // 회원 데이터 가져오기
      const membersResponse = await apiService.getMembers({ limit: 1000 });

      for (const member of membersResponse.members) {
        await dbService.saveMember({
          id: member._id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          profileImage: member.profileImage,
          level: member.level,
          position: member.position,
          elo: member.elo,
          highestElo: member.highestElo,
          lowestElo: member.lowestElo,
          totalGames: member.stats.totalGames,
          wins: member.stats.wins,
          losses: member.stats.losses,
          winRate: member.stats.winRate,
          currentStreak: member.stats.currentStreak,
          isActive: member.isActive ? 1 : 0,
          syncStatus: 'synced',
          lastSyncAt: new Date().toISOString(),
          updatedAt: member.joinDate,
        });
      }

      // 게임 데이터 가져오기
      const gamesResponse = await apiService.getGames({ limit: 500 });

      for (const game of gamesResponse.games) {
        await dbService.saveGame({
          id: game._id,
          clubId: game.clubId,
          date: game.date,
          courtNumber: game.courtNumber,
          type: game.type,
          team1Players: JSON.stringify(game.team1.players.map((p: any) => p._id)),
          team2Players: JSON.stringify(game.team2.players.map((p: any) => p._id)),
          team1Score: game.team1.score,
          team2Score: game.team2.score,
          winner: game.winner || undefined,
          status: game.status,
          syncStatus: 'synced',
          lastSyncAt: new Date().toISOString(),
          createdAt: game.date,
          updatedAt: game.date,
        });
      }

      console.log(`✅ Pulled ${membersResponse.members.length} members, ${gamesResponse.games.length} games`);
    } catch (error) {
      console.error('Pull from server failed:', error);
      throw error;
    }
  }

  private async pushToServer(): Promise<void> {
    const operations = await dbService.getPendingSyncOperations();

    if (operations.length === 0) {
      console.log('No pending operations');
      return;
    }

    console.log(`📤 Pushing ${operations.length} pending operations`);

    for (const op of operations) {
      try {
        await this.executeSyncOperation(op);
        await dbService.removeSyncOperation(op.id);
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        await dbService.updateSyncOperationError(op.id, (error as Error).message);

        // 5회 시도 후 포기
        if (op.attempts >= 5) {
          console.error(`Operation ${op.id} failed after 5 attempts - removing`);
          await dbService.removeSyncOperation(op.id);
        }
      }
    }
  }

  private async executeSyncOperation(op: SyncOperation): Promise<void> {
    const data = JSON.parse(op.data);

    switch (op.entity) {
      case 'member':
        if (op.operation === 'create') {
          await apiService.createMember(data);
        } else if (op.operation === 'update') {
          await apiService.updateMember(op.entityId, data);
        } else if (op.operation === 'delete') {
          await apiService.deleteMember(op.entityId);
        }
        break;

      case 'game':
        if (op.operation === 'create') {
          await apiService.createGame(data);
        } else if (op.operation === 'update') {
          await apiService.updateGame(op.entityId, data);
        } else if (op.operation === 'delete') {
          await apiService.deleteGame(op.entityId);
        }
        break;
    }
  }

  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const syncService = new SyncService();
