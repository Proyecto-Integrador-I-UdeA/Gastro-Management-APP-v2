import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashRegisterPage from '@/pages/sales/cash';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), getUserPermissions: vi.fn() }));
vi.mock('@/utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/permissions', () => ({ getUserPermissions: mocks.getUserPermissions }));
vi.mock('@/components/layouts/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const invoice = { id: 8, subtotal: '108000.00', salesAmount: '100000.00', consumptionTaxAmount: '8000.00', suggestedServicePercent: '10.00', serviceAccepted: true, serviceAmount: '10000.00', total: '118000.00', paid: '0.00', pending: '118000.00', payments: [] as Array<{ id: number; method: string; amount: string; change: string }> };
const order = { id: 25, paymentStatus: 'UNPAID', table: { code: 'M3' }, subtotal: '108000.00', salesAmount: '100000.00', consumptionTaxAmount: '8000.00', suggestedServicePercent: '10.00', suggestedServiceAmount: '10000.00', suggestedTotal: '118000.00', accountRequestedAt: '2026-09-16T10:00:00.000Z' as string | null, items: [{ id: 1, name: 'Pechuga de pollo', quantity: 1, subtotal: '108000.00' }], invoice: invoice as typeof invoice | null, paid: '0.00', pending: '118000.00' };
const session = { id: 4, openingCash: '200000.00', status: 'OPEN', cashRegister: { id: 1, name: 'Caja Principal' }, openedAt: '2026-09-16T10:00:00Z', openedBy: { fullName: 'Cajero' } };
const collection = { salesAmount: '100000.00', consumptionTaxAmount: '8000.00', serviceAmount: '10000.00', totalCollected: '118000.00', byMethod: { CASH: '60000.00', CARD: '58000.00' }, expectedCash: '260000.00' };
const initial = {
  session: session as typeof session | null,
  sessionSummary: collection,
  config: { servicePercent: '10.00' },
  pending: [order],
  daily: { date: '2026-09-16', rows: [] as Array<{ id: number; settledAt: string; table: string; salesAmount: string; consumptionTaxAmount: string; serviceAmount: string; totalCollected: string; payments: typeof invoice.payments; settledBy: { fullName: string; email: string } }>, summary: { ...collection, closedOrders: 0 } },
  history: [] as Array<typeof session & { closedAt: string; closedBy: { fullName: string }; expectedCash: string; countedCash: string; difference: string; summary: typeof collection }>,
};
let data: typeof initial;
let failPayment: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  data = structuredClone(initial);
  failPayment = false;
  mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.operate', 'cash.configure', 'cash.reports']);
  // Respuestas controladas de API: los cálculos reales se prueban en backend.
  mocks.apiFetch.mockImplementation(async (path: string, options?: { json?: Record<string, unknown> }) => {
    const json = options?.json ?? {};
    if (path.startsWith('/cash/dashboard')) {
      const permissions: string[] = mocks.getUserPermissions();
      return structuredClone({ session: data.session, pending: data.pending, ...(permissions.includes('cash.configure') ? { config: data.config } : {}), ...(permissions.includes('cash.reports') ? { sessionSummary: data.sessionSummary, daily: data.daily, history: data.history } : {}) });
    }
    if (path.endsWith('/reconciliation')) return { sessionId: 4, openingCash: '200000.00', expectedCash: '260000.00', byMethod: { CASH: '60000.00', CARD: '0.00', TRANSFER: '0.00', OTHER: '0.00' } };
    if (path === '/cash/session') { data.session = structuredClone(session); return data.session; }
    if (path.endsWith('/close')) {
      data.history = [{ ...session, closedAt: '2026-09-16T20:00:00Z', closedBy: { fullName: 'Cajero' }, expectedCash: '260000.00', countedCash: '259000.00', difference: '-1000.00', summary: collection }];
      data.session = null;
      return { ...data.history[0], reconciliation: { byMethod: collection.byMethod } };
    }
    if (path.endsWith('/account')) { data.pending[0].accountRequestedAt = order.accountRequestedAt; return structuredClone(data.pending[0]); }
    if (path.endsWith('/pre-invoices')) {
      data.pending[0].invoice = { ...structuredClone(invoice), serviceAccepted: json.serviceAccepted === true, serviceAmount: json.serviceAccepted ? '10000.00' : '0.00', total: json.serviceAccepted ? '118000.00' : '108000.00', pending: json.serviceAccepted ? '118000.00' : '108000.00' };
      return structuredClone(data.pending[0]);
    }
    if (path === '/cash/payments') {
      if (failPayment) { failPayment = false; throw new Error('Respuesta de pago no disponible'); }
      const current = data.pending[0].invoice!;
      current.payments.push({ id: current.payments.length + 1, method: String(json.method), amount: String(json.amount), change: '0.00' });
      current.paid = (Number(current.paid) + Number(json.amount)).toFixed(2);
      current.pending = (Number(current.total) - Number(current.paid)).toFixed(2);
      data.pending[0] = { ...data.pending[0], paid: current.paid, pending: current.pending, paymentStatus: 'PARTIALLY_PAID' };
      return { id: current.payments.length };
    }
    if (path.endsWith('/settle')) {
      data.daily.rows = [{ id: 25, settledAt: '2026-09-16T18:00:00Z', table: 'M3', salesAmount: '100000.00', consumptionTaxAmount: '8000.00', serviceAmount: '10000.00', totalCollected: '118000.00', payments: data.pending[0].invoice!.payments, settledBy: { fullName: 'Cajero', email: 'cash@test.local' } }];
      data.daily.summary.closedOrders = 1;
      data.pending = [];
      return { paymentStatus: 'PAID', status: 'SETTLED' };
    }
    return {};
  });
});

async function setup() {
  const user = userEvent.setup();
  render(<CashRegisterPage />);
  await screen.findByRole('heading', { name: 'Mesa M3 · Pedido #25' });
  return user;
}

describe('Caja CASH-01A', () => {
  it('acciones separadas, navegación y venta/servicio visibles sin ciclo de recarga', async () => {
    await setup();
    for (const name of ['Generar cuenta', 'Prefactura con servicio', 'Prefactura sin servicio']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Historial de cajas' })).toHaveAttribute('href', '#cash-history');
    expect(screen.getByText(/Venta:.*100\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Impuesto:.*8\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Servicio sugerido:.*10\.000/)).toBeInTheDocument();
    expect(mocks.apiFetch.mock.calls.filter(([path]) => path.startsWith('/cash/dashboard'))).toHaveLength(1);
  });

  it('abre caja con base inicial explícita y no convierte vacío en cero', async () => {
    data.session = null;
    const user = await setup();
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Base inicial' }), '200000');
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(await screen.findByText('Abierta')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/cash/session', { method: 'POST', json: { openingCash: '200000' } });
  });

  it('genera cuenta inicial con servicio sugerido y aviso de voluntariedad, sin pago', async () => {
    data.pending[0].invoice = null;
    data.pending[0].accountRequestedAt = null;
    const user = await setup();
    expect(screen.getByRole('button', { name: 'Prefactura con servicio' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Generar cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Cuenta inicial · Pedido #25' })).toBeInTheDocument();
    expect(screen.getByText(/El servicio es voluntario/)).toBeInTheDocument();
    expect(screen.getByText('Pechuga de pollo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cuenta pagada' })).not.toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalledWith('/cash/payments', expect.anything());
  });

  it.each([true, false])('prefactura con serviceAccepted=%s usa acción y documento correctos', async accepted => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: accepted ? 'Prefactura con servicio' : 'Prefactura sin servicio' }));
    expect(await screen.findByRole('heading', { name: `Prefactura ${accepted ? 'con' : 'sin'} servicio · Pedido #25` })).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/cash/orders/25/pre-invoices', { method: 'POST', json: { serviceAccepted: accepted } });
    expect(screen.getByRole('button', { name: 'Cuenta pagada' })).toBeDisabled();
  });

  it('pagos parcial y mixto mantienen pendiente hasta Cuenta pagada; luego muestra venta histórica separada', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Ver cuenta y pagos' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Monto del pago' }), '60000');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Monto del pago' })).toHaveValue(null));
    expect(screen.getByRole('button', { name: 'Cuenta pagada' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prefactura sin servicio' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Medio de pago' }), 'CARD');
    await user.type(screen.getByRole('spinbutton', { name: 'Monto del pago' }), '58000');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cuenta pagada' })).toBeEnabled());
    expect(screen.getByRole('heading', { name: 'Mesa M3 · Pedido #25' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cuenta pagada' }));
    await screen.findByText('No hay cuentas pendientes.');
    expect(screen.queryByRole('heading', { name: 'Cobro · Mesa M3 · Pedido #25' })).not.toBeInTheDocument();
    const row = screen.getByRole('row', { name: /M3 · #25/ });
    expect(within(row).getByText(/\$\s*100\.000(?:,00)?$/)).toBeInTheDocument();
    expect(within(row).getByText(/\$\s*10\.000(?:,00)?$/)).toBeInTheDocument();
    expect(within(row).getByText(/\$\s*118\.000(?:,00)?$/)).toBeInTheDocument();
    expect(within(row).getByText('Cajero')).toBeInTheDocument();
  });

  it('retry conserva clave de idempotencia e importe exacto', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Ver cuenta y pagos' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Monto del pago' }), '60000');
    failPayment = true;
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Monto del pago' })).toHaveValue(null));
    const calls = mocks.apiFetch.mock.calls.filter(([path]) => path === '/cash/payments');
    expect(calls).toHaveLength(2);
    expect(calls[0][1].json).toEqual(calls[1][1].json);
    expect(calls[0][1].json).toMatchObject({ cashSessionId: 4, preInvoiceId: 8, amount: '60000', amountTendered: '60000', method: 'CASH', idempotencyKey: expect.any(String) });
  });

  it('monto no representable y sobrepago no habilitan registro', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Ver cuenta y pagos' }));
    const input = screen.getByRole('spinbutton', { name: 'Monto del pago' });
    await user.type(input, '0.001');
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '120000');
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  it('cajero concilia al iniciar cierre y ve su confirmación sin histórico comercial', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.operate']);
    const user = await setup();
    expect(screen.queryByRole('spinbutton', { name: 'Efectivo contado' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Efectivo esperado:/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    const preview = await screen.findByRole('region', { name: 'Conciliación de caja' });
    expect(within(preview).getByText(/Efectivo recibido:/)).toHaveTextContent(/60\.000/);
    expect(within(preview).getByText(/Efectivo esperado:/)).toHaveTextContent(/260\.000/);
    for (const label of ['Tarjetas registradas:', 'Transferencias registradas:', 'Otros medios:']) expect(within(preview).getByText(new RegExp(label))).toBeInTheDocument();
    expect(screen.queryByText(/Ventas de productos cobradas:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Servicio voluntario recibido:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar cierre' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Efectivo contado' }), '259000');
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    const closed = await screen.findByRole('region', { name: 'Cierre realizado' });
    expect(mocks.apiFetch).toHaveBeenCalledWith('/cash/session/4/close', { method: 'POST', json: { countedCash: '259000' } });
    expect(within(closed).getByText(/Efectivo esperado:/)).toHaveTextContent(/260\.000/);
    expect(within(closed).getByText(/Efectivo contado:/)).toHaveTextContent(/259\.000/);
    expect(within(closed).getByText(/Diferencia:/)).toHaveTextContent(/1\.000/);
    expect(within(closed).getByText(/Tarjetas registradas:/)).toHaveTextContent(/58\.000/); // Respuesta final, no preview anterior.
    expect(screen.queryByRole('heading', { name: 'Historial de cajas' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ventas de productos cobradas:/)).not.toBeInTheDocument();
  });

  it('configuración valida dos decimales y envía porcentaje como string', async () => {
    const user = await setup();
    const toggle = screen.getByRole('button', { name: 'Configuración administrativa' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('spinbutton', { name: 'Porcentaje de servicio' })).not.toBeInTheDocument();
    await user.click(toggle);
    const input = screen.getByRole('spinbutton', { name: 'Porcentaje de servicio' });
    await user.clear(input);
    await user.type(input, '10.123');
    expect(screen.getByRole('button', { name: 'Guardar porcentaje' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '8.25');
    await user.click(screen.getByRole('button', { name: 'Guardar porcentaje' }));
    expect(mocks.apiFetch).toHaveBeenCalledWith('/cash/config/service', { method: 'PUT', json: { servicePercent: '8.25' } });
  });

  it('cajero opera pagos mixtos y Cuenta pagada sin recibir ni mostrar reportes', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.operate']);
    const user = await setup();
    for (const name of ['Ventas del día', 'Historial de cajas', 'Configuración administrativa']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configuración administrativa' })).not.toBeInTheDocument();
    for (const label of [/Ventas de productos cobradas:/, /Servicio voluntario recibido:/, /Total recaudado:/]) expect(screen.queryByText(label)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver cuenta y pagos' }));
    const account = screen.getByRole('heading', { name: 'Cobro · Mesa M3 · Pedido #25' }).closest('section')!;
    expect(within(account).getByText(/^Venta:/)).toHaveTextContent(/100\.000/);
    expect(within(account).getByText(/^Impuesto al consumo:/)).toHaveTextContent(/8\.000/);
    expect(within(account).getByText(/^Servicio:/)).toHaveTextContent(/10\.000/);
    expect(within(account).getByText(/^Total:/)).toHaveTextContent(/118\.000/);
    await user.type(screen.getByRole('spinbutton', { name: 'Monto del pago' }), '60000');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Monto del pago' })).toHaveValue(null));
    expect(screen.getByRole('button', { name: 'Cuenta pagada' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Medio de pago' }), 'CARD');
    await user.type(screen.getByRole('spinbutton', { name: 'Monto del pago' }), '58000');
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cuenta pagada' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Cuenta pagada' }));
    await screen.findByText('No hay cuentas pendientes.');
    expect(screen.queryByRole('heading', { name: 'Ventas del día' })).not.toBeInTheDocument();
  });
  it('cash.reports muestra agregados e historial sin conceder configuración', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.reports']);
    await setup();
    expect(screen.getByRole('heading', { name: 'Ventas del día' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historial de cajas' })).toBeInTheDocument();
    expect(screen.getByText(/Ventas de productos cobradas:/)).toHaveTextContent(/100\.000/);
    expect(screen.getByText(/Servicio voluntario recibido:/)).toHaveTextContent(/10\.000/);
    expect(screen.getByText(/Impuesto al consumo recaudado:/)).toHaveTextContent(/8\.000/);
    expect(screen.getAllByText(/Total recaudado:/)[0]).toHaveTextContent(/118\.000/);
    expect(screen.queryByRole('button', { name: 'Configuración administrativa' })).not.toBeInTheDocument();
  });
  it('cash.configure permite expandir configuración pero no reportes', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.configure']);
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Configuración administrativa' }));
    expect(screen.getByRole('spinbutton', { name: 'Porcentaje de servicio' })).toHaveValue(10);
    expect(screen.queryByRole('heading', { name: 'Ventas del día' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Historial de cajas' })).not.toBeInTheDocument();
  });
  it('cancelar conciliación no cierra caja ni registra pagos', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read', 'cash.operate']);
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    await screen.findByRole('region', { name: 'Conciliación de caja' });
    await user.click(screen.getByRole('button', { name: 'Cancelar cierre' }));
    expect(screen.queryByRole('region', { name: 'Conciliación de caja' })).not.toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(mocks.apiFetch.mock.calls.some(([path]) => path.endsWith('/close') || path === '/cash/payments')).toBe(false);
  });

  it('cash.read permite consulta y no permite operar/configurar', async () => {
    mocks.getUserPermissions.mockReturnValue(['cash.read']);
    await setup();
    expect(screen.getByRole('button', { name: 'Generar cuenta' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cerrar caja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar porcentaje' })).not.toBeInTheDocument();
  });
  it('sin cash.read no consulta datos de Caja', async () => {
    mocks.getUserPermissions.mockReturnValue(['sales.read']);
    render(<CashRegisterPage />);
    await screen.findByText('No tienes permiso para consultar Caja.');
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
