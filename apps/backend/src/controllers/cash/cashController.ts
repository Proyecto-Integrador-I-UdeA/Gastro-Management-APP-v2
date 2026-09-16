import { CashPaymentMethod } from '@prisma/client';
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  closeCashSessionSchema,
  dateQuerySchema,
  openCashSessionSchema,
  orderParamSchema,
  paymentSchema,
  preInvoiceSchema,
  serviceConfigSchema,
} from '../../schemas/cashSchema';
import {
  cashDashboard,
  closeCashSession,
  generateCashPreInvoice,
  getCashServiceConfig,
  getOpenCashSession,
  getCashSessionReconciliation,
  listDailyCashSales,
  listPendingCashOrders,
  listCashSessionHistory,
  openCashSession,
  registerCashPayment,
  requestCashAccount,
  settleCashOrder,
  updateCashServiceConfig,
} from '../../services/cash/cashService';
import { SalesOperationError } from '../../services/sales/salesOrderService';

function actorId(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user.id;
}

function parse<T>(schema: z.ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({ error: 'Solicitud de Caja inválida', details: result.error?.issues });
    return null;
  }
  return result.data;
}

function handle(error: unknown, res: Response) {
  if (error instanceof SalesOperationError) return res.status(error.status).json({ error: error.message, code: error.code, ...error.details });
  console.error('Error de Caja:', error);
  return res.status(500).json({ error: 'Error interno de Caja', code: 'INTERNAL_ERROR' });
}

export async function getDashboard(req: AuthenticatedRequest, res: Response) {
  const input = parse(dateQuerySchema, req.query, res); if (!input) return;
  const permissions = new Set((req.user?.permissions ?? []).map(permission => permission.trim().toLowerCase()));
  try { return res.json(await cashDashboard({ reports: permissions.has('cash.reports'), configure: permissions.has('cash.configure') }, input.date)); } catch (error) { return handle(error, res); }
}

export async function getConfig(_req: AuthenticatedRequest, res: Response) {
  try { return res.json(await getCashServiceConfig()); } catch (error) { return handle(error, res); }
}

export async function putConfig(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const input = parse(serviceConfigSchema, req.body, res); if (!input) return;
  try { return res.json(await updateCashServiceConfig(input.servicePercent, actor)); } catch (error) { return handle(error, res); }
}

export async function getSession(_req: AuthenticatedRequest, res: Response) {
  try { return res.json(await getOpenCashSession()); } catch (error) { return handle(error, res); }
}

export async function sessionReconciliation(req: AuthenticatedRequest, res: Response) {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return res.status(400).json({ error: 'La sesión de Caja no es válida' });
  try { return res.json(await getCashSessionReconciliation(sessionId)); } catch (error) { return handle(error, res); }
}

export async function openSession(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const input = parse(openCashSessionSchema, req.body, res); if (!input) return;
  try { return res.status(201).json(await openCashSession(input, actor)); } catch (error) { return handle(error, res); }
}

export async function closeSession(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return res.status(400).json({ error: 'La sesión de Caja no es válida' });
  const input = parse(closeCashSessionSchema, req.body, res); if (!input) return;
  try { return res.json(await closeCashSession(sessionId, input.countedCash, actor)); } catch (error) { return handle(error, res); }
}

export async function listPending(_req: AuthenticatedRequest, res: Response) {
  try { return res.json({ orders: await listPendingCashOrders() }); } catch (error) { return handle(error, res); }
}

export async function requestAccount(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const parsed = parse(orderParamSchema, { orderId: req.params.orderId }, res); if (!parsed) return;
  try { return res.json(await requestCashAccount(parsed.orderId, actor)); } catch (error) { return handle(error, res); }
}

export async function createPreInvoice(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const params = parse(orderParamSchema, { orderId: req.params.orderId }, res);
  const input = parse(preInvoiceSchema, req.body, res); if (!params || !input) return;
  try { return res.status(201).json(await generateCashPreInvoice(params.orderId, input.serviceAccepted, actor)); } catch (error) { return handle(error, res); }
}

export async function createPayment(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const input = parse(paymentSchema, req.body, res); if (!input) return;
  try { return res.status(201).json(await registerCashPayment({ ...input, method: input.method as CashPaymentMethod }, actor)); } catch (error) { return handle(error, res); }
}

export async function settleOrder(req: AuthenticatedRequest, res: Response) {
  const actor = actorId(req, res); if (actor === null) return;
  const params = parse(orderParamSchema, { orderId: req.params.orderId }, res); if (!params) return;
  try { return res.json(await settleCashOrder(params.orderId, actor)); } catch (error) { return handle(error, res); }
}

export async function dailySales(req: AuthenticatedRequest, res: Response) {
  const input = parse(dateQuerySchema, { date: req.query.date }, res); if (!input) return;
  try { return res.json(await listDailyCashSales(input.date)); } catch (error) { return handle(error, res); }
}

export async function sessionHistory(_req: AuthenticatedRequest, res: Response) {
  try { return res.json({ sessions: await listCashSessionHistory() }); } catch (error) { return handle(error, res); }
}
