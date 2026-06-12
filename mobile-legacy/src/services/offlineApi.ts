/**
 * 오프라인 우선 API Wrapper
 * - 온라인: 서버 API 호출 + 로컬 캐시 업데이트
 * - 오프라인: 로컬 DB 사용 + 동기화 큐 추가
 */

import { syncService } from './sync';
import { dbService, LocalMember, LocalGame } from './database';
import * as apiService from './api';

class OfflineApiService {
  // ── Members ──────────────────────────────────────────

  async getMembers(params?: {
    search?: string;
    isActive?: boolean;
    sortBy?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ members: any[]; total: number }> {
    if (syncService.getNetworkStatus()) {
      try {
        // 온라인: 서버에서 가져오고 로컬 캐시 업데이트
        const response = await apiService.getMembers(params);

        // 백그라운드로 로컬 DB 업데이트
        this.updateLocalMembers(response.members);

        return response;
      } catch (error) {
        console.warn('Failed to fetch from server, falling back to local DB:', error);
        return this.getMembersFromLocal(params);
      }
    } else {
      // 오프라인: 로컬 DB 사용
      return this.getMembersFromLocal(params);
    }
  }

  private async getMembersFromLocal(params?: {
    search?: string;
    isActive?: boolean;
  }): Promise<{ members: any[]; total: number }> {
    const localMembers = await dbService.getAllMembers({
      search: params?.search,
      isActive: params?.isActive,
    });

    const members = localMembers.map((m) => ({
      _id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      profileImage: m.profileImage,
      level: m.level,
      position: m.position,
      elo: m.elo,
      highestElo: m.highestElo,
      lowestElo: m.lowestElo,
      stats: {
        totalGames: m.totalGames,
        wins: m.wins,
        losses: m.losses,
        winRate: m.winRate,
        currentStreak: m.currentStreak,
      },
      isActive: m.isActive === 1,
      joinDate: m.updatedAt,
    }));

    return { members, total: members.length };
  }

  private async updateLocalMembers(members: any[]): Promise<void> {
    try {
      for (const member of members) {
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
          updatedAt: member.joinDate || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to update local members:', error);
    }
  }

  async getMember(id: string): Promise<any> {
    if (syncService.getNetworkStatus()) {
      try {
        return await apiService.getMember(id);
      } catch (error) {
        console.warn('Failed to fetch member from server, using local DB:', error);
        const local = await dbService.getMember(id);
        if (!local) throw new Error('Member not found');
        return this.convertLocalMemberToApi(local);
      }
    } else {
      const local = await dbService.getMember(id);
      if (!local) throw new Error('Member not found');
      return this.convertLocalMemberToApi(local);
    }
  }

  private convertLocalMemberToApi(m: LocalMember): any {
    return {
      _id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      profileImage: m.profileImage,
      level: m.level,
      position: m.position,
      elo: m.elo,
      highestElo: m.highestElo,
      lowestElo: m.lowestElo,
      stats: {
        totalGames: m.totalGames,
        wins: m.wins,
        losses: m.losses,
        winRate: m.winRate,
        currentStreak: m.currentStreak,
      },
      isActive: m.isActive === 1,
      joinDate: m.updatedAt,
    };
  }

  async createMember(memberData: any): Promise<any> {
    if (syncService.getNetworkStatus()) {
      try {
        // 온라인: 서버에 생성
        const member = await apiService.createMember(memberData);
        await this.updateLocalMembers([member]);
        return member;
      } catch (error) {
        console.warn('Failed to create member on server, saving locally:', error);
        return this.createMemberLocally(memberData);
      }
    } else {
      // 오프라인: 로컬 생성 + 동기화 큐
      return this.createMemberLocally(memberData);
    }
  }

  private async createMemberLocally(memberData: any): Promise<any> {
    const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await dbService.saveMember({
      id,
      name: memberData.name,
      email: memberData.email,
      phone: memberData.phone,
      level: memberData.level || 'beginner',
      position: memberData.position || 'all',
      elo: 1200,
      highestElo: 1200,
      lowestElo: 1200,
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      currentStreak: 0,
      isActive: 1,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    });

    // 동기화 큐에 추가
    await dbService.addToSyncQueue({
      entity: 'member',
      entityId: id,
      operation: 'create',
      data: JSON.stringify(memberData),
    });

    const local = await dbService.getMember(id);
    return local ? this.convertLocalMemberToApi(local) : null;
  }

  // ── Games ────────────────────────────────────────────

  async getGames(params?: {
    clubId?: string;
    status?: string;
    type?: string;
    limit?: number;
  }): Promise<{ games: any[]; total: number }> {
    if (syncService.getNetworkStatus()) {
      try {
        const response = await apiService.getGames(params);
        this.updateLocalGames(response.games);
        return response;
      } catch (error) {
        console.warn('Failed to fetch games from server, using local DB:', error);
        return this.getGamesFromLocal(params);
      }
    } else {
      return this.getGamesFromLocal(params);
    }
  }

  private async getGamesFromLocal(params?: {
    status?: string;
    limit?: number;
  }): Promise<{ games: any[]; total: number }> {
    const localGames = await dbService.getAllGames({
      status: params?.status,
      limit: params?.limit,
    });

    const games = localGames.map((g) => this.convertLocalGameToApi(g));
    return { games, total: games.length };
  }

  private convertLocalGameToApi(g: LocalGame): any {
    return {
      _id: g.id,
      clubId: g.clubId,
      date: g.date,
      courtNumber: g.courtNumber,
      type: g.type,
      team1: {
        players: JSON.parse(g.team1Players || '[]').map((id: string) => ({ _id: id })),
        score: g.team1Score,
      },
      team2: {
        players: JSON.parse(g.team2Players || '[]').map((id: string) => ({ _id: id })),
        score: g.team2Score,
      },
      winner: g.winner,
      status: g.status,
    };
  }

  private async updateLocalGames(games: any[]): Promise<void> {
    try {
      for (const game of games) {
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
          winner: game.winner,
          status: game.status,
          syncStatus: 'synced',
          createdAt: game.date,
          updatedAt: game.date,
        });
      }
    } catch (error) {
      console.error('Failed to update local games:', error);
    }
  }

  async createGame(gameData: any): Promise<any> {
    if (syncService.getNetworkStatus()) {
      try {
        const game = await apiService.createGame(gameData);
        await this.updateLocalGames([game]);
        return game;
      } catch (error) {
        console.warn('Failed to create game on server, saving locally:', error);
        return this.createGameLocally(gameData);
      }
    } else {
      return this.createGameLocally(gameData);
    }
  }

  private async createGameLocally(gameData: any): Promise<any> {
    const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await dbService.saveGame({
      id,
      clubId: gameData.clubId,
      date: now,
      courtNumber: gameData.courtNumber,
      type: gameData.type,
      team1Players: JSON.stringify(gameData.team1.players),
      team2Players: JSON.stringify(gameData.team2.players),
      team1Score: 0,
      team2Score: 0,
      status: 'scheduled',
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await dbService.addToSyncQueue({
      entity: 'game',
      entityId: id,
      operation: 'create',
      data: JSON.stringify(gameData),
    });

    const localGames = await dbService.getAllGames({ limit: 1 });
    return localGames[0] ? this.convertLocalGameToApi(localGames[0]) : null;
  }

  // ── Network Status ───────────────────────────────────

  isOnline(): boolean {
    return syncService.getNetworkStatus();
  }

  onNetworkChange(listener: (isOnline: boolean) => void): void {
    syncService.onNetworkChange(listener);
  }

  offNetworkChange(listener: (isOnline: boolean) => void): void {
    syncService.offNetworkChange(listener);
  }

  async syncNow(): Promise<void> {
    return syncService.syncNow();
  }
}

export const offlineApi = new OfflineApiService();
