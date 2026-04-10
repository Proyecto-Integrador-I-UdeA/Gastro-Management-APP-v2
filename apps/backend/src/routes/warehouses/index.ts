import { Router } from 'express';
import { authenticate, authorize, authorizeAny } from '../../middlewares/auth';
import {
  listWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
} from '../../controllers/warehouse/warehouseController';

const router = Router();

// Lectura: módulo bodegas o traslados (elegir origen/destino).
router.get(
  '/',
  authenticate,
  authorizeAny(['warehouses.read', 'transfers.read']),
  listWarehouses
);
router.get(
  '/:id',
  authenticate,
  authorizeAny(['warehouses.read', 'transfers.read']),
  getWarehouseById
);
// Alta: quien gestiona bodegas o quien registra traslados puede crear ubicaciones al vuelo.
router.post(
  '/',
  authenticate,
  authorizeAny(['warehouses.create', 'transfers.create']),
  createWarehouse
);
router.put('/:id', authenticate, authorize(['warehouses.update']), updateWarehouse);

export default router;
