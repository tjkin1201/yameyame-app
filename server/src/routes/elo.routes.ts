import { Router } from 'express';
import { eloController } from '../controllers/elo.controller';

const router = Router();

router.post('/singles', (req, res) => eloController.calculateSingles(req, res));
router.post('/doubles', (req, res) => eloController.calculateDoubles(req, res));
router.post('/predict', (req, res) => eloController.predictWinProbability(req, res));
router.get('/tier/:elo', (req, res) => eloController.getRatingTier(req, res));

export default router;
