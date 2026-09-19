import {
  Prisma,
  PrismaClient,
  ReservationHistoryAction,
  ReservationStatus,
  ReservationType,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateReservationInput,
  RescheduleReservationInput,
  UpdateReservationInput,
} from '../../schemas/reservationSchema';

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type ReservationClient = PrismaClient | Prisma.TransactionClient;

export class ReservationOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ReservationOperationError';
  }
}

const actorSelect = { id: true, fullName: true, email: true } as const;
const tableSelect = { id: true, code: true, area: true, capacity: true, active: true } as const;

const reservationListSelect = {
  id: true,
  customerName: true,
  phone: true,
  email: true,
  reservationType: true,
  scheduledAt: true,
  guestCount: true,
  preferredArea: true,
  diningTableId: true,
  reason: true,
  notes: true,
  status: true,
  isVip: true,
  confirmedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  lateCancellation: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  diningTable: { select: tableSelect },
  createdBy: { select: actorSelect },
  updatedBy: { select: actorSelect },
  confirmedBy: { select: actorSelect },
  cancelledBy: { select: actorSelect },
  completedBy: { select: actorSelect },
} satisfies Prisma.ReservationSelect;

const reservationDetailSelect = {
  ...reservationListSelect,
  history: {
    orderBy: [{ occurredAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      action: true,
      occurredAt: true,
      note: true,
      previousScheduledAt: true,
      newScheduledAt: true,
      previousStatus: true,
      newStatus: true,
      actor: { select: actorSelect },
    },
  },
} satisfies Prisma.ReservationSelect;

type ReservationListRecord = Prisma.ReservationGetPayload<{ select: typeof reservationListSelect }>;
type ReservationDetailRecord = Prisma.ReservationGetPayload<{ select: typeof reservationDetailSelect }>;

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function serializeReservation(record: ReservationListRecord) {
  return {
    ...record,
    scheduledAt: record.scheduledAt.toISOString(),
    confirmedAt: iso(record.confirmedAt),
    cancelledAt: iso(record.cancelledAt),
    completedAt: iso(record.completedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeReservationDetail(record: ReservationDetailRecord) {
  return {
    ...serializeReservation(record),
    history: record.history.map(entry => ({
      ...entry,
      occurredAt: entry.occurredAt.toISOString(),
      previousScheduledAt: iso(entry.previousScheduledAt),
      newScheduledAt: iso(entry.newScheduledAt),
    })),
  };
}

function bogotaYmd(value: Date) {
  return new Date(value.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function bogotaStart(ymd: string) {
  return new Date(`${ymd}T00:00:00.000-05:00`);
}

function addCalendarDays(ymd: string, days: number) {
  const value = new Date(`${ymd}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function todayRange(now: Date) {
  const today = bogotaYmd(now);
  return { start: bogotaStart(today), end: bogotaStart(addCalendarDays(today, 1)) };
}

function parseSearchDate(search: string) {
  let ymd: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(search)) ymd = search;
  const localMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(search);
  if (localMatch) ymd = `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  if (!ymd) return null;
  const start = bogotaStart(ymd);
  if (Number.isNaN(start.getTime()) || bogotaYmd(start) !== ymd) return null;
  return { gte: start, lt: bogotaStart(addCalendarDays(ymd, 1)) };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function matchingTypes(search: string): ReservationType[] {
  const query = normalize(search);
  const labels: Record<ReservationType, string[]> = {
    TABLE_RESERVATION: ['table_reservation', 'reserva de mesa', 'mesa'],
    PRIVATE_EVENT: ['private_event', 'evento privado', 'privado'],
    CORPORATE_EVENT: ['corporate_event', 'evento corporativo', 'corporativo'],
    OTHER: ['other', 'otro'],
  };
  return (Object.keys(labels) as ReservationType[]).filter(type => (
    labels[type].some(label => normalize(label).includes(query) || query.includes(normalize(label)))
  ));
}

function scheduledDate(value: string) {
  return new Date(value);
}

function ensureFuture(value: Date, now: Date) {
  if (value.getTime() <= now.getTime()) {
    throw new ReservationOperationError(
      'RESERVATION_MUST_BE_FUTURE',
      400,
      'La fecha y hora de la reserva debe estar en el futuro',
    );
  }
}

async function ensureAssignableTable(tableId: number | null | undefined, client: ReservationClient) {
  if (tableId === null || tableId === undefined) return;
  const table = await client.diningTable.findUnique({
    where: { id: tableId },
    select: { id: true, active: true },
  });
  if (!table) {
    throw new ReservationOperationError('DINING_TABLE_NOT_FOUND', 404, 'La mesa preferida no existe');
  }
  if (!table.active) {
    throw new ReservationOperationError(
      'DINING_TABLE_INACTIVE',
      409,
      'La mesa preferida está fuera de servicio',
    );
  }
}

async function lockReservation(transaction: Prisma.TransactionClient, reservationId: number) {
  const rows = await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "reservations" WHERE "id" = ${reservationId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new ReservationOperationError('RESERVATION_NOT_FOUND', 404, 'Reserva no encontrada');
  }
  return transaction.reservation.findUniqueOrThrow({ where: { id: reservationId } });
}

async function detailRecord(reservationId: number, client: ReservationClient) {
  const reservation = await client.reservation.findUnique({
    where: { id: reservationId },
    select: reservationDetailSelect,
  });
  if (!reservation) {
    throw new ReservationOperationError('RESERVATION_NOT_FOUND', 404, 'Reserva no encontrada');
  }
  return reservation;
}

export async function listReservations(search?: string, client: ReservationClient = prisma) {
  const trimmed = search?.trim();
  const where: Prisma.ReservationWhereInput = {};
  if (trimmed) {
    const dateRange = parseSearchDate(trimmed);
    const types = matchingTypes(trimmed);
    where.OR = [
      { customerName: { contains: trimmed, mode: 'insensitive' } },
      { reason: { contains: trimmed, mode: 'insensitive' } },
      ...(types.length > 0 ? [{ reservationType: { in: types } }] : []),
      ...(dateRange ? [{ scheduledAt: dateRange }] : []),
    ];
  }

  const reservations = await client.reservation.findMany({
    where,
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    select: reservationListSelect,
  });
  return reservations.map(serializeReservation);
}

export async function getReservationSummary(now = new Date(), client: ReservationClient = prisma) {
  const { start, end } = todayRange(now);
  const activeStatuses = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];
  const todayWhere: Prisma.ReservationWhereInput = {
    scheduledAt: { gte: start, lt: end },
    status: { in: activeStatuses },
  };
  const eventEnd = new Date(now.getTime() + 7 * DAY_MS);

  const [todayCount, committedRows, expectedGuests, upcomingEvents] = await Promise.all([
    client.reservation.count({ where: todayWhere }),
    client.reservation.findMany({
      where: { ...todayWhere, diningTableId: { not: null } },
      distinct: ['diningTableId'],
      select: { diningTableId: true },
    }),
    client.reservation.aggregate({ where: todayWhere, _sum: { guestCount: true } }),
    client.reservation.count({
      where: {
        status: ReservationStatus.CONFIRMED,
        reservationType: { not: ReservationType.TABLE_RESERVATION },
        scheduledAt: { gt: now, lte: eventEnd },
      },
    }),
  ]);

  return {
    todayReservations: todayCount,
    committedTables: committedRows.length,
    upcomingEvents,
    expectedGuests: expectedGuests._sum.guestCount ?? 0,
    generatedAt: now.toISOString(),
  };
}

export async function getReservation(reservationId: number, client: ReservationClient = prisma) {
  return serializeReservationDetail(await detailRecord(reservationId, client));
}

export async function getReservationReferences(client: ReservationClient = prisma) {
  const tables = await client.diningTable.findMany({
    orderBy: [{ area: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    select: tableSelect,
  });
  return { tables };
}

export async function createReservation(
  input: CreateReservationInput,
  actorId: number,
  now = new Date(),
) {
  const scheduledAt = scheduledDate(input.scheduledAt);
  ensureFuture(scheduledAt, now);
  await ensureAssignableTable(input.diningTableId, prisma);

  return prisma.$transaction(async transaction => {
    const confirmed = input.status === ReservationStatus.CONFIRMED;
    const reservation = await transaction.reservation.create({
      data: {
        customerName: input.customerName,
        phone: input.phone,
        email: input.email ?? null,
        reservationType: input.reservationType,
        scheduledAt,
        guestCount: input.guestCount,
        preferredArea: input.preferredArea ?? null,
        diningTableId: input.diningTableId ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        status: input.status,
        isVip: input.isVip,
        createdById: actorId,
        updatedById: actorId,
        confirmedAt: confirmed ? now : null,
        confirmedById: confirmed ? actorId : null,
      },
      select: { id: true },
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId: reservation.id,
        action: ReservationHistoryAction.CREATED,
        actorId,
        newScheduledAt: scheduledAt,
        newStatus: input.status,
      },
    });
    if (confirmed) {
      await transaction.reservationHistory.create({
        data: {
          reservationId: reservation.id,
          action: ReservationHistoryAction.CONFIRMED,
          actorId,
          previousStatus: ReservationStatus.PENDING,
          newStatus: ReservationStatus.CONFIRMED,
          note: 'Confirmada al crear la reserva',
        },
      });
    }
    return getReservation(reservation.id, transaction);
  });
}

export async function updateReservation(
  reservationId: number,
  input: UpdateReservationInput,
  actorId: number,
  now = new Date(),
) {
  return prisma.$transaction(async transaction => {
    const current = await lockReservation(transaction, reservationId);
    if (current.status !== ReservationStatus.PENDING && current.status !== ReservationStatus.CONFIRMED) {
      throw new ReservationOperationError('RESERVATION_READ_ONLY', 409, 'La reserva ya no puede editarse');
    }
    ensureFuture(current.scheduledAt, now);
    if (input.diningTableId !== undefined) await ensureAssignableTable(input.diningTableId, transaction);

    const nextScheduledAt = input.scheduledAt ? scheduledDate(input.scheduledAt) : current.scheduledAt;
    const scheduleChanged = nextScheduledAt.getTime() !== current.scheduledAt.getTime();
    if (scheduleChanged) {
      if (current.status === ReservationStatus.CONFIRMED) {
        throw new ReservationOperationError(
          'USE_RESCHEDULE_ACTION',
          409,
          'Use la acción Aplazar para cambiar la fecha de una reserva confirmada',
        );
      }
      ensureFuture(nextScheduledAt, now);
    }

    const data: Prisma.ReservationUpdateInput = {
      updatedBy: { connect: { id: actorId } },
      ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.reservationType !== undefined ? { reservationType: input.reservationType } : {}),
      ...(input.guestCount !== undefined ? { guestCount: input.guestCount } : {}),
      ...(input.preferredArea !== undefined ? { preferredArea: input.preferredArea } : {}),
      ...(input.diningTableId !== undefined
        ? input.diningTableId === null
          ? { diningTable: { disconnect: true } }
          : { diningTable: { connect: { id: input.diningTableId } } }
        : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
      ...(scheduleChanged ? { scheduledAt: nextScheduledAt } : {}),
    };
    await transaction.reservation.update({ where: { id: reservationId }, data });
    await transaction.reservationHistory.create({
      data: {
        reservationId,
        action: ReservationHistoryAction.UPDATED,
        actorId,
        note: `Campos actualizados: ${Object.keys(input).join(', ')}`,
        previousScheduledAt: scheduleChanged ? current.scheduledAt : null,
        newScheduledAt: scheduleChanged ? nextScheduledAt : null,
        previousStatus: current.status,
        newStatus: current.status,
      },
    });
    return getReservation(reservationId, transaction);
  });
}

export async function confirmReservation(reservationId: number, actorId: number, now = new Date()) {
  return prisma.$transaction(async transaction => {
    const current = await lockReservation(transaction, reservationId);
    if (current.status === ReservationStatus.CONFIRMED) return getReservation(reservationId, transaction);
    if (current.status !== ReservationStatus.PENDING) {
      throw new ReservationOperationError('INVALID_RESERVATION_TRANSITION', 409, 'La reserva no puede confirmarse');
    }
    ensureFuture(current.scheduledAt, now);
    await transaction.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CONFIRMED,
        confirmedAt: now,
        confirmedById: actorId,
        updatedById: actorId,
      },
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId,
        action: ReservationHistoryAction.CONFIRMED,
        actorId,
        previousStatus: ReservationStatus.PENDING,
        newStatus: ReservationStatus.CONFIRMED,
      },
    });
    return getReservation(reservationId, transaction);
  });
}

export async function rescheduleReservation(
  reservationId: number,
  input: RescheduleReservationInput,
  actorId: number,
  now = new Date(),
) {
  return prisma.$transaction(async transaction => {
    const current = await lockReservation(transaction, reservationId);
    if (current.status !== ReservationStatus.CONFIRMED) {
      throw new ReservationOperationError('INVALID_RESERVATION_TRANSITION', 409, 'Solo una reserva confirmada puede aplazarse');
    }
    if (current.scheduledAt.getTime() - now.getTime() < 48 * HOUR_MS) {
      throw new ReservationOperationError(
        'RESCHEDULE_WINDOW_CLOSED',
        409,
        'La reserva solo puede aplazarse con al menos 48 horas de anticipación',
      );
    }
    const nextScheduledAt = scheduledDate(input.scheduledAt);
    ensureFuture(nextScheduledAt, now);
    if (nextScheduledAt.getTime() === current.scheduledAt.getTime()) {
      throw new ReservationOperationError('SCHEDULE_UNCHANGED', 400, 'La nueva fecha debe ser diferente');
    }
    await transaction.reservation.update({
      where: { id: reservationId },
      data: { scheduledAt: nextScheduledAt, updatedById: actorId },
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId,
        action: ReservationHistoryAction.RESCHEDULED,
        actorId,
        note: input.reason ?? null,
        previousScheduledAt: current.scheduledAt,
        newScheduledAt: nextScheduledAt,
        previousStatus: ReservationStatus.CONFIRMED,
        newStatus: ReservationStatus.CONFIRMED,
      },
    });
    return getReservation(reservationId, transaction);
  });
}

export async function cancelReservation(
  reservationId: number,
  reason: string,
  actorId: number,
  now = new Date(),
) {
  return prisma.$transaction(async transaction => {
    const current = await lockReservation(transaction, reservationId);
    if (current.status === ReservationStatus.CANCELLED) return getReservation(reservationId, transaction);
    if (current.status !== ReservationStatus.PENDING && current.status !== ReservationStatus.CONFIRMED) {
      throw new ReservationOperationError('INVALID_RESERVATION_TRANSITION', 409, 'La reserva no puede cancelarse');
    }
    const lateCancellation = current.status === ReservationStatus.CONFIRMED
      && current.scheduledAt.getTime() - now.getTime() < 48 * HOUR_MS;
    await transaction.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: now,
        cancelledById: actorId,
        cancellationReason: reason,
        lateCancellation,
        updatedById: actorId,
      },
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId,
        action: ReservationHistoryAction.CANCELLED,
        actorId,
        note: reason,
        previousStatus: current.status,
        newStatus: ReservationStatus.CANCELLED,
      },
    });
    return getReservation(reservationId, transaction);
  });
}

export async function completeReservation(reservationId: number, actorId: number, now = new Date()) {
  return prisma.$transaction(async transaction => {
    const current = await lockReservation(transaction, reservationId);
    if (current.status === ReservationStatus.COMPLETED) return getReservation(reservationId, transaction);
    if (current.status !== ReservationStatus.CONFIRMED) {
      throw new ReservationOperationError('INVALID_RESERVATION_TRANSITION', 409, 'Solo una reserva confirmada puede completarse');
    }
    if (current.scheduledAt.getTime() > now.getTime()) {
      throw new ReservationOperationError(
        'RESERVATION_NOT_DUE',
        409,
        'La reserva solo puede completarse cuando llegue su hora programada',
      );
    }
    await transaction.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.COMPLETED,
        completedAt: now,
        completedById: actorId,
        updatedById: actorId,
      },
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId,
        action: ReservationHistoryAction.COMPLETED,
        actorId,
        previousStatus: ReservationStatus.CONFIRMED,
        newStatus: ReservationStatus.COMPLETED,
      },
    });
    return getReservation(reservationId, transaction);
  });
}
