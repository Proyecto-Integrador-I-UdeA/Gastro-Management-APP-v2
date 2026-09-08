import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesTablesAdminPage from '@/pages/sales/tables';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/permissions', () => ({ getUserPermissions: mocks.getUserPermissions }));
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const tables = {
  tables: [
    {
      id: 1,
      code: 'A-01',
      area: 'Salón',
      capacity: 4,
      active: true,
      operationalStatus: 'AVAILABLE',
      activeOrder: null,
    },
    {
      id: 2,
      code: 'A-02',
      area: 'Salón',
      capacity: 2,
      active: true,
      operationalStatus: 'OCCUPIED',
      activeOrder: { id: 42 },
    },
    {
      id: 3,
      code: 'P-01',
      area: null,
      capacity: 6,
      active: false,
      operationalStatus: 'OUT_OF_SERVICE',
      activeOrder: null,
    },
  ],
};

const createdTable = {
  id: 4,
  code: 'T-04',
  area: 'Terraza',
  capacity: 5,
  active: true,
  operationalStatus: 'AVAILABLE',
  activeOrder: null,
};

function defaultApi(path: string, options?: { method?: string; json?: Record<string, unknown> }) {
  if (path === '/sales/tables' && !options?.method) return Promise.resolve(tables);
  if (path === '/sales/tables' && options?.method === 'POST') return Promise.resolve(createdTable);
  if (path === '/sales/tables/1' && options?.method === 'PATCH') {
    return Promise.resolve({
      ...tables.tables[0],
      ...options.json,
      operationalStatus: options.json?.active === false ? 'OUT_OF_SERVICE' : 'AVAILABLE',
    });
  }
  if (path === '/sales/tables/2' && options?.method === 'PATCH') {
    return Promise.reject(Object.assign(new Error('conflict'), {
      body: {
        code: 'TABLE_HAS_ACTIVE_ORDER',
        error: 'No se puede poner fuera de servicio una mesa con un pedido abierto',
      },
    }));
  }
  if (path === '/sales/tables/3' && options?.method === 'PATCH') {
    return Promise.resolve({
      ...tables.tables[2],
      active: true,
      operationalStatus: 'AVAILABLE',
    });
  }
  throw new Error(`Endpoint no esperado: ${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserPermissions.mockReturnValue(['sales.read', 'sales.tables.manage']);
  mocks.apiFetch.mockImplementation(defaultApi);
});

describe('administración de mesas', () => {
  it('lista las mesas y oculta todas las acciones sin sales.tables.manage', async () => {
    mocks.getUserPermissions.mockReturnValue(['sales.read']);
    render(<SalesTablesAdminPage />);

    expect(await screen.findByText('Mesa A-01')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear mesa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByText(/Vista de solo lectura/)).toBeInTheDocument();
  });

  it('crea una mesa enviando exclusivamente sus campos configurables', async () => {
    const user = userEvent.setup();
    render(<SalesTablesAdminPage />);
    await screen.findByText('Mesa A-01');

    await user.type(screen.getByRole('textbox', { name: 'Código o nombre' }), ' T-04 ');
    await user.type(screen.getByRole('textbox', { name: 'Área' }), ' Terraza ');
    await user.type(screen.getByRole('spinbutton', { name: 'Capacidad' }), '5');
    await user.click(screen.getByRole('button', { name: 'Crear mesa' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/tables', {
      method: 'POST',
      json: { code: 'T-04', area: 'Terraza', capacity: 5, active: true },
    }));
    expect(await screen.findByText('Mesa T-04')).toBeInTheDocument();
  });

  it('muestra validación local y el conflicto seguro de código duplicado', async () => {
    const user = userEvent.setup();
    render(<SalesTablesAdminPage />);
    await screen.findByText('Mesa A-01');

    await user.click(screen.getByRole('button', { name: 'Crear mesa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El código de la mesa es obligatorio');

    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/sales/tables' && !options?.method) return Promise.resolve(tables);
      if (path === '/sales/tables' && options?.method === 'POST') {
        return Promise.reject(Object.assign(new Error('duplicate'), {
          body: { code: 'TABLE_CODE_ALREADY_EXISTS' },
        }));
      }
      return defaultApi(path, options);
    });
    await user.type(screen.getByRole('textbox', { name: 'Código o nombre' }), 'A-01');
    await user.type(screen.getByRole('spinbutton', { name: 'Capacidad' }), '4');
    await user.click(screen.getByRole('button', { name: 'Crear mesa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una mesa con ese código');
  });

  it('edita código, área y capacidad con un único PATCH', async () => {
    const user = userEvent.setup();
    render(<SalesTablesAdminPage />);
    const tableCard = (await screen.findByText('Mesa A-01')).closest('article');
    expect(tableCard).not.toBeNull();
    await user.click(within(tableCard as HTMLElement).getByRole('button', { name: 'Editar' }));

    const code = screen.getByRole('textbox', { name: 'Editar código A-01' });
    const area = screen.getByRole('textbox', { name: 'Editar área A-01' });
    const capacity = screen.getByRole('spinbutton', { name: 'Editar capacidad A-01' });
    await user.clear(code);
    await user.type(code, 'A-10');
    await user.clear(area);
    await user.type(area, 'Patio');
    await user.clear(capacity);
    await user.type(capacity, '8');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/tables/1', {
      method: 'PATCH',
      json: { code: 'A-10', area: 'Patio', capacity: 8 },
    }));
    expect(await screen.findByText('Mesa A-10')).toBeInTheDocument();
  });

  it('activa y desactiva mesas libres usando la respuesta canónica', async () => {
    const user = userEvent.setup();
    render(<SalesTablesAdminPage />);
    const activeCard = (await screen.findByText('Mesa A-01')).closest('article');
    const inactiveCard = screen.getByText('Mesa P-01').closest('article');

    await user.click(within(activeCard as HTMLElement).getByRole('button', { name: 'Poner fuera de servicio' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/tables/1', {
      method: 'PATCH',
      json: { active: false },
    }));
    await user.click(within(inactiveCard as HTMLElement).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/tables/3', {
      method: 'PATCH',
      json: { active: true },
    }));
  });

  it('expone de forma segura el conflicto al desactivar una mesa ocupada', async () => {
    const user = userEvent.setup();
    render(<SalesTablesAdminPage />);
    const occupiedCard = (await screen.findByText('Mesa A-02')).closest('article');

    await user.click(within(occupiedCard as HTMLElement).getByRole('button', { name: 'Poner fuera de servicio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se puede poner fuera de servicio una mesa con un pedido abierto',
    );
    expect(screen.getByText('Mesa A-02')).toBeInTheDocument();
  });
});
