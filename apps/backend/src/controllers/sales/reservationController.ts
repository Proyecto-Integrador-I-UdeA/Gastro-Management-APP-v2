import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  cancelReservationSchema,
  createReservationSchema,
  emptyReservationActionSchema,
  reservationIdSchema,
  reservationSearchSchema,
  rescheduleReservationSchema,
  updateReservationSchema,
} from '../../schemas/reservationSchema';
import {
  cancelReservation,
  completeReservation,
  confirmReservation,
  createReservation,
  getReservation,
  getReservationReferences,
  getReservationSummary,
  listReservations,
  ReservationOperationError,
  rescheduleReservation,
  updateReservation,
} from '../../services/sales/reservationService';

function parse<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({
      error: 'Solicitud de reservas inválida',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function reservationId(req: AuthenticatedRequest, res: Response) {
  return parse(reservationIdSchema, req.params.id, res);
}

function actorId(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user.id;
}

function handle(error: unknown, res: Response) {
  if (error instanceof ReservationOperationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando reservas y eventos:', error);
  return res.status(500).json({ error: 'Error interno procesando reservas', code: 'INTERNAL_ERROR' });
}

export async function list(req: AuthenticatedRequest, res: Response) {
  const query = parse(reservationSearchSchema, req.query, res);
  if (!query) return;
  try {
    return res.json({ reservations: await listReservations(query.search) });
  } catch (error) {
    return handle(error, res);
  }
}

export async function summary(_req: AuthenticatedRequest, res: Response) {
  try {
    return res.json(await getReservationSummary());
  } catch (error) {
    return handle(error, res);
  }
}

export async function references(_req: AuthenticatedRequest, res: Response) {
  try {
    return res.json(await getReservationReferences());
  } catch (error) {
    return handle(error, res);
  }
}

export async function detail(req: AuthenticatedRequest, res: Response) {
  const id = reservationId(req, res);
  if (id === null) return;
  try {
    return res.json(await getReservation(id));
  } catch (error) {
    return handle(error, res);
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  const input = parse(createReservationSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (!input || actor === null) return;
  try {
    return res.status(201).json(await createReservation(input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const id = reservationId(req, res);
  const input = parse(updateReservationSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (id === null || !input || actor === null) return;
  try {
    return res.json(await updateReservation(id, input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function confirm(req: AuthenticatedRequest, res: Response) {
  return emptyAction(req, res, confirmReservation);
}

export async function complete(req: AuthenticatedRequest, res: Response) {
  return emptyAction(req, res, completeReservation);
}

async function emptyAction(
  req: AuthenticatedRequest,
  res: Response,
  action: (id: number, actorId: number) => Promise<unknown>,
) {
  const id = reservationId(req, res);
  const input = parse(emptyReservationActionSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (id === null || !input || actor === null) return;
  try {
    return res.json(await action(id, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function reschedule(req: AuthenticatedRequest, res: Response) {
  const id = reservationId(req, res);
  const input = parse(rescheduleReservationSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (id === null || !input || actor === null) return;
  try {
    return res.json(await rescheduleReservation(id, input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response) {
  const id = reservationId(req, res);
  const input = parse(cancelReservationSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (id === null || !input || actor === null) return;
  try {
    return res.json(await cancelReservation(id, input.reason, actor));
  } catch (error) {
    return handle(error, res);
  }
}
