import axios from 'axios';

/**
 * 서버 API 클라이언트
 * - 개발: localhost (Android 에뮬레이터는 10.0.2.2)
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── ELO ──────────────────────────────────────────────

export interface TierInfo {
  tier: string;
  minElo: number;
  maxElo: number;
  color: string;
}

export async function calculateSinglesElo(
  player1Elo: number,
  player2Elo: number,
  winner: 1 | 2
) {
  const { data } = await api.post('/api/elo/singles', { player1Elo, player2Elo, winner });
  return data.data;
}

export async function calculateDoublesElo(
  team1Elos: [number, number],
  team2Elos: [number, number],
  winner: 1 | 2
) {
  const { data } = await api.post('/api/elo/doubles', { team1Elos, team2Elos, winner });
  return data.data;
}

export async function getRatingTier(elo: number): Promise<{ currentElo: number; tier: TierInfo }> {
  const { data } = await api.get(`/api/elo/tier/${elo}`);
  return data.data;
}

// ── Matching ─────────────────────────────────────────

export interface MatchPlayer {
  id: string;
  name: string;
  elo: number;
}

export async function generateBrackets(players: MatchPlayer[]) {
  const { data } = await api.post('/api/matching/generate', { players });
  return data.data;
}

// ── Health ───────────────────────────────────────────

export async function checkServerHealth() {
  const { data } = await api.get('/api/health');
  return data;
}

// ── Members ──────────────────────────────────────────

export interface Member {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  position: 'all' | 'front' | 'back';
  elo: number;
  highestElo: number;
  lowestElo: number;
  stats: {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    currentStreak: number;
  };
  isActive: boolean;
  joinDate: string;
}

export interface MembersResponse {
  members: Member[];
  total: number;
  limit: number;
  offset: number;
}

export async function getMembers(params?: {
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<MembersResponse> {
  const { data } = await api.get('/api/members', { params });
  return data;
}

export async function getMember(id: string): Promise<Member> {
  const { data } = await api.get(`/api/members/${id}`);
  return data;
}

export async function createMember(memberData: {
  name: string;
  email?: string;
  phone?: string;
  level?: string;
  position?: string;
}): Promise<Member> {
  const { data } = await api.post('/api/members', memberData);
  return data;
}

export async function updateMember(id: string, updates: Partial<Member>): Promise<Member> {
  const { data } = await api.put(`/api/members/${id}`, updates);
  return data;
}

export async function deleteMember(id: string, hard?: boolean): Promise<void> {
  await api.delete(`/api/members/${id}`, { params: { hard } });
}

export async function getLeaderboard(limit = 100): Promise<{ leaderboard: Member[]; total: number }> {
  const { data } = await api.get('/api/members/stats/leaderboard', { params: { limit } });
  return data;
}

// ── Games ────────────────────────────────────────────

export interface Game {
  _id: string;
  clubId: string;
  date: string;
  courtNumber?: number;
  type: 'singles' | 'doubles';
  team1: {
    players: Member[];
    score: number;
    elo: number[];
  };
  team2: {
    players: Member[];
    score: number;
    elo: number[];
  };
  winner: 1 | 2 | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  prediction?: {
    team1WinProbability: number;
    team2WinProbability: number;
    eloDifference: number;
  };
  eloChanges?: {
    team1: number[];
    team2: number[];
  };
  notes?: string;
}

export interface GamesResponse {
  games: Game[];
  total: number;
  limit: number;
  offset: number;
}

export async function getGames(params?: {
  clubId?: string;
  status?: string;
  type?: string;
  playerId?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<GamesResponse> {
  const { data } = await api.get('/api/games', { params });
  return data;
}

export async function getGame(id: string): Promise<Game> {
  const { data } = await api.get(`/api/games/${id}`);
  return data;
}

export async function createGame(gameData: {
  clubId: string;
  type: 'singles' | 'doubles';
  team1: { players: string[] };
  team2: { players: string[] };
  courtNumber?: number;
}): Promise<Game> {
  const { data } = await api.post('/api/games', gameData);
  return data;
}

export async function updateGame(id: string, updates: Partial<Game>): Promise<Game> {
  const { data } = await api.put(`/api/games/${id}`, updates);
  return data;
}

export async function updateGameStatus(
  id: string,
  status: string
): Promise<Game> {
  const { data } = await api.patch(`/api/games/${id}/status`, { status });
  return data;
}

export async function completeGame(
  id: string,
  winner: 1 | 2,
  team1Score: number,
  team2Score: number
): Promise<{ game: Game; eloChanges: any }> {
  const { data } = await api.patch(`/api/games/${id}/complete`, {
    winner,
    team1Score,
    team2Score,
  });
  return data;
}

export async function deleteGame(id: string): Promise<void> {
  await api.delete(`/api/games/${id}`);
}

// ── Clubs ────────────────────────────────────────────

export interface Club {
  _id: string;
  name: string;
  description?: string;
  location?: {
    address?: string;
    city?: string;
  };
  members: string[];
  memberCount: number;
  stats: {
    totalGames: number;
    averageElo: number;
    activeMembers: number;
  };
  isActive: boolean;
}

export interface ClubsResponse {
  clubs: Club[];
  total: number;
  limit: number;
  offset: number;
}

export async function getClubs(params?: {
  search?: string;
  city?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ClubsResponse> {
  const { data } = await api.get('/api/clubs', { params });
  return data;
}

export async function getClub(id: string): Promise<Club> {
  const { data } = await api.get(`/api/clubs/${id}`);
  return data;
}

export async function createClub(clubData: {
  name: string;
  description?: string;
  createdBy: string;
}): Promise<Club> {
  const { data } = await api.post('/api/clubs', clubData);
  return data;
}
