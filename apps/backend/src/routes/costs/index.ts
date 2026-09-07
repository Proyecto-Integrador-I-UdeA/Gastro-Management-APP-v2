import { Router } from "express";
import {
  calculateRecipeCost,
  createOtherCosts,
  getOtherCosts,
  updateOtherCosts,
  deleteOtherCosts,
  calculateMenuItemCost 
} from "../../controllers/cost/costController"; 
import {
  calculateSalePricePreview,
  getSalePriceHistory,
  publishSalePrice,
} from '../../controllers/cost/salePriceController';
import { authenticate, authorize, authorizeAny } from '../../middlewares/auth';

const router = Router();

// 🔥 COSTOS DE RECETA
router.get(
  "/recipe/:id",
  authenticate,
  authorizeAny(['costs.read', 'menu.manage']),
  calculateRecipeCost,
);
// 🔥 COSTOS DE PLATO
router.get(
  "/menu-item/:id",
  authenticate,
  authorize(['costs.read']),
  calculateMenuItemCost,
);

router.post(
  '/menu-items/:menuItemId/sale-price/calculate',
  authenticate,
  authorize(['costs.prices.read']),
  calculateSalePricePreview,
);
router.post(
  '/menu-items/:menuItemId/sale-price',
  authenticate,
  authorize(['costs.prices.manage']),
  publishSalePrice,
);
router.get(
  '/menu-items/:menuItemId/sale-prices',
  authenticate,
  authorize(['costs.prices.read']),
  getSalePriceHistory,
);

// 🔥 OTROS COSTOS
router.post("/others", authenticate, authorize(['costs.update']), createOtherCosts);
router.get("/others", authenticate, authorize(['costs.read']), getOtherCosts);
router.put("/others/:id", authenticate, authorize(['costs.update']), updateOtherCosts);
router.delete("/others/:id", authenticate, authorize(['costs.update']), deleteOtherCosts);

export default router;
