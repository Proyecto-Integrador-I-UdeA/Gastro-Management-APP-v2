import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { getProductsInventoryRisk } from '../../controllers/reports/reportsProductInventoryController';
import { getSuppliersCatalogReport } from '../../controllers/reports/reportsSupplierCatalogController';
import { getTransfersReport } from '../../controllers/reports/reportsTransfersController';
import { getProductionReport } from '../../controllers/reports/reportsProductionController';
import { getCostsReport } from '../../controllers/reports/reportsCostsController';

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

router.get(
  '/transfers/summary',
  authenticate,
  authorize(['reports.read']),
  getTransfersReport
);

router.get(
  '/production/summary',
  authenticate,
  authorize(['reports.read']),
  getProductionReport
);

router.get(
  '/costs/summary',
  authenticate,
  authorize(['reports.read']),
  getCostsReport
);

export default router;
