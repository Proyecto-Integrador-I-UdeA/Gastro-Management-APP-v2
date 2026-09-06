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
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// 🔥 COSTOS DE RECETA
router.get("/recipe/:id", calculateRecipeCost);
// 🔥 COSTOS DE PLATO
router.get("/menu-item/:id", calculateMenuItemCost);

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
router.post("/others", createOtherCosts);
router.get("/others", getOtherCosts);
router.put("/others/:id", updateOtherCosts);
router.delete("/others/:id", deleteOtherCosts);

export default router;
