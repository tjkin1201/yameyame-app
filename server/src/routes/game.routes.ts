import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Game, { IGame } from '../models/Game.model';
import Member from '../models/Member.model';
import Club from '../models/Club.model';
import { eloService } from '../services/elo.service';
import { socketService } from '../services/socket.service';

const router = Router();

// GET /api/games - 게임 목록 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      clubId,
      status,
      type,
      playerId,
      sortBy = 'date',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = req.query;

    const filter: any = {};
    if (clubId) filter.clubId = clubId;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (playerId) {
      filter.$or = [{ 'team1.players': playerId }, { 'team2.players': playerId }];
    }

    const sort: any = {};
    sort[sortBy as string] = order === 'asc' ? 1 : -1;

    const games = await Game.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('team1.players', 'name elo profileImage')
      .populate('team2.players', 'name elo profileImage')
      .populate('createdBy', 'name');

    const total = await Game.countDocuments(filter);

    return res.status(200).json({
      games,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch games', details: (error as Error).message });
  }
});

// GET /api/games/:id - 게임 상세 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('team1.players', 'name elo level position profileImage')
      .populate('team2.players', 'name elo level position profileImage')
      .populate('createdBy', 'name')
      .populate('clubId', 'name');

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    return res.status(200).json(game);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch game', details: (error as Error).message });
  }
});

// POST /api/games - 게임 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const gameData: Partial<IGame> = req.body;

    // 필수 필드 검증
    if (!gameData.clubId) {
      return res.status(400).json({ error: 'clubId is required' });
    }
    if (!gameData.type) {
      return res.status(400).json({ error: 'type is required' });
    }
    if (!gameData.team1?.players || !gameData.team2?.players) {
      return res.status(400).json({ error: 'team1 and team2 players are required' });
    }

    // Club 존재 확인
    const club = await Club.findById(gameData.clubId);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // 플레이어 존재 확인 및 현재 ELO 가져오기
    const allPlayerIds = [
      ...(gameData.team1.players as mongoose.Types.ObjectId[]),
      ...(gameData.team2.players as mongoose.Types.ObjectId[]),
    ];
    const players = await Member.find({ _id: { $in: allPlayerIds } });

    if (players.length !== allPlayerIds.length) {
      return res.status(404).json({ error: 'One or more players not found' });
    }

    // 현재 ELO 저장
    gameData.team1.elo = (gameData.team1.players as mongoose.Types.ObjectId[]).map((playerId) => {
      const player = players.find((p) => p._id.toString() === playerId.toString());
      return player!.elo;
    });

    gameData.team2.elo = (gameData.team2.players as mongoose.Types.ObjectId[]).map((playerId) => {
      const player = players.find((p) => p._id.toString() === playerId.toString());
      return player!.elo;
    });

    // 승률 예측 계산
    if (gameData.type === 'singles') {
      const expected1 = eloService.expectedScore(gameData.team1.elo[0], gameData.team2.elo[0]);
      gameData.prediction = {
        team1WinProbability: expected1,
        team2WinProbability: 1 - expected1,
        eloDifference: gameData.team1.elo[0] - gameData.team2.elo[0],
      };
    } else {
      const team1Avg = (gameData.team1.elo[0] + gameData.team1.elo[1]) / 2;
      const team2Avg = (gameData.team2.elo[0] + gameData.team2.elo[1]) / 2;
      const expected1 = eloService.expectedScore(team1Avg, team2Avg);
      gameData.prediction = {
        team1WinProbability: expected1,
        team2WinProbability: 1 - expected1,
        eloDifference: team1Avg - team2Avg,
      };
    }

    const game = new Game(gameData);
    await game.save();

    // populate 후 반환
    await game.populate('team1.players', 'name elo profileImage');
    await game.populate('team2.players', 'name elo profileImage');

    // 실시간 알림: 클럽에 새 게임 생성 알림
    socketService.sendNotificationToClub(gameData.clubId.toString(), {
      type: 'game:created',
      game: game.toObject(),
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json(game);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create game', details: (error as Error).message });
  }
});

// PUT /api/games/:id - 게임 정보 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // 완료된 게임은 수정 불가 (status는 별도 API로만 변경)
    const existingGame = await Game.findById(req.params.id);
    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (existingGame.status === 'completed') {
      return res.status(403).json({ error: 'Cannot modify completed game' });
    }

    // 민감한 필드는 직접 수정 불가
    delete updates.eloChanges;
    delete updates.createdAt;
    delete updates.updatedAt;

    const game = await Game.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('team1.players', 'name elo profileImage')
      .populate('team2.players', 'name elo profileImage');

    return res.status(200).json(game);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update game', details: (error as Error).message });
  }
});

// PATCH /api/games/:id/status - 게임 상태 변경
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    game.status = status;
    await game.save();

    // 실시간 알림: 게임 상태 변경
    socketService.sendNotificationToClub(game.clubId.toString(), {
      type: 'game:status_changed',
      gameId: game._id,
      status,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json(game);
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Failed to update game status', details: (error as Error).message });
  }
});

// PATCH /api/games/:id/complete - 게임 완료 및 ELO 업데이트
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { winner, team1Score, team2Score } = req.body;

    if (!winner || (winner !== 1 && winner !== 2)) {
      return res.status(400).json({ error: 'winner must be 1 or 2' });
    }
    if (team1Score === undefined || team2Score === undefined) {
      return res.status(400).json({ error: 'team1Score and team2Score are required' });
    }

    const game = await Game.findById(req.params.id).populate('team1.players team2.players');
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status === 'completed') {
      return res.status(400).json({ error: 'Game already completed' });
    }

    // 점수 및 승자 업데이트
    game.team1.score = team1Score;
    game.team2.score = team2Score;
    game.winner = winner;
    game.status = 'completed';

    // ELO 계산
    let eloChanges: { team1: number[]; team2: number[] };

    if (game.type === 'singles') {
      const result = eloService.calculateSingles(
        game.team1.elo[0],
        game.team2.elo[0],
        winner,
        (game.team1.players[0] as any).stats.totalGames,
        (game.team2.players[0] as any).stats.totalGames
      );
      eloChanges = {
        team1: [result.player1NewElo - game.team1.elo[0]],
        team2: [result.player2NewElo - game.team2.elo[0]],
      };

      // 회원 ELO 및 통계 업데이트
      await (game.team1.players[0] as any).updateElo(result.player1NewElo, game._id);
      await (game.team2.players[0] as any).updateElo(result.player2NewElo, game._id);
      await (game.team1.players[0] as any).updateStats(winner === 1);
      await (game.team2.players[0] as any).updateStats(winner === 2);
    } else {
      const result = eloService.calculateDoubles(
        [game.team1.elo[0], game.team1.elo[1]],
        [game.team2.elo[0], game.team2.elo[1]],
        winner,
        [
          (game.team1.players[0] as any).stats.totalGames,
          (game.team1.players[1] as any).stats.totalGames,
        ],
        [
          (game.team2.players[0] as any).stats.totalGames,
          (game.team2.players[1] as any).stats.totalGames,
        ]
      );
      eloChanges = {
        team1: [
          result.team1NewElos[0] - game.team1.elo[0],
          result.team1NewElos[1] - game.team1.elo[1],
        ],
        team2: [
          result.team2NewElos[0] - game.team2.elo[0],
          result.team2NewElos[1] - game.team2.elo[1],
        ],
      };

      // 회원 ELO 및 통계 업데이트
      await (game.team1.players[0] as any).updateElo(result.team1NewElos[0], game._id);
      await (game.team1.players[1] as any).updateElo(result.team1NewElos[1], game._id);
      await (game.team2.players[0] as any).updateElo(result.team2NewElos[0], game._id);
      await (game.team2.players[1] as any).updateElo(result.team2NewElos[1], game._id);

      await (game.team1.players[0] as any).updateStats(winner === 1);
      await (game.team1.players[1] as any).updateStats(winner === 1);
      await (game.team2.players[0] as any).updateStats(winner === 2);
      await (game.team2.players[1] as any).updateStats(winner === 2);
    }

    game.eloChanges = eloChanges;
    await game.save();

    // Club 통계 업데이트
    await Club.findByIdAndUpdate(game.clubId, { $inc: { 'stats.totalGames': 1 } });

    // 실시간 알림: 게임 완료 및 ELO 변경
    const allPlayers = [
      ...(game.team1.players as any[]),
      ...(game.team2.players as any[]),
    ];

    // 클럽 전체에 게임 완료 알림
    socketService.sendNotificationToClub(game.clubId.toString(), {
      type: 'game:completed',
      gameId: game._id,
      winner,
      team1Score,
      team2Score,
      eloChanges,
      timestamp: new Date().toISOString(),
    });

    // 각 플레이어에게 개별 ELO 변경 알림
    allPlayers.forEach((player: any, index: number) => {
      const isTeam1 = index < (game.type === 'singles' ? 1 : 2);
      const teamEloChanges = isTeam1 ? eloChanges.team1 : eloChanges.team2;
      const playerIndex = isTeam1 ? index : index - (game.type === 'singles' ? 1 : 2);

      socketService.sendNotificationToUser(player._id.toString(), {
        type: 'elo:updated',
        gameId: game._id,
        oldElo: player.elo - teamEloChanges[playerIndex],
        newElo: player.elo,
        change: teamEloChanges[playerIndex],
        isWin: (isTeam1 && winner === 1) || (!isTeam1 && winner === 2),
        timestamp: new Date().toISOString(),
      });
    });

    return res.status(200).json({
      game,
      eloChanges,
      message: 'Game completed and ELO ratings updated',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to complete game', details: (error as Error).message });
  }
});

// DELETE /api/games/:id - 게임 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // 완료된 게임은 삭제 불가 (ELO 변경 이력 때문)
    if (game.status === 'completed') {
      return res
        .status(403)
        .json({ error: 'Cannot delete completed game (use cancel instead)' });
    }

    await game.deleteOne();
    return res.status(200).json({ message: 'Game deleted', game });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete game', details: (error as Error).message });
  }
});

export default router;
