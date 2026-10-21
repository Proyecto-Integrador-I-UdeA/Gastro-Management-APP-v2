import { Request, Response } from 'express';
import {
  createFinanceExpenseSchema,
  listFinanceExpensesQuerySchema,
  updateFinanceExpenseSchema,
} from '../../schemas/financeExpenseSchema';
import {
  createFinanceExpense,
  deleteFinanceExpense,
  DuplicateFinanceExpenseError,
  FinanceExpenseNotFoundError,
  InvalidFinanceExpenseError,
  listFinanceExpenses,
  updateFinanceExpense,
} from '../../services/finance/financeExpenseService';

function parseExpenseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleFinanceExpenseError(error: unknown, res: Response) {
  if (error instanceof DuplicateFinanceExpenseError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof FinanceExpenseNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof InvalidFinanceExpenseError) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Error procesando gasto financiero:', error);
  return res.status(500).json({ error: 'Error interno procesando el gasto' });
}

export const listExpenses = async (req: Request, res: Response) => {
  const validation = listFinanceExpensesQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Parámetros de consulta inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await listFinanceExpenses(validation.data.month));
  } catch (error) {
    return handleFinanceExpenseError(error, res);
  }
};

export const createExpense = async (req: Request, res: Response) => {
  const validation = createFinanceExpenseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de gasto inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.status(201).json(await createFinanceExpense(validation.data));
  } catch (error) {
    return handleFinanceExpenseError(error, res);
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  const id = parseExpenseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Id de gasto inválido' });
  }

  const validation = updateFinanceExpenseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de gasto inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await updateFinanceExpense(id, validation.data));
  } catch (error) {
    return handleFinanceExpenseError(error, res);
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  const id = parseExpenseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Id de gasto inválido' });
  }

  try {
    await deleteFinanceExpense(id);
    return res.status(204).send();
  } catch (error) {
    return handleFinanceExpenseError(error, res);
  }
};
