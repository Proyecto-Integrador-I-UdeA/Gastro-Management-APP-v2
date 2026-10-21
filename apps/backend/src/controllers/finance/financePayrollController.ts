import { Request, Response } from 'express';
import {
  createFinanceEmployeeSchema,
  generateFinancePayrollSchema,
  listFinancePayrollQuerySchema,
  updateFinanceEmployeeSchema,
  updateFinancePayrollEntrySchema,
} from '../../schemas/financePayrollSchema';
import {
  closeFinancePayroll,
  createFinanceEmployee,
  deleteFinanceEmployee,
  deleteFinancePayrollEntry,
  DuplicateFinanceEmployeeError,
  FinanceEmployeeNotFoundError,
  FinancePayrollNotFoundError,
  generateFinancePayroll,
  getFinancePayroll,
  InvalidFinancePayrollError,
  listFinanceEmployees,
  reopenFinancePayroll,
  updateFinanceEmployee,
  updateFinancePayrollEntry,
} from '../../services/finance/financePayrollService';

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handlePayrollError(error: unknown, res: Response) {
  if (error instanceof DuplicateFinanceEmployeeError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof FinanceEmployeeNotFoundError || error instanceof FinancePayrollNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof InvalidFinancePayrollError) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Error procesando nómina:', error);
  return res.status(500).json({ error: 'Error interno procesando la nómina' });
}

export const listEmployees = async (_req: Request, res: Response) => {
  try {
    return res.json(await listFinanceEmployees());
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  const validation = createFinanceEmployeeSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de colaborador inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.status(201).json(await createFinanceEmployee(validation.data));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de colaborador inválido' });

  const validation = updateFinanceEmployeeSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de colaborador inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await updateFinanceEmployee(id, validation.data));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de colaborador inválido' });

  try {
    await deleteFinanceEmployee(id);
    return res.status(204).send();
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const listPayroll = async (req: Request, res: Response) => {
  const validation = listFinancePayrollQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Parámetros de consulta inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await getFinancePayroll(validation.data.month));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const generatePayroll = async (req: Request, res: Response) => {
  const validation = generateFinancePayrollSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de nómina inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.status(201).json(await generateFinancePayroll(validation.data.month));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const updatePayrollEntry = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de línea inválido' });

  const validation = updateFinancePayrollEntrySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de línea inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await updateFinancePayrollEntry(id, validation.data));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const deletePayrollEntry = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de línea inválido' });

  try {
    await deleteFinancePayrollEntry(id);
    return res.status(204).send();
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const closePayroll = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de nómina inválido' });

  try {
    return res.json(await closeFinancePayroll(id));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};

export const reopenPayroll = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de nómina inválido' });

  try {
    return res.json(await reopenFinancePayroll(id));
  } catch (error) {
    return handlePayrollError(error, res);
  }
};
