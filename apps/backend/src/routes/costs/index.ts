import { Router } from "express";
import {
  calculateRecipeCost,
  createOtherCosts,
  getOtherCosts,
  updateOtherCosts,
  deleteOtherCosts
} from "../../controllers/cost/costController";

const router = Router();

// 🔥 COSTOS DE RECETA
router.post("/recipe/:id", calculateRecipeCost);

// 🔥 OTROS COSTOS
router.post("/others", createOtherCosts);
router.get("/others", getOtherCosts);
router.put("/others/:id", updateOtherCosts);
router.delete("/others/:id", deleteOtherCosts);

export default router;