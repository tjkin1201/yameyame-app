/**
 * ELO 레이팅 엔진 — server/src/services/elo.service.ts 이식 (패리티 유지 필수).
 * 실제 기록 반영은 Postgres RPC record_game이 담당하고,
 * 이 모듈은 UI 예측(승률·등급·대진표)에 사용한다.
 * 수치 변경 시 마이그레이션의 elo_k_factor/elo_expected와 함께 바꿀 것.
 */

export const K_FACTOR = 32;
export const PROVISIONAL_K_FACTOR = 40;
export const PROVISIONAL_GAMES_THRESHOLD = 20;
export const DEFAULT_ELO = 1200;

export interface RatingTier {
  tier: string;
  minElo: number;
  maxElo: number;
  color: string;
}

export function getKFactor(gamesPlayed: number): number {
  return gamesPlayed < PROVISIONAL_GAMES_THRESHOLD ? PROVISIONAL_K_FACTOR : K_FACTOR;
}

/** E = 1 / (1 + 10^((opponent - player) / 400)) */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function calculateSingles(
  player1Elo: number,
  player2Elo: number,
  winner: 1 | 2,
  player1Games: number = 999,
  player2Games: number = 999,
): { player1NewElo: number; player2NewElo: number } {
  const expected1 = expectedScore(player1Elo, player2Elo);
  const actual1 = winner === 1 ? 1 : 0;
  const actual2 = winner === 2 ? 1 : 0;
  return {
    player1NewElo: Math.round(player1Elo + getKFactor(player1Games) * (actual1 - expected1)),
    player2NewElo: Math.round(player2Elo + getKFactor(player2Games) * (actual2 - (1 - expected1))),
  };
}

export function calculateDoubles(
  team1Elos: [number, number],
  team2Elos: [number, number],
  winner: 1 | 2,
  team1Games: [number, number] = [999, 999],
  team2Games: [number, number] = [999, 999],
): { team1NewElos: [number, number]; team2NewElos: [number, number] } {
  const team1Avg = (team1Elos[0] + team1Elos[1]) / 2;
  const team2Avg = (team2Elos[0] + team2Elos[1]) / 2;
  const expected1 = expectedScore(team1Avg, team2Avg);
  const expected2 = 1 - expected1;
  const actual1 = winner === 1 ? 1 : 0;
  const actual2 = winner === 2 ? 1 : 0;
  return {
    team1NewElos: [
      Math.round(team1Elos[0] + getKFactor(team1Games[0]) * (actual1 - expected1)),
      Math.round(team1Elos[1] + getKFactor(team1Games[1]) * (actual1 - expected1)),
    ],
    team2NewElos: [
      Math.round(team2Elos[0] + getKFactor(team2Games[0]) * (actual2 - expected2)),
      Math.round(team2Elos[1] + getKFactor(team2Games[1]) * (actual2 - expected2)),
    ],
  };
}

export function predictWinProbability(
  player1Elo: number,
  player2Elo: number,
): { player1WinProbability: number; player2WinProbability: number } {
  const p1 = expectedScore(player1Elo, player2Elo);
  return {
    player1WinProbability: Math.round(p1 * 100) / 100,
    player2WinProbability: Math.round((1 - p1) * 100) / 100,
  };
}

export function interpretEloDifference(eloDiff: number): string {
  const abs = Math.abs(eloDiff);
  if (abs < 50) return '비슷한 실력';
  if (abs < 100) return '약간 우위';
  if (abs < 200) return '확실한 우위';
  if (abs < 300) return '큰 실력 차이';
  return '압도적인 실력 차이';
}

export function getRatingTier(elo: number): RatingTier {
  if (elo >= 2000) return { tier: '마스터', minElo: 2000, maxElo: 9999, color: '#FF6B35' };
  if (elo >= 1800) return { tier: '다이아', minElo: 1800, maxElo: 1999, color: '#4D9FFF' };
  if (elo >= 1600) return { tier: '플래티넘', minElo: 1600, maxElo: 1799, color: '#00D4AA' };
  if (elo >= 1400) return { tier: '골드', minElo: 1400, maxElo: 1599, color: '#FFD700' };
  if (elo >= 1200) return { tier: '실버', minElo: 1200, maxElo: 1399, color: '#C0C0C0' };
  return { tier: '브론즈', minElo: 0, maxElo: 1199, color: '#CD7F32' };
}
