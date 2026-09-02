import { Router } from "express";
import {
  calculateRecipeCost,
  createOtherCosts,
  getOtherCosts,
  updateOtherCosts,
  deleteOtherCosts,
  calculateMenuItemCost, 

  createVariableCosts,
  getVariableCosts,
  updateVariableCosts,
  deleteVariableCosts,
  createCostCategories,
  getCostCategories,
  updateCostCategories,
  deleteCostCategories,
} from "../../controllers/cost/costController"; 

const router = Router();

// 🔥 COSTOS DE RECETA
router.get("/recipe/:id", calculateRecipeCost);
// 🔥 COSTOS DE PLATO
router.get("/menu-item/:id", calculateMenuItemCost);

// 🔥 OTROS COSTOS
router.post("/others", createOtherCosts);
router.get("/others", getOtherCosts);
router.put("/others/:id", updateOtherCosts);
router.delete("/others/:id", deleteOtherCosts);

router.post("/variables", createVariableCosts);

router.get("/variables", getVariableCosts);

router.put("/variables/:id", updateVariableCosts);

router.delete("/variables/:id", deleteVariableCosts);
router.post(
  "/categories",
  createCostCategories
);

router.get(
  "/categories",
  getCostCategories
);

router.put(
  "/categories/:id",
  updateCostCategories
);

router.delete(
  "/categories/:id",
  deleteCostCategories
);

export default router;