import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { calculateRecipeCost } from '../../controllers/cost/costController';

const router = Router();

router.post('/recipes/:id/calculate', authenticate, calculateRecipeCost);

export default router;