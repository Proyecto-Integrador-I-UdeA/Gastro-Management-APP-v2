import { Router } from "express";
import {
  calculateRecipeCost,
  createOtherCosts,
  getOtherCosts,
  updateOtherCosts,
  deleteOtherCosts,
  calculateMenuItemCost 
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

export default router;