import { Router } from 'express';
import { authenticate, authorize, authorizeAny } from '../../middlewares/auth';
import {
  listWarehouse,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
} from '../../controllers/warehouse/warehouseController';

const router = Router();

// Lectura: módulo bodegas o traslados (elegir origen/destino).
router.get(
  '/',
  authenticate,
  authorizeAny(['warehouse.read', 'transfers.read']),
  listWarehouse
);
router.get(
  '/:id',
  authenticate,
  authorizeAny(['warehouse.read', 'transfers.read']),
  getWarehouseById
);
// Alta: quien gestiona bodegas o quien registra traslados puede crear ubicaciones al vuelo.
router.post(
  '/',
  authenticate,
  authorizeAny(['warehouse.create', 'transfers.create']),
  createWarehouse
);
router.put('/:id', authenticate, authorize(['warehouse.update']), updateWarehouse);

export default router;
