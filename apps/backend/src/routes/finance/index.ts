import { Router } from 'express';

// ─── Ingresos, Rentabilidad, Movimientos, Transferencias, Dashboard ─────
import incomeRouter from './income';
import profitabilityRouter from './profitability';
import incomeStatementRouter from './incomeStatement';
import manualMovementsRouter from './manualMovements';
import transfersRouter from './transfers';
import financeDashboardRouter from './financeDashboard';

// ─── Gastos, Ledger, Empleados, Nómina (compañero) ──────────────────────
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
import {
  closePayroll,
  createEmployee,
  deleteEmployee,
  deletePayrollEntry,
  generatePayroll,
  listEmployees,
  listPayroll,
  reopenPayroll,
  updateEmployee,
  updatePayrollEntry,
} from '../../controllers/finance/financePayrollController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

// ─── Rutas HU1-HU5  ────────────────────────────────────────
router.use('/income', incomeRouter);
router.use('/profitability', profitabilityRouter);
router.use('/income-statement', incomeStatementRouter);
router.use('/movements', manualMovementsRouter);
router.use('/transfers', transfersRouter);
router.use('/dashboard', financeDashboardRouter);

// ─── (Gastos) ──────────────────────────────────────
router.get('/expenses', authenticate, authorize(['accounting.read']), listExpenses);
router.post('/expenses', authenticate, authorize(['accounting.update']), createExpense);
router.put('/expenses/:id', authenticate, authorize(['accounting.update']), updateExpense);
router.delete('/expenses/:id', authenticate, authorize(['accounting.update']), deleteExpense);

// ───  (Ledger) ──────────────────────────────────────
router.get('/ledger', authenticate, authorize(['accounting.read']), listLedger);
router.post('/ledger', authenticate, authorize(['accounting.update']), createLedger);
router.put('/ledger/:id', authenticate, authorize(['accounting.update']), updateLedger);
router.delete('/ledger/:id', authenticate, authorize(['accounting.update']), deleteLedger);
router.post('/ledger/:id/payments', authenticate, authorize(['accounting.update']), createLedgerPayment);

// ─── (Empleados) ───────────────────────────────────
router.get('/employees', authenticate, authorize(['accounting.read']), listEmployees);
router.post('/employees', authenticate, authorize(['accounting.update']), createEmployee);
router.put('/employees/:id', authenticate, authorize(['accounting.update']), updateEmployee);
router.delete('/employees/:id', authenticate, authorize(['accounting.update']), deleteEmployee);

// ─── (Nómina) ──────────────────────────────────────
router.get('/payroll', authenticate, authorize(['accounting.read']), listPayroll);
router.post('/payroll/generate', authenticate, authorize(['accounting.update']), generatePayroll);
router.put('/payroll/entries/:id', authenticate, authorize(['accounting.update']), updatePayrollEntry);
router.delete('/payroll/entries/:id', authenticate, authorize(['accounting.update']), deletePayrollEntry);
router.post('/payroll/:id/close', authenticate, authorize(['accounting.update']), closePayroll);
router.post('/payroll/:id/reopen', authenticate, authorize(['accounting.update']), reopenPayroll);

export default router;