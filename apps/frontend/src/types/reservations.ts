export type ReservationType = 'TABLE_RESERVATION' | 'PRIVATE_EVENT' | 'CORPORATE_EVENT' | 'OTHER';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type ReservationHistoryAction = 'CREATED' | 'UPDATED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';

export type ReservationActor = { id: number; fullName: string | null; email: string };
export type ReservationTable = { id: number; code: string; area: string | null; capacity: number; active: boolean };

export type ReservationHistoryEntry = {
  id: number;
  action: ReservationHistoryAction;
  occurredAt: string;
  note: string | null;
  previousScheduledAt: string | null;
  newScheduledAt: string | null;
  previousStatus: ReservationStatus | null;
  newStatus: ReservationStatus | null;
  actor: ReservationActor;
};

export type Reservation = {
  id: number;
  customerName: string;
  phone: string;
  email: string | null;
  reservationType: ReservationType;
  scheduledAt: string;
  guestCount: number;
  preferredArea: string | null;
  diningTableId: number | null;
  diningTable: ReservationTable | null;
  reason: string;
  notes: string | null;
  status: ReservationStatus;
  isVip: boolean;
  confirmedAt: string | null;
  confirmedBy: ReservationActor | null;
  cancelledAt: string | null;
  cancelledBy: ReservationActor | null;
  cancellationReason: string | null;
  lateCancellation: boolean;
  completedAt: string | null;
  completedBy: ReservationActor | null;
  createdAt: string;
  createdBy: ReservationActor;
  updatedAt: string;
  updatedBy: ReservationActor;
  history?: ReservationHistoryEntry[];
};

export type ReservationSummary = {
  todayReservations: number;
  committedTables: number;
  upcomingEvents: number;
  expectedGuests: number;
  generatedAt: string;
};

export const reservationTypeLabels: Record<ReservationType, string> = {
  TABLE_RESERVATION: 'Reserva de mesa',
  PRIVATE_EVENT: 'Evento privado',
  CORPORATE_EVENT: 'Evento corporativo',
  OTHER: 'Otro',
};

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

export const reservationHistoryLabels: Record<ReservationHistoryAction, string> = {
  CREATED: 'Reserva creada',
  UPDATED: 'Datos actualizados',
  CONFIRMED: 'Reserva confirmada',
  RESCHEDULED: 'Reserva aplazada',
  CANCELLED: 'Reserva cancelada',
  COMPLETED: 'Reserva completada',
};
