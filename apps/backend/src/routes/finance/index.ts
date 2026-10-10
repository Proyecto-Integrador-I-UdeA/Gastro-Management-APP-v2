import { Router } from 'express';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from '../../controllers/finance/financeExpenseController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get('/expenses', authenticate, authorize(['accounting.read']), listExpenses);
router.post('/expenses', authenticate, authorize(['accounting.update']), createExpense);
router.put('/expenses/:id', authenticate, authorize(['accounting.update']), updateExpense);
router.delete('/expenses/:id', authenticate, authorize(['accounting.update']), deleteExpense);

export default router;
