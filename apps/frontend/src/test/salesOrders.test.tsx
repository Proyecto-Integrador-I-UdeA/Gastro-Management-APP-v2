import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesOrdersPage from '@/pages/sales/orders';

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

const tables = {
  tables: [
    {
      id: 1,
      code: 'M-01',
      area: 'Salón principal',
      capacity: 4,
      active: true,
      operationalStatus: 'AVAILABLE',
      activeOrder: null,
    },
    {
      id: 2,
      code: 'M-02',
      area: 'Terraza',
      capacity: 2,
      active: true,
      operationalStatus: 'OCCUPIED',
      activeOrder: {
        id: 22,
        guestCount: 2,
        openedAt: '2026-09-08T12:00:00.000Z',
        billRequestedAt: null,
        openedBy: { id: 7, fullName: 'Laura' },
        hasPendingKitchenItems: true,
        pendingKitchenItemCount: 2,
        kitchenDispatchCount: 0,
        latestKitchenStatus: null,
        kitchenServiceStatus: null,
        latestKitchenDispatchedAt: null,
      },
    },
    {
      id: 3,
      code: 'M-03',
      area: null,
      capacity: 6,
      active: false,
      operationalStatus: 'OUT_OF_SERVICE',
      activeOrder: null,
    },
  ],
};

const order = {
  id: 22,
  status: 'OPEN',
  table: { id: 2, code: 'M-02', area: 'Terraza', capacity: 2, active: true },
  guestCount: 2,
  openedAt: '2026-09-08T12:00:00.000Z',
  billRequestedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  cancellationAcknowledgedAt: null,
  cancellationAcknowledgedBy: null,
  openedBy: { id: 7, fullName: 'Laura' },
  hasPendingKitchenItems: true,
  pendingKitchenItemCount: 2,
  kitchenDispatchCount: 0,
  latestKitchenStatus: null,
  kitchenServiceStatus: null,
  latestKitchenDispatchedAt: null,
  kitchenDispatches: [],
  items: [{
    id: 100,
    menuItemId: 10,
    name: 'Hamburguesa',
    quantity: 2,
    specialInstructions: 'Sin cebolla',
    unitPrice: '10.10',
    currency: 'COP',
    taxIncluded: true,
    lineSubtotal: '20.20',
    kitchenDispatched: false,
    kitchenDispatchId: null,
    kitchenStatus: null,
    kitchenDispatchedAt: null,
    kitchenDeliveredAt: null,
    additions: [{
      id: 101,
      menuItemId: 11,
      name: 'Queso adicional',
      quantity: 2,
      specialInstructions: 'Bien fundido',
      unitPrice: '2.50',
      currency: 'COP',
      taxIncluded: true,
      lineSubtotal: '5.00',
      kitchenDispatched: false,
      kitchenDispatchId: null,
      kitchenStatus: null,
      kitchenDispatchedAt: null,
      kitchenDeliveredAt: null,
    }],
  }],
  totals: { subtotal: '25.20', total: '25.20', currency: 'COP' },
};

const requestedOrder = {
  ...order,
  billRequestedAt: '2026-09-08T13:00:00.000Z',
};

const deliveredTrace = {
  id: 12,
  dispatchNumber: 12,
  status: 'READY',
  dispatchedAt: '2026-09-08T12:00:00.000Z',
  dispatchedBy: { id: 7, fullName: 'Laura Mesera' },
  startedAt: '2026-09-08T12:02:05.000Z',
  startedBy: { id: 8, fullName: 'Carlos Cocina' },
  readyAt: '2026-09-08T12:13:33.000Z',
  readyBy: { id: 8, fullName: 'Carlos Cocina' },
  deliveredAt: '2026-09-08T12:16:07.000Z',
  deliveredBy: { id: 7, fullName: 'Laura Mesera' },
} as const;

const deliveredOrder = {
  ...order,
  hasPendingKitchenItems: false,
  pendingKitchenItemCount: 0,
  kitchenDispatchCount: 1,
  latestKitchenStatus: 'READY',
  kitchenServiceStatus: 'DELIVERED',
  latestKitchenDispatchedAt: deliveredTrace.dispatchedAt,
  kitchenDispatches: [deliveredTrace],
  items: order.items.map(item => ({
    ...item,
    kitchenDispatched: true,
    kitchenDispatchId: deliveredTrace.id,
    kitchenStatus: 'READY',
    kitchenDispatchedAt: deliveredTrace.dispatchedAt,
    kitchenDeliveredAt: deliveredTrace.deliveredAt,
    additions: item.additions.map(addition => ({
      ...addition,
      kitchenDispatched: true,
      kitchenDispatchId: deliveredTrace.id,
      kitchenStatus: 'READY',
      kitchenDispatchedAt: deliveredTrace.dispatchedAt,
      kitchenDeliveredAt: deliveredTrace.deliveredAt,
    })),
  })),
};

const cancelledOrder = {
  ...order,
  status: 'VOIDED',
  cancelledAt: '2026-09-09T18:00:00.000Z',
  cancelledBy: { id: 7, fullName: 'Laura' },
  cancellationReason: 'Cliente se retiró',
  cancellationAcknowledgedAt: '2026-09-09T18:01:00.000Z',
  cancellationAcknowledgedBy: { id: 8, fullName: 'Carlos Cocina' },
  kitchenDispatchCount: 1,
  latestKitchenStatus: 'PREPARING',
  kitchenServiceStatus: 'PREPARING',
  latestKitchenDispatchedAt: '2026-09-09T17:50:00.000Z',
  kitchenDispatches: [{
    id: 31,
    dispatchNumber: 31,
    status: 'PREPARING',
    dispatchedAt: '2026-09-09T17:50:00.000Z',
    dispatchedBy: { id: 7, fullName: 'Laura' },
    startedAt: '2026-09-09T17:52:00.000Z',
    startedBy: { id: 8, fullName: 'Carlos Cocina' },
    readyAt: null,
    readyBy: null,
    deliveredAt: null,
    deliveredBy: null,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.router.query = {};
  mocks.getUserPermissions.mockReturnValue(['sales.read', 'sales.manage']);
  mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
    if (path === '/sales/tables') return Promise.resolve(tables);
    if (path === '/sales/orders/22' && !options?.method) return Promise.resolve(order);
    if (path === '/sales/tables/1/orders') return Promise.resolve(order);
    if (path === '/sales/orders/22/request-bill') return Promise.resolve(requestedOrder);
    if (path === '/sales/orders/22/cancel') return Promise.resolve(cancelledOrder);
    if (path.startsWith('/sales/orders/22/')) return Promise.resolve(order);
    return Promise.resolve(order);
  });
});

describe('Mesas y pedidos', () => {
  it('muestra estados canónicos, zonas y acciones según permiso', async () => {
    render(<SalesOrdersPage />);

    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terraza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin área' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir mesa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir mesa' })).toBeInTheDocument();
  });

  it('en modo solo lectura oculta mutaciones y conserva la consulta', async () => {
    mocks.getUserPermissions.mockReturnValue(['sales.read']);
    render(<SalesOrdersPage />);

    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir mesa' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurar mesas' })).not.toBeInTheDocument();
  });

  it('muestra el acceso secundario de configuración solo con sales.tables.manage', async () => {
    const user = userEvent.setup();
    mocks.getUserPermissions.mockReturnValue([
      'sales.read',
      'sales.manage',
      'sales.tables.manage',
    ]);
    render(<SalesOrdersPage />);

    await user.click(await screen.findByRole('button', { name: 'Configurar mesas' }));
    expect(mocks.push).toHaveBeenCalledWith('/sales/tables');
  });

  it('filtra por zona y mantiene fuera de servicio sin acción de apertura', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);

    await user.click(await screen.findByRole('button', { name: 'Terraza' }));
    expect(screen.getByText('Mesa M-02')).toBeInTheDocument();
    expect(screen.queryByText('Mesa M-01')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    const outOfServiceCard = screen.getByText('Mesa M-03').closest('article');
    expect(outOfServiceCard).not.toBeNull();
    expect(within(outOfServiceCard as HTMLElement).queryByRole('button', { name: 'Abrir mesa' })).not.toBeInTheDocument();
  });

  it('abre una mesa enviando únicamente guestCount y muestra la orden canónica', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);

    await user.click(await screen.findByRole('button', { name: 'Abrir mesa' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Número de comensales' }), '3');
    await user.click(within(screen.getByRole('dialog', { name: 'Abrir mesa' })).getByRole('button', { name: 'Abrir mesa' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/tables/1/orders',
      { method: 'POST', json: { guestCount: 3 } },
    ));
    expect((await screen.findAllByText('Pedido #22')).length).toBeGreaterThan(0);
    expect(mocks.apiFetch.mock.calls.filter(([path]) => path === '/sales/tables').length).toBeGreaterThan(1);
  });

  it('recupera activeOrderId cuando el backend informa TABLE_ALREADY_OCCUPIED', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('ocupada'), {
      body: { code: 'TABLE_ALREADY_OCCUPIED', activeOrderId: 22 },
    });
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/tables/1/orders') return Promise.reject(error);
      if (path === '/sales/orders/22') return Promise.resolve(order);
      return Promise.resolve(order);
    });
    render(<SalesOrdersPage />);

    await user.click(await screen.findByRole('button', { name: 'Abrir mesa' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Abrir mesa' })).getByRole('button', { name: 'Abrir mesa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Otro mesero abrió esta mesa');
    expect((await screen.findAllByText('Pedido #22')).length).toBeGreaterThan(0);
  });

  it('muestra pedido, instrucciones, adiciones y totales del servidor', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);

    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    expect((await screen.findAllByText('Pedido #22')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sin cebolla/)).toBeInTheDocument();
    expect(screen.getByText(/Queso adicional/)).toBeInTheDocument();
    expect(screen.getByText(/Bien fundido/)).toBeInTheDocument();
    expect(screen.getByText(/2 × COP 2,50/)).toBeInTheDocument();
    expect(screen.getByText('COP 5')).toBeInTheDocument();
    expect(screen.getAllByText(/25[,.]20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Terraza').length).toBeGreaterThan(0);
  });

  it('muestra el ciclo entregado, actores y tiempos derivados con solo sales.read', async () => {
    mocks.getUserPermissions.mockReturnValue(['sales.read']);
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(deliveredOrder);
      return Promise.resolve(deliveredOrder);
    });
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    expect(screen.queryByRole('heading', { name: 'Trazabilidad del servicio' }))
      .not.toBeInTheDocument();
    expect(screen.queryByLabelText('Trazabilidad del ticket 12')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver trazabilidad' }));
    const heading = await screen.findByRole('heading', { name: 'Trazabilidad del servicio' });
    const traceability = within(heading.closest('section') as HTMLElement);
    const ticket = traceability.getByLabelText('Trazabilidad del ticket 12');
    const expectedDispatchedAt = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(deliveredTrace.dispatchedAt));

    expect(within(ticket).getAllByText('Entregado')).toHaveLength(2);
    expect(within(ticket).getByText(expectedDispatchedAt)).toBeInTheDocument();
    expect(within(ticket).getAllByText('Laura Mesera')).toHaveLength(2);
    expect(within(ticket).getAllByText('Carlos Cocina')).toHaveLength(2);
    expect(within(ticket).getByText('11 min 28 s')).toBeInTheDocument();
    expect(within(ticket).getByText('2 min 34 s')).toBeInTheDocument();
    expect(within(ticket).getByText('16 min 7 s')).toBeInTheDocument();
    expect(screen.getAllByText('Entregado').length).toBeGreaterThan(1);
    expect(screen.queryByRole('button', { name: 'Marcar como entregado' }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ocultar trazabilidad' }));
    expect(screen.queryByLabelText('Trazabilidad del ticket 12')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver trazabilidad' })).toBeInTheDocument();
  });

  it('mantiene varios dispatches separados y representa timestamps nulos sin Invalid Date', async () => {
    const multiDispatchOrder = {
      ...deliveredOrder,
      hasPendingKitchenItems: true,
      pendingKitchenItemCount: 1,
      kitchenDispatchCount: 2,
      kitchenServiceStatus: 'NEXT',
      kitchenDispatches: [
        deliveredTrace,
        {
          ...deliveredTrace,
          id: 28,
          dispatchNumber: 28,
          status: 'NEXT',
          dispatchedAt: '2026-09-08T12:29:00.000Z',
          startedAt: null,
          startedBy: null,
          readyAt: null,
          readyBy: null,
          deliveredAt: null,
          deliveredBy: null,
        },
      ],
    };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(multiDispatchOrder);
      return Promise.resolve(multiDispatchOrder);
    });
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(screen.getByRole('button', { name: 'Ver trazabilidad' }));

    expect(await screen.findByLabelText('Trazabilidad del ticket 12')).toBeInTheDocument();
    const nextTicket = screen.getByLabelText('Trazabilidad del ticket 28');
    expect(within(nextTicket).getByText('Próximo')).toBeInTheDocument();
    expect(within(nextTicket).getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
    expect(screen.getByText('Cocina: Próximo · 1 pendiente')).toBeInTheDocument();
  });

  it('resume una mesa totalmente entregada sin cargar la cronología completa', async () => {
    const deliveredTables = {
      tables: tables.tables.map(table => table.id === 2
        ? {
            ...table,
            activeOrder: {
              ...table.activeOrder,
              hasPendingKitchenItems: true,
              pendingKitchenItemCount: 1,
              kitchenDispatchCount: 2,
              latestKitchenStatus: 'READY',
              kitchenServiceStatus: 'DELIVERED',
              latestKitchenDispatchedAt: deliveredTrace.dispatchedAt,
            },
          }
        : table),
    };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(deliveredTables);
      return Promise.resolve(deliveredOrder);
    });
    render(<SalesOrdersPage />);

    expect(await screen.findByText('Cocina: Entregado · 1 pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Trazabilidad del servicio' }))
      .not.toBeInTheDocument();
  });

  it('renderiza de forma segura un producto principal sin adiciones', async () => {
    const user = userEvent.setup();
    const orderWithoutAdditions = {
      ...order,
      items: [{ ...order.items[0], additions: [] }],
    };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(orderWithoutAdditions);
      return Promise.resolve(orderWithoutAdditions);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    expect(await screen.findByText('Hamburguesa')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Adiciones de Hamburguesa' })).not.toBeInTheDocument();
  });

  it('renderiza varias adiciones en un solo nivel sin exigir adiciones anidadas', async () => {
    const user = userEvent.setup();
    const orderWithSeveralAdditions = {
      ...order,
      items: [{
        ...order.items[0],
        additions: [
          order.items[0].additions[0],
          {
            id: 102,
            menuItemId: 12,
            name: 'Aguacate adicional',
            quantity: 1,
            specialInstructions: null,
            unitPrice: '3.00',
            currency: 'COP',
            taxIncluded: true,
            lineSubtotal: '3.00',
          },
        ],
      }],
      totals: { subtotal: '28.20', total: '28.20', currency: 'COP' },
    };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(orderWithSeveralAdditions);
      return Promise.resolve(orderWithSeveralAdditions);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    const additions = await screen.findByRole('list', { name: 'Adiciones de Hamburguesa' });
    expect(within(additions).getByText(/Queso adicional/)).toBeInTheDocument();
    expect(within(additions).getByText(/Aguacate adicional/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Adiciones de Queso adicional' })).not.toBeInTheDocument();
  });

  it('edita y elimina una adición usando el id de la línea hija', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    const additions = await screen.findByRole('list', { name: 'Adiciones de Hamburguesa' });
    const additionRow = within(additions).getByText(/Queso adicional/).closest('li');
    expect(additionRow).not.toBeNull();
    const addition = within(additionRow as HTMLElement);

    await user.click(addition.getByRole('button', { name: '+' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/101',
      { method: 'PATCH', json: { quantity: 3 } },
    ));

    const instructions = addition.getByRole('textbox', { name: 'Indicaciones para Queso adicional' });
    await user.clear(instructions);
    await user.type(instructions, 'Poco fundido');
    await user.click(addition.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/101',
      { method: 'PATCH', json: { specialInstructions: 'Poco fundido' } },
    ));

    await user.click(addition.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/101',
      { method: 'DELETE' },
    ));
  });

  it('usa respuestas canónicas para cantidad, indicaciones, eliminación y cuenta', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    await user.click(screen.getAllByRole('button', { name: '+' })[0]);
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/100',
      { method: 'PATCH', json: { quantity: 3 } },
    ));

    const instructionInput = screen.getByRole('textbox', { name: 'Indicaciones para Hamburguesa' });
    await user.clear(instructionInput);
    await user.type(instructionInput, 'Salsa aparte');
    await user.click(within(instructionInput.parentElement as HTMLElement).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/100',
      { method: 'PATCH', json: { specialInstructions: 'Salsa aparte' } },
    ));

    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/items/100',
      { method: 'DELETE' },
    ));

    await user.click(screen.getByRole('button', { name: 'Pedir cuenta' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/request-bill',
      { method: 'POST', json: {} },
    ));
    expect(await screen.findByText('Cuenta solicitada')).toBeInTheDocument();
  });

  it('permite actualizar el número de comensales con la mutación canónica', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    const guestCount = screen.getByRole('spinbutton', { name: 'Número de comensales del pedido' });
    await user.clear(guestCount);
    await user.type(guestCount, '3');
    await user.click(screen.getByRole('button', { name: /Guardar comensales/ }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/guest-count',
      { method: 'PATCH', json: { guestCount: 3 } },
    ));
  });

  it('exige confirmación y motivo para cancelar un pedido abierto', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    const dialog = screen.getByRole('dialog', { name: 'Cancelar pedido' });
    expect(dialog).toHaveTextContent('Cocina recibirá una alerta persistente');
    const reason = within(dialog).getByRole('textbox', { name: 'Motivo de cancelación' });
    expect(reason).toBeRequired();
    await user.type(reason, '  Cliente se retiró  ');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelación' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/cancel',
      { method: 'POST', json: { reason: 'Cliente se retiró' } },
    ));
    expect((await screen.findAllByText('Cancelado')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Ver trazabilidad' }));
    const cancellationTrace = screen.getByLabelText('Trazabilidad de cancelación');
    expect(cancellationTrace).toHaveTextContent('Cliente se retiró');
    expect(cancellationTrace).toHaveTextContent('Laura');
    expect(cancellationTrace).toHaveTextContent('Cocina confirmó');
    expect(cancellationTrace).toHaveTextContent('Carlos Cocina');
    const kitchenTrace = screen.getByLabelText('Trazabilidad del ticket 31');
    expect(kitchenTrace).toHaveTextContent('Enviado a cocina');
    expect(kitchenTrace).toHaveTextContent('Inicio preparación');
    expect(kitchenTrace).toHaveTextContent('Cancelación del pedido');
    expect(kitchenTrace).not.toHaveTextContent('Invalid Date');
    expect(screen.queryByRole('button', { name: 'Agregar productos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar a cocina' })).not.toBeInTheDocument();
  });

  it('permite cerrar el diálogo de cancelación sin mutar el pedido', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Cancelar pedido' }))
      .getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('dialog', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      '/sales/orders/22/cancel',
      expect.anything(),
    );
  });

  it('navega al único menú comercial con orderId', async () => {
    const user = userEvent.setup();
    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(screen.getByRole('button', { name: 'Agregar productos' }));
    expect(mocks.push).toHaveBeenCalledWith('/sales/menu?orderId=22');
  });

  it('reabre directamente el pedido indicado por orderId', async () => {
    mocks.router.query = { orderId: '22' };
    render(<SalesOrdersPage />);

    expect((await screen.findAllByText('Pedido #22')).length).toBeGreaterThan(0);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/orders/22');
    expect(screen.getByText(/Sin cebolla/)).toBeInTheDocument();
    expect(screen.getByText(/Queso adicional/)).toBeInTheDocument();
  });

  it('envía pendientes a cocina, reconcilia la orden y bloquea controles despachados', async () => {
    const user = userEvent.setup();
    const dispatchedOrder = {
      ...order,
      hasPendingKitchenItems: false,
      pendingKitchenItemCount: 0,
      kitchenDispatchCount: 1,
      latestKitchenStatus: 'NEXT',
      kitchenServiceStatus: 'NEXT',
      latestKitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
      items: order.items.map(item => ({
        ...item,
        kitchenDispatched: true,
        kitchenDispatchId: 901,
        kitchenStatus: 'NEXT',
        kitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
        kitchenDeliveredAt: null,
        additions: item.additions.map(addition => ({
          ...addition,
          kitchenDispatched: true,
          kitchenDispatchId: 901,
          kitchenStatus: 'NEXT',
          kitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
          kitchenDeliveredAt: null,
        })),
      })),
    };
    let sent = false;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22/send-to-kitchen' && options?.method === 'POST') {
        sent = true;
        return Promise.resolve({ id: 901 });
      }
      if (path === '/sales/orders/22' && !options?.method) {
        return Promise.resolve(sent ? dispatchedOrder : order);
      }
      return Promise.resolve(order);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar a cocina' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/sales/orders/22/send-to-kitchen',
      { method: 'POST', json: {} },
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido enviado a cocina correctamente');
    expect(screen.getByRole('button', { name: 'Todo enviado a cocina' })).toBeDisabled();
    expect(screen.getAllByText('Cocina: Próximo').length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox', { name: 'Indicaciones para Hamburguesa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('mantiene editables y enviables solo las líneas nuevas tras un despacho previo', async () => {
    const user = userEvent.setup();
    const mixedOrder = {
      ...order,
      hasPendingKitchenItems: true,
      pendingKitchenItemCount: 1,
      kitchenDispatchCount: 1,
      latestKitchenStatus: 'PREPARING',
      kitchenServiceStatus: 'PREPARING',
      latestKitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
      items: [
        {
          ...order.items[0],
          kitchenDispatched: true,
          kitchenDispatchId: 901,
          kitchenStatus: 'PREPARING',
          kitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
          kitchenDeliveredAt: null,
          additions: order.items[0].additions.map(addition => ({
            ...addition,
            kitchenDispatched: true,
            kitchenDispatchId: 901,
            kitchenStatus: 'PREPARING',
            kitchenDispatchedAt: '2026-09-08T12:10:00.000Z',
            kitchenDeliveredAt: null,
          })),
        },
        {
          ...order.items[0],
          id: 102,
          name: 'Ensalada nueva',
          specialInstructions: null,
          kitchenDispatched: false,
          kitchenDispatchId: null,
          kitchenStatus: null,
          kitchenDispatchedAt: null,
          kitchenDeliveredAt: null,
          additions: [],
        },
      ],
    };
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(mixedOrder);
      return Promise.resolve(mixedOrder);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    expect(screen.getAllByText('Cocina: En preparación').length).toBeGreaterThan(0);
    expect(screen.getByText('Pendiente de enviar')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Indicaciones para Ensalada nueva' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Indicaciones para Hamburguesa' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar a cocina' })).toBeEnabled();
  });

  it('permite enviar una orden OPEN aunque la cuenta ya haya sido solicitada', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22') return Promise.resolve(requestedOrder);
      return Promise.resolve(requestedOrder);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));

    expect(screen.getByText('Cuenta solicitada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar a cocina' })).toBeEnabled();
  });

  it('presenta conflictos de cocina con un mensaje operativo', async () => {
    const user = userEvent.setup();
    const conflict = Object.assign(new Error('conflict'), {
      body: { code: 'NO_PENDING_KITCHEN_ITEMS' },
    });
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/sales/tables') return Promise.resolve(tables);
      if (path === '/sales/orders/22/send-to-kitchen' && options?.method === 'POST') {
        return Promise.reject(conflict);
      }
      if (path === '/sales/orders/22') return Promise.resolve(order);
      return Promise.resolve(order);
    });

    render(<SalesOrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    await user.click(screen.getByRole('button', { name: 'Enviar a cocina' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Todos los productos ya fueron enviados a cocina.',
    );
  });

  it('revalida al recuperar foco sin perder el pedido seleccionado', async () => {
    render(<SalesOrdersPage />);
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(mocks.apiFetch.mock.calls.filter(([path]) => path === '/sales/tables')).toHaveLength(2));
  });
});
