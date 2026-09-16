import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import {
  closeSession,
  createPayment,
  createPreInvoice,
  dailySales,
  getConfig,
  getDashboard,
  getSession,
  listPending,
  openSession,
  putConfig,
  requestAccount,
  settleOrder,
  sessionHistory,
  sessionReconciliation,
} from '../../controllers/cash/cashController';

const router = Router();

router.get('/dashboard', authenticate, authorize(['cash.read']), getDashboard);
router.get('/config/service', authenticate, authorize(['cash.configure']), getConfig);
router.put('/config/service', authenticate, authorize(['cash.configure']), putConfig);
router.get('/session', authenticate, authorize(['cash.read']), getSession);
router.get('/sessions/history', authenticate, authorize(['cash.reports']), sessionHistory);
router.get('/session/:sessionId/reconciliation', authenticate, authorize(['cash.operate']), sessionReconciliation);
router.post('/session', authenticate, authorize(['cash.operate']), openSession);
router.post('/session/:sessionId/close', authenticate, authorize(['cash.operate']), closeSession);
router.get('/pending', authenticate, authorize(['cash.read']), listPending);
router.get('/daily-sales', authenticate, authorize(['cash.reports']), dailySales);
router.post('/orders/:orderId/account', authenticate, authorize(['cash.operate']), requestAccount);
router.post('/orders/:orderId/pre-invoices', authenticate, authorize(['cash.operate']), createPreInvoice);
router.post('/payments', authenticate, authorize(['cash.operate']), createPayment);
router.post('/orders/:orderId/settle', authenticate, authorize(['cash.operate']), settleOrder);

export default router;
