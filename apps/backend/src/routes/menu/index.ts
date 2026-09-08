import { Router } from "express";
import {
  createMenuItem,
  deleteMenuItemImage,
  getMenuItemById,
  listMenuItems,
  updateMenuItem,
  updateMenuItemAvailability,
} from "../../controllers/menu/menuController";
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get("/", authenticate, authorize(['menu.read']), listMenuItems);
router.patch(
  "/:id/availability",
  authenticate,
  authorize(['menu.availability.manage']),
  updateMenuItemAvailability,
);
router.get("/:id", authenticate, authorize(['menu.read']), getMenuItemById);
router.post("/", authenticate, authorize(['menu.manage']), createMenuItem);
router.put("/:id", authenticate, authorize(['menu.manage']), updateMenuItem);
router.delete("/:id/image", authenticate, authorize(['menu.manage']), deleteMenuItemImage);

export default router;
