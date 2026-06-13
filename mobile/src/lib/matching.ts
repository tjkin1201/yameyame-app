/**
 * 스마트 대진표 — server/src/services/matching.service.ts 이식.
 * ELO 내림차순 정렬 후 4명 그룹마다 snake-draft(1&4 vs 2&3)로
 * 팀 평균 ELO 차이를 최소화한다. 남는 인원은 휴식.
 */
import { expectedScore, interpretEloDifference } from './elo';

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
  resting: MatchPlayer[];
}

export function generateDoubles(players: MatchPlayer[]): GenerateResult {
  if (players.length < 4) {
    throw new Error('복식 대진표는 최소 4명이 필요합니다');
  }

  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const groupCount = Math.floor(sorted.length / 4);
  const playing = sorted.slice(0, groupCount * 4);
  const resting = sorted.slice(groupCount * 4);

  const matches: DoublesMatch[] = [];

  for (let i = 0; i < groupCount; i++) {
    const group = playing.slice(i * 4, i * 4 + 4);
    const team1 = [group[0], group[3]];
    const team2 = [group[1], group[2]];

    const team1Avg = (team1[0].elo + team1[1].elo) / 2;
    const team2Avg = (team2[0].elo + team2[1].elo) / 2;
    const p1 = expectedScore(team1Avg, team2Avg);

    matches.push({
      court: i + 1,
      team1,
      team2,
      team1AvgElo: team1Avg,
      team2AvgElo: team2Avg,
      eloGap: Math.abs(team1Avg - team2Avg),
      prediction: {
        team1WinProbability: Math.round(p1 * 100) / 100,
        team2WinProbability: Math.round((1 - p1) * 100) / 100,
        interpretation: interpretEloDifference(team1Avg - team2Avg),
      },
    });
  }

  return { matches, resting };
}
