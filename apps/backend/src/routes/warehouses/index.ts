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
// Nombres de permiso alineados con seed (warehouses.*), no warehouse.*.
router.get(
  '/',
  authenticate,
  authorizeAny(['warehouses.read', 'transfers.read']),
  listWarehouse
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
// Misma lógica que crear: quien gestiona traslados debe poder marcar bodega principal / activar.
router.put(
  '/:id',
  authenticate,
  authorizeAny(['warehouses.update', 'transfers.create', 'transfers.update']),
  updateWarehouse
);

export default router;
