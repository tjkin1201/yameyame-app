/**
 * ELO 패리티 테스트 — TS lib(src/lib/elo.ts) ↔ Postgres 함수(record_game 내부) 동일성.
 * SQL 기대값은 Supabase execute_sql로 검증된 값(2026-06-13):
 *   elo_expected(1500,1400)=0.640065 / 승자 1512 / 패자 1388 / K(5)=40, K(50)=32
 * 실행: npx tsx scripts/elo-parity.ts  (모두 통과 시 exit 0)
 */
import {
  calculateDoubles,
  calculateSingles,
  expectedScore,
  getKFactor,
  getRatingTier,
} from '../src/lib/elo';
import { generateDoubles } from '../src/lib/matching';

let failures = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${name}`);
  }
}
function close(name: string, actual: number, expected: number, tol = 1e-6) {
  if (Math.abs(actual - expected) > tol) {
    failures++;
    console.error(`✗ ${name}: expected ≈${expected}, got ${actual}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

// SQL 검증값과 패리티
close('expectedScore(1500,1400) = 0.640065', expectedScore(1500, 1400), 0.640065, 1e-6);
eq('K factor provisional(5)=40', getKFactor(5), 40);
eq('K factor standard(50)=32', getKFactor(50), 32);
eq(
  '단식 1500vs1400 승자1 → 1512/1388 (SQL 패리티)',
  calculateSingles(1500, 1400, 1),
  { player1NewElo: 1512, player2NewElo: 1388 },
);
eq(
  '단식 약자 승리(업셋) 1400vs1500 승자1 → 1420/1480',
  calculateSingles(1400, 1500, 1),
  { player1NewElo: 1420, player2NewElo: 1480 },
);
eq(
  '신규(20게임 미만) K=40 반영: 1200vs1200 승자1',
  calculateSingles(1200, 1200, 1, 0, 0),
  { player1NewElo: 1220, player2NewElo: 1180 },
);

// 복식: 팀 평균 기준
const d = calculateDoubles([1500, 1300], [1450, 1350], 1);
eq('복식 동평균(1400vs1400) 승팀 +16', d, {
  team1NewElos: [1516, 1316],
  team2NewElos: [1434, 1334],
});

// 등급 경계
eq('1199=브론즈', getRatingTier(1199).tier, '브론즈');
eq('1200=실버', getRatingTier(1200).tier, '실버');
eq('2000=마스터', getRatingTier(2000).tier, '마스터');

// 대진표: snake-draft 1&4 vs 2&3, 5명이면 1명 휴식(최하위)
const m = generateDoubles([
  { id: 'a', name: 'A', elo: 1600 },
  { id: 'b', name: 'B', elo: 1500 },
  { id: 'c', name: 'C', elo: 1400 },
  { id: 'd', name: 'D', elo: 1300 },
  { id: 'e', name: 'E', elo: 1200 },
]);
eq('대진표 1코트 팀1 = 1위&4위 (A,D)', m.matches[0].team1.map((p) => p.id), ['a', 'd']);
eq('대진표 1코트 팀2 = 2위&3위 (B,C)', m.matches[0].team2.map((p) => p.id), ['b', 'c']);
eq('5명 → 휴식 1명(E)', m.resting.map((p) => p.id), ['e']);
eq('팀 평균 동일 → gap 0', m.matches[0].eloGap, 0);

if (failures > 0) {
  console.error(`\n${failures}개 실패`);
  process.exit(1);
}
console.log('\n모든 패리티 테스트 통과 ✅');
