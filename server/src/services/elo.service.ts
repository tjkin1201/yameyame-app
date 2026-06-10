/**
 * ELO 레이팅 엔진
 * - 표준 ELO (K=32), 신규 플레이어(20게임 미만)는 K=40으로 빠른 수렴
 * - 복식은 팀 평균 ELO 기준 기대 승률 계산 후 개인별 반영
 */

export interface RatingTier {
  tier: string;
  minElo: number;
  maxElo: number;
  color: string;
}

export class EloService {
  private readonly K_FACTOR = 32;
  private readonly PROVISIONAL_K_FACTOR = 40;
  private readonly PROVISIONAL_GAMES_THRESHOLD = 20;

  readonly DEFAULT_ELO = 1200;

  /** 단식 ELO 계산 */
  calculateSingles(
    player1Elo: number,
    player2Elo: number,
    winner: 1 | 2,
    player1Games: number = 999,
    player2Games: number = 999
  ): { player1NewElo: number; player2NewElo: number } {
    const k1 = this.getKFactor(player1Games);
    const k2 = this.getKFactor(player2Games);

    const expected1 = this.expectedScore(player1Elo, player2Elo);
    const expected2 = 1 - expected1;

    const actual1 = winner === 1 ? 1 : 0;
    const actual2 = winner === 2 ? 1 : 0;

    return {
      player1NewElo: Math.round(player1Elo + k1 * (actual1 - expected1)),
      player2NewElo: Math.round(player2Elo + k2 * (actual2 - expected2)),
    };
  }

  /** 복식 ELO 계산 — 팀 평균 기준 */
  calculateDoubles(
    team1Elos: [number, number],
    team2Elos: [number, number],
    winner: 1 | 2,
    team1Games: [number, number] = [999, 999],
    team2Games: [number, number] = [999, 999]
  ): { team1NewElos: [number, number]; team2NewElos: [number, number] } {
    const team1Avg = (team1Elos[0] + team1Elos[1]) / 2;
    const team2Avg = (team2Elos[0] + team2Elos[1]) / 2;

    const expected1 = this.expectedScore(team1Avg, team2Avg);
    const expected2 = 1 - expected1;

    const actual1 = winner === 1 ? 1 : 0;
    const actual2 = winner === 2 ? 1 : 0;

    return {
      team1NewElos: [
        Math.round(team1Elos[0] + this.getKFactor(team1Games[0]) * (actual1 - expected1)),
        Math.round(team1Elos[1] + this.getKFactor(team1Games[1]) * (actual1 - expected1)),
      ],
      team2NewElos: [
        Math.round(team2Elos[0] + this.getKFactor(team2Games[0]) * (actual2 - expected2)),
        Math.round(team2Elos[1] + this.getKFactor(team2Games[1]) * (actual2 - expected2)),
      ],
    };
  }

  /** 승률 예측 */
  predictWinProbability(player1Elo: number, player2Elo: number): {
    player1WinProbability: number;
    player2WinProbability: number;
  } {
    const p1 = this.expectedScore(player1Elo, player2Elo);
    return {
      player1WinProbability: Math.round(p1 * 100) / 100,
      player2WinProbability: Math.round((1 - p1) * 100) / 100,
    };
  }

  /** 레이팅 차이 해석 */
  interpretEloDifference(eloDiff: number): string {
    const abs = Math.abs(eloDiff);
    if (abs < 50) return '비슷한 실력';
    if (abs < 100) return '약간 우위';
    if (abs < 200) return '확실한 우위';
    if (abs < 300) return '큰 실력 차이';
    return '압도적인 실력 차이';
  }

  /** 레이팅 등급 */
  getRatingTier(elo: number): RatingTier {
    if (elo >= 2000) return { tier: '마스터', minElo: 2000, maxElo: 9999, color: '#FF6B35' };
    if (elo >= 1800) return { tier: '다이아', minElo: 1800, maxElo: 1999, color: '#4D9FFF' };
    if (elo >= 1600) return { tier: '플래티넘', minElo: 1600, maxElo: 1799, color: '#00D4AA' };
    if (elo >= 1400) return { tier: '골드', minElo: 1400, maxElo: 1599, color: '#FFD700' };
    if (elo >= 1200) return { tier: '실버', minElo: 1200, maxElo: 1399, color: '#C0C0C0' };
    return { tier: '브론즈', minElo: 0, maxElo: 1199, color: '#CD7F32' };
  }

  /** E = 1 / (1 + 10^((opponent - player) / 400)) */
  expectedScore(playerElo: number, opponentElo: number): number {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  }

  private getKFactor(gamesPlayed: number): number {
    return gamesPlayed < this.PROVISIONAL_GAMES_THRESHOLD
      ? this.PROVISIONAL_K_FACTOR
      : this.K_FACTOR;
  }
}

export const eloService = new EloService();
