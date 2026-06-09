import { Router } from 'express';
import { matchingController } from '../controllers/matching.controller';

const router = Router();

router.post('/generate', (req, res) => matchingController.generate(req, res));

export default router;
