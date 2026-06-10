import { Router, Request, Response } from 'express';
import Member from '../models/Member.model';
import Game from '../models/Game.model';

const router = Router();

// GET /api/stats/leaderboard - 향상된 리더보드
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const {
      period = 'all', // all, month, week
      position, // all, front, back
      level, // beginner, intermediate, advanced, expert
      limit = 100,
    } = req.query;

    const filter: any = { isActive: true };

    if (position && position !== 'all') {
      filter.position = position;
    }
    if (level) {
      filter.level = level;
    }

    // 기간 필터링을 위한 날짜 계산
    let dateFilter: Date | undefined;
    if (period === 'month') {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (period === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const leaderboard = await Member.find(filter)
      .sort({ elo: -1 })
      .limit(Number(limit))
      .select('name elo level position stats profileImage eloHistory highestElo lowestElo');

    // 기간별 필터링 적용
    const filteredLeaderboard = leaderboard.map((member, index) => {
      let periodGames = member.stats.totalGames;
      let periodWins = member.stats.wins;
      let periodLosses = member.stats.losses;

      if (dateFilter) {
        const recentHistory = member.eloHistory.filter((h) => h.date >= dateFilter);
        periodGames = recentHistory.length;
        // 기간별 승패는 게임에서 다시 계산해야 하므로 전체 통계 사용
      }

      return {
        rank: index + 1,
        _id: member._id,
        name: member.name,
        elo: member.elo,
        level: member.level,
        position: member.position,
        profileImage: member.profileImage,
        highestElo: member.highestElo,
        lowestElo: member.lowestElo,
        stats: {
          totalGames: periodGames,
          wins: periodWins,
          losses: periodLosses,
          winRate: member.stats.winRate,
          currentStreak: member.stats.currentStreak,
        },
      };
    });

    return res.status(200).json({
      leaderboard: filteredLeaderboard,
      period,
      filters: { position, level },
      total: filteredLeaderboard.length,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Failed to fetch leaderboard', details: (error as Error).message });
  }
});

// GET /api/stats/member/:id/dashboard - 개인 성과 대시보드
router.get('/member/:id/dashboard', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ELO 추이 데이터 (최근 50게임)
    const eloTrend = member.eloHistory
      .slice(-50)
      .map((h) => ({
        elo: h.elo,
        date: h.date,
        gameId: h.gameId,
      }));

    // 최근 게임 기록
    const recentGames = await Game.find({
      $or: [{ 'team1.players': member._id }, { 'team2.players': member._id }],
      status: 'completed',
    })
      .sort({ date: -1 })
      .limit(20)
      .populate('team1.players', 'name elo')
      .populate('team2.players', 'name elo');

    // 월별 통계
    const monthlyStats = calculateMonthlyStats(member, recentGames);

    // 상대 전적
    const headToHead = await calculateHeadToHead(member._id.toString(), recentGames);

    // 폼 지표 (최근 10게임)
    const recentForm = member.eloHistory.slice(-10).map((h, i, arr) => {
      if (i === 0) return 0;
      return h.elo - arr[i - 1].elo;
    });

    const formTrend = recentForm.reduce((sum, change) => sum + change, 0) / recentForm.length;

    return res.status(200).json({
      member: {
        _id: member._id,
        name: member.name,
        elo: member.elo,
        highestElo: member.highestElo,
        lowestElo: member.lowestElo,
        level: member.level,
        position: member.position,
        stats: member.stats,
      },
      eloTrend,
      recentGames: recentGames.map((game) => ({
        _id: game._id,
        date: game.date,
        type: game.type,
        team1: game.team1,
        team2: game.team2,
        winner: game.winner,
        myTeam: game.team1.players.some((p: any) => p._id.toString() === member._id.toString())
          ? 1
          : 2,
        isWin:
          (game.team1.players.some((p: any) => p._id.toString() === member._id.toString()) &&
            game.winner === 1) ||
          (game.team2.players.some((p: any) => p._id.toString() === member._id.toString()) &&
            game.winner === 2),
      })),
      monthlyStats,
      headToHead: headToHead.slice(0, 10), // Top 10 opponents
      form: {
        trend: formTrend,
        recentChanges: recentForm,
        status: formTrend > 5 ? 'hot' : formTrend < -5 ? 'cold' : 'stable',
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Failed to fetch member dashboard', details: (error as Error).message });
  }
});

// GET /api/stats/predictions - 매치 예측 정확도 분석
router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const completedGames = await Game.find({
      status: 'completed',
      prediction: { $exists: true },
    })
      .limit(1000)
      .select('prediction winner type eloChanges');

    let correctPredictions = 0;
    let totalPredictions = 0;
    const predictionAccuracyByType = { singles: { correct: 0, total: 0 }, doubles: { correct: 0, total: 0 } };
    const predictionAccuracyByEloDiff: { range: string; correct: number; total: number }[] = [
      { range: '0-50', correct: 0, total: 0 },
      { range: '51-100', correct: 0, total: 0 },
      { range: '101-200', correct: 0, total: 0 },
      { range: '200+', correct: 0, total: 0 },
    ];

    completedGames.forEach((game) => {
      if (!game.prediction || !game.winner) return;

      totalPredictions++;
      const predictedWinner =
        game.prediction.team1WinProbability > game.prediction.team2WinProbability ? 1 : 2;
      const actualWinner = game.winner;

      if (predictedWinner === actualWinner) {
        correctPredictions++;
        predictionAccuracyByType[game.type].correct++;
      }

      predictionAccuracyByType[game.type].total++;

      // ELO 차이별 정확도
      const eloDiff = Math.abs(game.prediction.eloDifference);
      let rangeIndex = 0;
      if (eloDiff > 200) rangeIndex = 3;
      else if (eloDiff > 100) rangeIndex = 2;
      else if (eloDiff > 50) rangeIndex = 1;

      predictionAccuracyByEloDiff[rangeIndex].total++;
      if (predictedWinner === actualWinner) {
        predictionAccuracyByEloDiff[rangeIndex].correct++;
      }
    });

    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

    return res.status(200).json({
      overall: {
        accuracy: Math.round(accuracy * 100) / 100,
        correct: correctPredictions,
        total: totalPredictions,
      },
      byType: {
        singles: {
          accuracy:
            predictionAccuracyByType.singles.total > 0
              ? Math.round(
                  (predictionAccuracyByType.singles.correct /
                    predictionAccuracyByType.singles.total) *
                    10000
                ) / 100
              : 0,
          ...predictionAccuracyByType.singles,
        },
        doubles: {
          accuracy:
            predictionAccuracyByType.doubles.total > 0
              ? Math.round(
                  (predictionAccuracyByType.doubles.correct /
                    predictionAccuracyByType.doubles.total) *
                    10000
                ) / 100
              : 0,
          ...predictionAccuracyByType.doubles,
        },
      },
      byEloDifference: predictionAccuracyByEloDiff.map((range) => ({
        ...range,
        accuracy:
          range.total > 0 ? Math.round((range.correct / range.total) * 10000) / 100 : 0,
      })),
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        error: 'Failed to fetch prediction stats',
        details: (error as Error).message,
      });
  }
});

// Helper functions
function calculateMonthlyStats(member: any, games: any[]): any {
  const monthlyData: {
    [month: string]: { games: number; wins: number; losses: number; eloChange: number };
  } = {};

  games.forEach((game) => {
    const monthKey = new Date(game.date).toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { games: 0, wins: 0, losses: 0, eloChange: 0 };
    }

    monthlyData[monthKey].games++;

    const isTeam1 = game.team1.players.some((p: any) => p._id.toString() === member._id.toString());
    const isWin = (isTeam1 && game.winner === 1) || (!isTeam1 && game.winner === 2);

    if (isWin) {
      monthlyData[monthKey].wins++;
    } else {
      monthlyData[monthKey].losses++;
    }

    // ELO 변경 계산
    if (game.eloChanges) {
      const changes = isTeam1 ? game.eloChanges.team1 : game.eloChanges.team2;
      const playerIndex = isTeam1
        ? game.team1.players.findIndex((p: any) => p._id.toString() === member._id.toString())
        : game.team2.players.findIndex((p: any) => p._id.toString() === member._id.toString());

      if (playerIndex !== -1 && changes[playerIndex] !== undefined) {
        monthlyData[monthKey].eloChange += changes[playerIndex];
      }
    }
  });

  return Object.entries(monthlyData)
    .map(([month, stats]) => ({
      month,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12); // 최근 12개월
}

async function calculateHeadToHead(
  memberId: string,
  games: any[]
): Promise<{ opponent: any; wins: number; losses: number; total: number }[]> {
  const opponentStats: {
    [opponentId: string]: { opponent: any; wins: number; losses: number };
  } = {};

  games.forEach((game) => {
    const isTeam1 = game.team1.players.some((p: any) => p._id.toString() === memberId);
    const myTeam = isTeam1 ? game.team1 : game.team2;
    const opponentTeam = isTeam1 ? game.team2 : game.team1;
    const isWin = (isTeam1 && game.winner === 1) || (!isTeam1 && game.winner === 2);

    opponentTeam.players.forEach((opponent: any) => {
      const oppId = opponent._id.toString();
      if (!opponentStats[oppId]) {
        opponentStats[oppId] = { opponent, wins: 0, losses: 0 };
      }

      if (isWin) {
        opponentStats[oppId].wins++;
      } else {
        opponentStats[oppId].losses++;
      }
    });
  });

  return Object.values(opponentStats)
    .map((stats) => ({
      ...stats,
      total: stats.wins + stats.losses,
    }))
    .sort((a, b) => b.total - a.total);
}

export default router;
