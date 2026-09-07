import { Router } from 'express';
import { listSalesMenuCatalog } from '../../controllers/sales/salesMenuCatalogController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get(
  '/menu-catalog',
  authenticate,
  authorize(['sales.read']),
  listSalesMenuCatalog,
);

export default router;
