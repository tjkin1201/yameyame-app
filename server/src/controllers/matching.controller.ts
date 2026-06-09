import { Request, Response } from 'express';
import { matchingService, MatchPlayer } from '../services/matching.service';

export class MatchingController {
  /** POST /api/matching/generate — 복식 균형 대진표 생성 */
  generate(req: Request, res: Response): Response {
    const { players } = req.body;

    if (!Array.isArray(players) || players.length < 4) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'players must be an array of at least 4 { id, name, elo }',
      });
    }

    for (const p of players) {
      if (!p.id || !p.name || typeof p.elo !== 'number') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'each player requires id, name, and numeric elo',
        });
      }
    }

    const result = matchingService.generateDoubles(players as MatchPlayer[]);
    return res.status(200).json({ success: true, data: result });
  }
}

export const matchingController = new MatchingController();
