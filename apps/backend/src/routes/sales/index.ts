import { Router } from 'express';
import { listSalesMenuCatalog } from '../../controllers/sales/salesMenuCatalogController';
import {
  addOrderItem,
  addOrderItemAddition,
  cancelOrder,
  createTable,
  deleteOrderItem,
  deliverDispatch,
  getActiveOrder,
  getOrder,
  listTables,
  listReadyPickups,
  openTable,
  requestBill,
  sendOrderToKitchen,
  updateGuestCount,
  updateOrderItem,
  updateTable,
} from '../../controllers/sales/salesOrderController';
import { authenticate, authorize } from '../../middlewares/auth';
import { getAnalytics } from '../../controllers/sales/salesAnalyticsController';
import {
  cancel as cancelReservation,
  complete as completeReservation,
  confirm as confirmReservation,
  create as createReservation,
  detail as getReservation,
  list as listReservations,
  references as getReservationReferences,
  reschedule as rescheduleReservation,
  summary as getReservationSummary,
  update as updateReservation,
} from '../../controllers/sales/reservationController';

const router = Router();

router.get('/analytics', authenticate, authorize(['reports.read']), getAnalytics);

router.get('/reservations', authenticate, authorize(['reservations.read']), listReservations);
router.get('/reservations/summary', authenticate, authorize(['reservations.read']), getReservationSummary);
router.get('/reservations/references', authenticate, authorize(['reservations.manage']), getReservationReferences);
router.get('/reservations/:id', authenticate, authorize(['reservations.read']), getReservation);
router.post('/reservations', authenticate, authorize(['reservations.manage']), createReservation);
router.patch('/reservations/:id', authenticate, authorize(['reservations.manage']), updateReservation);
router.post('/reservations/:id/confirm', authenticate, authorize(['reservations.manage']), confirmReservation);
router.post('/reservations/:id/reschedule', authenticate, authorize(['reservations.manage']), rescheduleReservation);
router.post('/reservations/:id/cancel', authenticate, authorize(['reservations.manage']), cancelReservation);
router.post('/reservations/:id/complete', authenticate, authorize(['reservations.manage']), completeReservation);

router.get(
  '/menu-catalog',
  authenticate,
  authorize(['sales.read']),
  listSalesMenuCatalog,
);

router.get('/tables', authenticate, authorize(['sales.read']), listTables);
router.get(
  '/kitchen-ready-pickups',
  authenticate,
  authorize(['sales.read']),
  listReadyPickups,
);
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
router.post(
  '/orders/:orderId/send-to-kitchen',
  authenticate,
  authorize(['sales.manage']),
  sendOrderToKitchen,
);
router.post(
  '/orders/:orderId/kitchen-dispatches/:dispatchId/deliver',
  authenticate,
  authorize(['sales.manage']),
  deliverDispatch,
);
router.post(
  '/orders/:orderId/cancel',
  authenticate,
  authorize(['sales.manage']),
  cancelOrder,
);

export default router;
