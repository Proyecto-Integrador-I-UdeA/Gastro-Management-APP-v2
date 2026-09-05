import { Router } from "express";
import { createMenuItem, listMenuItems, updateMenuItem, getMenuItemById } from "../../controllers/menu/menuController";
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get("/", authenticate, authorize(['menu.read']), listMenuItems);
router.get("/:id", authenticate, authorize(['menu.read']), getMenuItemById);
router.post("/", authenticate, authorize(['menu.manage']), createMenuItem);
router.put("/:id", authenticate, authorize(['menu.manage']), updateMenuItem);

export default router;
