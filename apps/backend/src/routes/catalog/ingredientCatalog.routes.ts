import { Router } from "express";
import { listIngredientCatalog, createIngredientCatalog, } from "../../controllers/catalog/ingredientCatalogController";

const router = Router();

router.get("/", listIngredientCatalog);
router.post("/", createIngredientCatalog);

export default router;