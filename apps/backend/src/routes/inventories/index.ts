import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { listInventories } from '../../controllers/inventory/inventoryController';

const router = Router();

router.get('/', authenticate, authorize(['inventory.read']), listInventories);

export default router;
