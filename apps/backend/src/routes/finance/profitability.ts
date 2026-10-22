import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { getSummary } from '../../controllers/finance/profitabilityController';
import { getByProduct } from '../../controllers/finance/profitabilityByProductController';

const router = Router();

router.get('/summary', authenticate, getSummary);
router.get('/by-product', authenticate, getByProduct);

export default router;