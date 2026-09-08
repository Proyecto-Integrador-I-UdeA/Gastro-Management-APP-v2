import { Router } from 'express';
import { listSalesMenuCatalog } from '../../controllers/sales/salesMenuCatalogController';
import {
  addOrderItem,
  addOrderItemAddition,
  createTable,
  deleteOrderItem,
  getActiveOrder,
  getOrder,
  listTables,
  openTable,
  requestBill,
  updateGuestCount,
  updateOrderItem,
  updateTable,
} from '../../controllers/sales/salesOrderController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get(
  '/menu-catalog',
  authenticate,
  authorize(['sales.read']),
  listSalesMenuCatalog,
);

router.get('/tables', authenticate, authorize(['sales.read']), listTables);
router.post('/tables', authenticate, authorize(['sales.tables.manage']), createTable);
router.patch('/tables/:tableId', authenticate, authorize(['sales.tables.manage']), updateTable);
router.post('/tables/:tableId/orders', authenticate, authorize(['sales.manage']), openTable);
router.get(
  '/tables/:tableId/active-order',
  authenticate,
  authorize(['sales.read']),
  getActiveOrder,
);
router.get('/orders/:orderId', authenticate, authorize(['sales.read']), getOrder);
router.post('/orders/:orderId/items', authenticate, authorize(['sales.manage']), addOrderItem);
router.post(
  '/orders/:orderId/items/:itemId/additions',
  authenticate,
  authorize(['sales.manage']),
  addOrderItemAddition,
);
router.patch(
  '/orders/:orderId/items/:itemId',
  authenticate,
  authorize(['sales.manage']),
  updateOrderItem,
);
router.delete(
  '/orders/:orderId/items/:itemId',
  authenticate,
  authorize(['sales.manage']),
  deleteOrderItem,
);
router.patch(
  '/orders/:orderId/guest-count',
  authenticate,
  authorize(['sales.manage']),
  updateGuestCount,
);
router.post(
  '/orders/:orderId/request-bill',
  authenticate,
  authorize(['sales.manage']),
  requestBill,
);

export default router;
