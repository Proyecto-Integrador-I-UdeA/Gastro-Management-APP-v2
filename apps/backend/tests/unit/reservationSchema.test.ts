import { describe, expect, it } from 'vitest';
import {
  cancelReservationSchema,
  createReservationSchema,
  rescheduleReservationSchema,
  updateReservationSchema,
} from '../../src/schemas/reservationSchema';

const valid = {
  customerName: 'Ana Gómez',
  phone: '+57 300 000 0000',
  email: 'ana@example.com',
  reservationType: 'PRIVATE_EVENT',
  scheduledAt: '2099-09-20T19:30:00.000-05:00',
  guestCount: 12,
  preferredArea: 'Terraza',
  diningTableId: 3,
  reason: 'Aniversario',
  notes: 'Decoración sobria',
  status: 'CONFIRMED',
  isVip: true,
};

describe('contratos de reservas y eventos', () => {
  it('acepta creación pendiente o confirmada y mantiene VIP separado', () => {
    const confirmed = createReservationSchema.parse(valid);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.isVip).toBe(true);
    expect(createReservationSchema.parse({ ...valid, status: 'PENDING' }).status).toBe('PENDING');
  });

  it('rechaza campos requeridos, correo, comensales, fecha sin zona y estados terminales', () => {
    expect(createReservationSchema.safeParse({ ...valid, customerName: '' }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, email: 'correo-inválido' }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, guestCount: 0 }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, scheduledAt: '2099-09-20T19:30' }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, status: 'CANCELLED' }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, status: 'COMPLETED' }).success).toBe(false);
  });

  it('rechaza campos internos o desconocidos y updates vacíos', () => {
    expect(createReservationSchema.safeParse({ ...valid, createdById: 99 }).success).toBe(false);
    expect(updateReservationSchema.safeParse({}).success).toBe(false);
    expect(updateReservationSchema.safeParse({ status: 'CANCELLED' }).success).toBe(false);
  });

  it('normaliza opcionales y valida contratos de aplazamiento/cancelación', () => {
    expect(createReservationSchema.parse({ ...valid, email: '', notes: '', preferredArea: '' }))
      .toMatchObject({ email: null, notes: null, preferredArea: null });
    expect(rescheduleReservationSchema.safeParse({ scheduledAt: valid.scheduledAt }).success).toBe(true);
    expect(rescheduleReservationSchema.safeParse({ scheduledAt: valid.scheduledAt, extra: true }).success).toBe(false);
    expect(cancelReservationSchema.safeParse({ reason: '  Cambio de planes  ' }).data)
      .toEqual({ reason: 'Cambio de planes' });
    expect(cancelReservationSchema.safeParse({ reason: '' }).success).toBe(false);
  });
});
