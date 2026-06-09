import { Request, Response } from 'express';
import { eloService } from '../services/elo.service';

export class EloController {
  /** POST /api/elo/singles */
  calculateSingles(req: Request, res: Response): Response {
    const { player1Elo, player2Elo, winner, player1Games, player2Games } = req.body;

    if (player1Elo == null || player2Elo == null || winner == null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'player1Elo, player2Elo, winner are required',
      });
    }
    if (winner !== 1 && winner !== 2) {
      return res.status(400).json({ error: 'Bad Request', message: 'winner must be 1 or 2' });
    }

    const result = eloService.calculateSingles(
      Number(player1Elo),
      Number(player2Elo),
      winner,
      player1Games,
      player2Games
    );
    const winProbability = eloService.predictWinProbability(
      Number(player1Elo),
      Number(player2Elo)
    );

    return res.status(200).json({
      success: true,
      data: {
        player1: {
          oldElo: Number(player1Elo),
          newElo: result.player1NewElo,
          change: result.player1NewElo - Number(player1Elo),
          tier: eloService.getRatingTier(result.player1NewElo),
        },
        player2: {
          oldElo: Number(player2Elo),
          newElo: result.player2NewElo,
          change: result.player2NewElo - Number(player2Elo),
          tier: eloService.getRatingTier(result.player2NewElo),
        },
        matchPrediction: {
          ...winProbability,
          interpretation: eloService.interpretEloDifference(
            Number(player1Elo) - Number(player2Elo)
          ),
        },
      },
    });
  }

  /** POST /api/elo/doubles */
  calculateDoubles(req: Request, res: Response): Response {
    const { team1Elos, team2Elos, winner, team1Games, team2Games } = req.body;

    if (!Array.isArray(team1Elos) || team1Elos.length !== 2) {
      return res
        .status(400)
        .json({ error: 'Bad Request', message: 'team1Elos must be an array of 2 numbers' });
    }
    if (!Array.isArray(team2Elos) || team2Elos.length !== 2) {
      return res
        .status(400)
        .json({ error: 'Bad Request', message: 'team2Elos must be an array of 2 numbers' });
    }
    if (winner !== 1 && winner !== 2) {
      return res.status(400).json({ error: 'Bad Request', message: 'winner must be 1 or 2' });
    }

    const result = eloService.calculateDoubles(
      [Number(team1Elos[0]), Number(team1Elos[1])],
      [Number(team2Elos[0]), Number(team2Elos[1])],
      winner,
      team1Games,
      team2Games
    );

    const team1Avg = (Number(team1Elos[0]) + Number(team1Elos[1])) / 2;
    const team2Avg = (Number(team2Elos[0]) + Number(team2Elos[1])) / 2;
    const winProbability = eloService.predictWinProbability(team1Avg, team2Avg);

    const buildTeam = (oldElos: number[], newElos: [number, number]) => ({
      players: oldElos.map((oldElo, i) => ({
        oldElo: Number(oldElo),
        newElo: newElos[i],
        change: newElos[i] - Number(oldElo),
        tier: eloService.getRatingTier(newElos[i]),
      })),
      avgElo: {
        old: (Number(oldElos[0]) + Number(oldElos[1])) / 2,
        new: (newElos[0] + newElos[1]) / 2,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        team1: buildTeam(team1Elos, result.team1NewElos),
        team2: buildTeam(team2Elos, result.team2NewElos),
        matchPrediction: {
          team1WinProbability: winProbability.player1WinProbability,
          team2WinProbability: winProbability.player2WinProbability,
          interpretation: eloService.interpretEloDifference(team1Avg - team2Avg),
        },
      },
    });
  }

  /** POST /api/elo/predict */
  predictWinProbability(req: Request, res: Response): Response {
    const { player1Elo, player2Elo } = req.body;

    if (player1Elo == null || player2Elo == null) {
      return res
        .status(400)
        .json({ error: 'Bad Request', message: 'player1Elo and player2Elo are required' });
    }

    const eloDiff = Number(player1Elo) - Number(player2Elo);

    return res.status(200).json({
      success: true,
      data: {
        player1Elo: Number(player1Elo),
        player2Elo: Number(player2Elo),
        eloDifference: eloDiff,
        interpretation: eloService.interpretEloDifference(eloDiff),
        prediction: eloService.predictWinProbability(Number(player1Elo), Number(player2Elo)),
      },
    });
  }

  /** GET /api/elo/tier/:elo */
  getRatingTier(req: Request, res: Response): Response {
    const elo = Number(req.params.elo);
    if (Number.isNaN(elo)) {
      return res.status(400).json({ error: 'Bad Request', message: 'elo must be a number' });
    }
    return res.status(200).json({
      success: true,
      data: { currentElo: elo, tier: eloService.getRatingTier(elo) },
    });
  }
}

export const eloController = new EloController();
