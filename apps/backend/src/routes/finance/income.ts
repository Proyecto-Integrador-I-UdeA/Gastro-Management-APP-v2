import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { getSummary } from '../../controllers/finance/incomeController';

const router = Router();

router.get('/summary', authenticate, getSummary);

export default router;