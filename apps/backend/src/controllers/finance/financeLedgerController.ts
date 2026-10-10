import { Request, Response } from 'express';
import {
  createFinanceLedgerPaymentSchema,
  createFinanceLedgerSchema,
  listFinanceLedgerQuerySchema,
  updateFinanceLedgerSchema,
} from '../../schemas/financeLedgerSchema';
import {
  createFinanceLedger,
  createFinanceLedgerPayment,
  deleteFinanceLedger,
  DuplicateFinanceLedgerError,
  FinanceLedgerNotFoundError,
  InvalidFinanceLedgerError,
  listFinanceLedger,
  updateFinanceLedger,
} from '../../services/finance/financeLedgerService';

function parseDocumentId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleLedgerError(error: unknown, res: Response) {
  if (error instanceof DuplicateFinanceLedgerError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof FinanceLedgerNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof InvalidFinanceLedgerError) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Error procesando documento financiero:', error);
  return res.status(500).json({ error: 'Error interno procesando el documento' });
}

export const listLedger = async (req: Request, res: Response) => {
  const validation = listFinanceLedgerQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Parámetros de consulta inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await listFinanceLedger(validation.data.month));
  } catch (error) {
    return handleLedgerError(error, res);
  }
};

export const createLedger = async (req: Request, res: Response) => {
  const validation = createFinanceLedgerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de documento inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.status(201).json(await createFinanceLedger(validation.data));
  } catch (error) {
    return handleLedgerError(error, res);
  }
};

export const updateLedger = async (req: Request, res: Response) => {
  const id = parseDocumentId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de documento inválido' });

  const validation = updateFinanceLedgerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de documento inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.json(await updateFinanceLedger(id, validation.data));
  } catch (error) {
    return handleLedgerError(error, res);
  }
};

export const deleteLedger = async (req: Request, res: Response) => {
  const id = parseDocumentId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de documento inválido' });

  try {
    await deleteFinanceLedger(id);
    return res.status(204).send();
  } catch (error) {
    return handleLedgerError(error, res);
  }
};

export const createLedgerPayment = async (req: Request, res: Response) => {
  const id = parseDocumentId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Id de documento inválido' });

  const validation = createFinanceLedgerPaymentSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de abono inválidos',
      details: validation.error.issues,
    });
  }

  try {
    return res.status(201).json(await createFinanceLedgerPayment(id, validation.data));
  } catch (error) {
    return handleLedgerError(error, res);
  }
};
