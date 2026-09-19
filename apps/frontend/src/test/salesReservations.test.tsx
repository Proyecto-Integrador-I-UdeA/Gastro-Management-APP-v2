import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReservationForm from '@/components/reservations/ReservationForm';
import ReservationDetailPage from '@/pages/sales/reservations/[id]';
import ReservationsPage from '@/pages/sales/reservations';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
  router: { query: {} as Record<string, string>, isReady: true },
}));

vi.mock('@/utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/permissions', () => ({ getUserPermissions: mocks.getUserPermissions }));
vi.mock('next/router', () => ({ useRouter: () => ({ ...mocks.router, push: mocks.push }) }));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const actor = { id: 7, fullName: 'Laura Administradora', email: 'laura@example.com' };
const table = { id: 2, code: 'M-02', area: 'Terraza', capacity: 4, active: true };
const reservation = {
  id: 31,
  customerName: 'Ana Torres',
  phone: '3001234567',
  email: 'ana@example.com',
  reservationType: 'TABLE_RESERVATION' as const,
  scheduledAt: '2099-09-20T00:00:00.000Z',
  guestCount: 4,
  preferredArea: 'Terraza',
  diningTableId: 2,
  diningTable: table,
  reason: 'Cena de aniversario',
  notes: 'Mesa tranquila',
  status: 'PENDING' as const,
  isVip: true,
  confirmedAt: null,
  confirmedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lateCancellation: false,
  completedAt: null,
  completedBy: null,
  createdAt: '2026-09-18T13:00:00.000Z',
  createdBy: actor,
  updatedAt: '2026-09-18T13:00:00.000Z',
  updatedBy: actor,
  history: [{
    id: 1,
    action: 'CREATED' as const,
    occurredAt: '2026-09-18T13:00:00.000Z',
    note: null,
    previousScheduledAt: null,
    newScheduledAt: '2099-09-20T00:00:00.000Z',
    previousStatus: null,
    newStatus: 'PENDING' as const,
    actor,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.router.query = {};
  mocks.getUserPermissions.mockReturnValue(['reservations.read', 'reservations.manage']);
});

describe('listado de reservas', () => {
  it('muestra KPIs, reservas y abre el detalle', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/reservations') return Promise.resolve({ reservations: [reservation] });
      if (path === '/sales/reservations/summary') return Promise.resolve({
        todayReservations: 2,
        committedTables: 1,
        upcomingEvents: 3,
        expectedGuests: 18,
        generatedAt: '2026-09-18T13:00:00.000Z',
      });
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    render(<ReservationsPage />);

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    await user.click(screen.getByText('Ana Torres'));
    expect(mocks.push).toHaveBeenCalledWith('/sales/reservations/31');
  });

  it('envía búsqueda parcial al backend y conserva el resumen', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/reservations/summary') return Promise.resolve({
        todayReservations: 0, committedTables: 0, upcomingEvents: 0, expectedGuests: 0, generatedAt: '',
      });
      return Promise.resolve({ reservations: [] });
    });

    render(<ReservationsPage />);
    await screen.findByText('No hay reservas registradas.');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar reservas' }), '  aniversario  ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/reservations?search=aniversario'));
    expect(screen.getByText('No se encontraron reservas.')).toBeInTheDocument();
  });

  it('no consulta la API ni muestra gestión sin reservations.read', async () => {
    mocks.getUserPermissions.mockReturnValue([]);
    render(<ReservationsPage />);
    expect(await screen.findByText('No tienes permiso para consultar reservas y eventos.')).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Crear reserva/ })).not.toBeInTheDocument();
  });
});

describe('formulario de reserva', () => {
  it('valida datos obligatorios y entrega fecha de Bogotá como ISO', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReservationForm creating tables={[table]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Guardar reserva' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Completa cliente, teléfono y motivo.');

    await user.type(screen.getByLabelText('Cliente / responsable'), 'Ana Torres');
    await user.type(screen.getByLabelText('Teléfono'), '3001234567');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com');
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2099-09-19' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '19:00' } });
    await user.type(screen.getByLabelText('Número de personas'), '4');
    await user.type(screen.getByLabelText('Motivo'), 'Cena de aniversario');
    await user.selectOptions(screen.getByLabelText('Mesa preferida'), '2');
    await user.click(screen.getByLabelText('Clasificación VIP'));
    await user.click(screen.getByRole('button', { name: 'Guardar reserva' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      customerName: 'Ana Torres',
      scheduledAt: '2099-09-20T00:00:00.000Z',
      guestCount: 4,
      diningTableId: 2,
      isVip: true,
      status: 'PENDING',
    }));
  });
});

describe('detalle y ciclo de vida de reservas', () => {
  it('confirma una reserva y actualiza inmediatamente el estado', async () => {
    const user = userEvent.setup();
    mocks.router.query = { id: '31' };
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/sales/reservations/31/confirm' && options?.method === 'POST') {
        return Promise.resolve({ ...reservation, status: 'CONFIRMED', confirmedAt: '2026-09-18T14:00:00.000Z', confirmedBy: actor });
      }
      if (path === '/sales/reservations/31') return Promise.resolve(reservation);
      if (path === '/sales/reservations/references') return Promise.resolve({ tables: [table] });
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    render(<ReservationDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(screen.getByText('Confirmada')).toBeInTheDocument());
    expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/reservations/31/confirm', { method: 'POST', json: {} });
    expect(screen.getByText('Reserva creada')).toBeInTheDocument();
  });

  it('mantiene estados terminales en modo de solo lectura', async () => {
    mocks.router.query = { id: '31' };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/reservations/31') return Promise.resolve({
        ...reservation,
        status: 'CANCELLED',
        cancellationReason: 'Cambio de planes',
        cancelledAt: '2026-09-18T14:00:00.000Z',
        cancelledBy: actor,
        lateCancellation: true,
      });
      if (path === '/sales/reservations/references') return Promise.resolve({ tables: [table] });
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    render(<ReservationDetailPage />);
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('Cancelación tardía')).toBeInTheDocument();
    expect(screen.getByText('Cambio de planes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('muestra el error controlado de aplazamiento menor a 48 horas', async () => {
    const user = userEvent.setup();
    mocks.router.query = { id: '31' };
    const confirmed = { ...reservation, status: 'CONFIRMED' as const };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/reservations/31') return Promise.resolve(confirmed);
      if (path === '/sales/reservations/references') return Promise.resolve({ tables: [table] });
      if (path === '/sales/reservations/31/reschedule') {
        return Promise.reject(new Error('La reserva solo puede aplazarse con al menos 48 horas de anticipación'));
      }
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    render(<ReservationDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Aplazar' }));
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2099-09-20' } });
    fireEvent.change(screen.getByLabelText('Nueva hora'), { target: { value: '20:00' } });
    await user.click(screen.getByRole('button', { name: 'Guardar nueva fecha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 48 horas');
  });

  it('cancela con motivo y completa una reserva vencida mediante acciones explícitas', async () => {
    const user = userEvent.setup();
    mocks.router.query = { id: '31' };
    const confirmedPast = { ...reservation, status: 'CONFIRMED' as const, scheduledAt: '2020-09-20T00:00:00.000Z' };
    const completed = { ...confirmedPast, status: 'COMPLETED' as const, completedAt: '2026-09-18T15:00:00.000Z', completedBy: actor };
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string; json?: unknown }) => {
      if (path === '/sales/reservations/31') return Promise.resolve(confirmedPast);
      if (path === '/sales/reservations/references') return Promise.resolve({ tables: [table] });
      if (path === '/sales/reservations/31/complete' && options?.method === 'POST') return Promise.resolve(completed);
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    const view = render(<ReservationDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Completar' }));
    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/reservations/31/complete', { method: 'POST', json: {} });

    view.unmount();
    const confirmedFuture = { ...reservation, status: 'CONFIRMED' as const };
    const cancelled = { ...confirmedFuture, status: 'CANCELLED' as const, cancellationReason: 'Cliente no asistirá' };
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string; json?: unknown }) => {
      if (path === '/sales/reservations/31') return Promise.resolve(confirmedFuture);
      if (path === '/sales/reservations/references') return Promise.resolve({ tables: [table] });
      if (path === '/sales/reservations/31/cancel' && options?.method === 'POST') return Promise.resolve(cancelled);
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });
    render(<ReservationDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await user.type(screen.getByLabelText('Motivo de cancelación'), 'Cliente no asistirá');
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/reservations/31/cancel', {
      method: 'POST', json: { reason: 'Cliente no asistirá' },
    });
  });
});
