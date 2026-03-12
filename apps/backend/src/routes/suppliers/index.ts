import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../controllers/supplier/supplierController';

const router = Router();

router.get('/', authenticate, authorize(['suppliers:read']), listSuppliers);
router.get('/:id', authenticate, authorize(['suppliers:read']), getSupplierById);
router.post('/', authenticate, authorize(['suppliers:create']), createSupplier);
router.put('/:id', authenticate, authorize(['suppliers:update']), updateSupplier);
router.delete('/:id', authenticate, authorize(['suppliers:delete']), deleteSupplier);

export default router;
