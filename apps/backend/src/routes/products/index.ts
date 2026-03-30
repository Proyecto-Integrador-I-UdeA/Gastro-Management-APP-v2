import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../controllers/product/productController';

const router = Router();

router.get('/', authenticate, authorize(['products.read']), listProducts);
router.get('/:id', authenticate, authorize(['products.read']), getProductById);
router.post('/', authenticate, authorize(['products.create']), createProduct);
router.put('/:id', authenticate, authorize(['products.update']), updateProduct);
router.patch('/:id', authenticate, authorize(['products.update']), updateProduct);
router.delete('/:id', authenticate, authorize(['products.delete']), deleteProduct);

export default router;
