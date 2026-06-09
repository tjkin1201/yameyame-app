/**
 * 스마트 대진표 생성
 * - ELO 정렬 후 snake-draft로 복식 팀 구성 (1&4 vs 2&3)
 * - 팀 간 평균 ELO 차이를 최소화해 박빙 게임을 유도
 */
import { eloService } from './elo.service';

export interface MatchPlayer {
  id: string;
  name: string;
  elo: number;
}

export interface DoublesMatch {
  court: number;
  team1: MatchPlayer[];
  team2: MatchPlayer[];
  team1AvgElo: number;
  team2AvgElo: number;
  eloGap: number;
  prediction: {
    team1WinProbability: number;
    team2WinProbability: number;
    interpretation: string;
  };
}

export interface GenerateResult {
  matches: DoublesMatch[];
  resting: MatchPlayer[]; // 4명 단위로 나누고 남은 인원
}

export class MatchingService {
  /**
   * 복식 균형 대진표 생성
   * 플레이어 수가 4의 배수가 아니면 ELO 중간값 부근 인원을 휴식 처리
   */
  generateDoubles(players: MatchPlayer[]): GenerateResult {
    if (players.length < 4) {
      throw new Error('복식 대진표는 최소 4명이 필요합니다');
    }

    // ELO 내림차순 정렬
    const sorted = [...players].sort((a, b) => b.elo - a.elo);

    // 4명 단위 그룹으로 자르고 남는 인원은 휴식
    const groupCount = Math.floor(sorted.length / 4);
    const playing = sorted.slice(0, groupCount * 4);
    const resting = sorted.slice(groupCount * 4);

    const matches: DoublesMatch[] = [];

    for (let i = 0; i < groupCount; i++) {
      const group = playing.slice(i * 4, i * 4 + 4);
      // snake-draft: 1위&4위 vs 2위&3위 → 평균 ELO 차이 최소화
      const team1 = [group[0], group[3]];
      const team2 = [group[1], group[2]];

      const team1Avg = (team1[0].elo + team1[1].elo) / 2;
      const team2Avg = (team2[0].elo + team2[1].elo) / 2;

      const prediction = eloService.predictWinProbability(team1Avg, team2Avg);

      matches.push({
        court: i + 1,
        team1,
        team2,
        team1AvgElo: team1Avg,
        team2AvgElo: team2Avg,
        eloGap: Math.abs(team1Avg - team2Avg),
        prediction: {
          team1WinProbability: prediction.player1WinProbability,
          team2WinProbability: prediction.player2WinProbability,
          interpretation: eloService.interpretEloDifference(team1Avg - team2Avg),
        },
      });
    }

    return { matches, resting };
  }
}

export const matchingService = new MatchingService();
