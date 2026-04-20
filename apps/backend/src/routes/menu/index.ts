import { Router } from "express";
import { createMenuItem, listMenuItems, updateMenuItem, getMenuItemById } from "../../controllers/menu/menuController";

const router = Router();

router.get("/", listMenuItems);
router.get("/:id", getMenuItemById);
router.post("/", createMenuItem);
router.put("/:id", updateMenuItem);

export default router;