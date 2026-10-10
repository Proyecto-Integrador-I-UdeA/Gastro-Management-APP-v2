import { Router } from 'express';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from '../../controllers/finance/financeExpenseController';
import {
  createLedger,
  createLedgerPayment,
  deleteLedger,
  listLedger,
  updateLedger,
} from '../../controllers/finance/financeLedgerController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get('/expenses', authenticate, authorize(['accounting.read']), listExpenses);
router.post('/expenses', authenticate, authorize(['accounting.update']), createExpense);
router.put('/expenses/:id', authenticate, authorize(['accounting.update']), updateExpense);
router.delete('/expenses/:id', authenticate, authorize(['accounting.update']), deleteExpense);

router.get('/ledger', authenticate, authorize(['accounting.read']), listLedger);
router.post('/ledger', authenticate, authorize(['accounting.update']), createLedger);
router.put('/ledger/:id', authenticate, authorize(['accounting.update']), updateLedger);
router.delete('/ledger/:id', authenticate, authorize(['accounting.update']), deleteLedger);
router.post('/ledger/:id/payments', authenticate, authorize(['accounting.update']), createLedgerPayment);

export default router;
