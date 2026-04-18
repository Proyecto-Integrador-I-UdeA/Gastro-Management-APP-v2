import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { getProductsInventoryRisk } from '../../controllers/reports/reportsProductInventoryController';
import { getSuppliersCatalogReport } from '../../controllers/reports/reportsSupplierCatalogController';

const router = Router();

router.get(
  '/products/inventory-risk',
  authenticate,
  authorize(['reports.read']),
  getProductsInventoryRisk
);

router.get(
  '/suppliers/catalog',
  authenticate,
  authorize(['reports.read']),
  getSuppliersCatalogReport
);

export default router;
