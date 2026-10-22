import { Router } from 'express';
import incomeRouter from './income';
import profitabilityRouter from './profitability';
import incomeStatementRouter from './incomeStatement';
import manualMovementsRouter from './manualMovements';
import transfersRouter from './transfers';
import financeDashboardRouter from './financeDashboard';

const router = Router();

router.use('/income', incomeRouter);
router.use('/profitability', profitabilityRouter);
router.use('/income-statement', incomeStatementRouter);
router.use('/movements', manualMovementsRouter);
router.use('/transfers', transfersRouter);
router.use('/dashboard', financeDashboardRouter);

export default router;