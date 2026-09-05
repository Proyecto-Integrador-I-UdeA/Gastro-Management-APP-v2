import { Router } from 'express';
import {
  createCategory,
  listCategories,
  updateCategory,
} from '../../controllers/menu/menuCategoryController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, authorize(['menu.read']), listCategories);
router.post('/', authenticate, authorize(['menu.manage']), createCategory);
router.patch('/:id', authenticate, authorize(['menu.manage']), updateCategory);

export default router;

