import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateWarehousePage from '@/pages/transfers/warehouses/create';
import EditWarehousePage from '@/pages/transfers/warehouses/edit';
import TransfersPage from '@/pages/transfers';
import type { InventoryMovementRow, InventoryMovementType } from '@/types/transfer';

const mocks = vi.hoisted(() => ({
  router: { query: {} as Record<string, string>, isReady: true, push: vi.fn(), replace: vi.fn() },
  permissions: vi.fn(),
  createWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  fetchWarehouse: vi.fn(),
  fetchMovements: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: vi.fn(), useAuthGuardAny: vi.fn() }));
vi.mock('@/components/layouts/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/utils/permissions', () => ({
  getUserPermissions: mocks.permissions,
  PERMS_WAREHOUSE_MUTATE: ['warehouses.update'],
  userCanMutateWarehouse: () => true,
}));
vi.mock('@/utils/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock('@/lib/warehousesApi', () => ({
  createWarehouseRequest: mocks.createWarehouse,
  updateWarehouseRequest: mocks.updateWarehouse,
  fetchWarehouseById: mocks.fetchWarehouse,
}));
vi.mock('@/lib/inventoryMovementsApi', () => ({
  fetchInventoryMovements: mocks.fetchMovements,
  deleteTransferRequest: vi.fn(),
}));

const movements: InventoryMovementRow[] = [
  {
    id: 1, type: 'TRANSFER', quantity: 100, unitCost: null, expirationDate: null, notes: 'Traslado inicial',
    productId: 1, sourceWarehouseId: 1, destinationWarehouseId: 2, userId: 7,
    createdAt: '2026-09-15T12:00:00.000Z', product: { id: 1, internalCode: 'P-001', name: 'Pechuga', unitOfMeasure: 'g' },
    sourceWarehouse: { id: 1, name: 'Bodega Principal', description: null, active: true }, destinationWarehouse: { id: 2, name: 'Bodega Cocina', description: null, active: true },
    user: { id: 7, email: 'admin@test.local', fullName: 'Admin' },
  },
  {
    id: 2, type: 'CONSUMPTION', quantity: 50, unitCost: null, expirationDate: null, notes: 'Consumo automático Cocina · dispatch #9',
    productId: 1, sourceWarehouseId: 2, destinationWarehouseId: null, userId: 7,
    createdAt: '2026-09-15T12:05:00.000Z', product: { id: 1, internalCode: 'P-001', name: 'Pechuga', unitOfMeasure: 'g' },
    sourceWarehouse: { id: 2, name: 'Bodega Cocina', description: null, active: true }, destinationWarehouse: null,
    user: { id: 7, email: 'admin@test.local', fullName: 'Admin' },
  },
  {
    id: 3, type: 'ADJUSTMENT', quantity: -5, unitCost: null, expirationDate: null, notes: 'Conteo físico #3',
    productId: 1, sourceWarehouseId: 2, destinationWarehouseId: null, userId: 7,
    createdAt: '2026-09-15T12:10:00.000Z', product: { id: 1, internalCode: 'P-001', name: 'Pechuga', unitOfMeasure: 'g' },
    sourceWarehouse: { id: 2, name: 'Bodega Cocina', description: null, active: true }, destinationWarehouse: null,
    user: { id: 7, email: 'admin@test.local', fullName: 'Admin' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.router.query = {};
  mocks.router.isReady = true;
  mocks.permissions.mockReturnValue(['warehouses.create', 'warehouses.update', 'transfers.read', 'transfers.create', 'transfers.update', 'transfers.delete']);
  mocks.createWarehouse.mockResolvedValue({ id: 2 });
  mocks.updateWarehouse.mockResolvedValue({ id: 2 });
  mocks.fetchWarehouse.mockResolvedValue({
    id: 2,
    name: 'Bodega Cocina',
    description: 'Operación caliente',
    active: true,
    isMain: false,
    purchaseReceiving: false,
    kitchenConsumption: true,
    barConsumption: false,
  });
  mocks.fetchMovements.mockImplementation(({ types }: { types?: InventoryMovementType[] }) => {
    const items = types?.length ? movements.filter(item => types.includes(item.type)) : movements;
    return Promise.resolve({ items, total: items.length });
  });
});

describe('routing operativo de inventario', () => {
  it('crea una bodega con múltiples usos operativos', async () => {
    const user = userEvent.setup();
    render(<CreateWarehousePage />);
    await user.type(screen.getAllByRole('textbox')[0], 'Bodega Integral');
    await user.click(screen.getByLabelText('Recepción de compras'));
    await user.click(screen.getByLabelText('Consumo de Cocina'));
    await user.click(screen.getByLabelText('Consumo de Bar'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mocks.createWarehouse).toHaveBeenCalledWith({
      name: 'Bodega Integral',
      description: null,
      active: true,
      isMain: false,
      purchaseReceiving: true,
      kitchenConsumption: true,
      barConsumption: true,
    });
  });

  it('carga y edita los usos existentes de una bodega', async () => {
    mocks.router.query = { id: '2' };
    const user = userEvent.setup();
    render(<EditWarehousePage />);
    expect(await screen.findByLabelText('Consumo de Cocina')).toBeChecked();
    expect(screen.getByLabelText('Recepción de compras')).not.toBeChecked();
    await user.click(screen.getByLabelText('Consumo de Bar'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mocks.updateWarehouse).toHaveBeenCalledWith(2, expect.objectContaining({
      purchaseReceiving: false,
      kitchenConsumption: true,
      barConsumption: true,
    }));
  });

  it('muestra el conflicto funcional devuelto por el backend', async () => {
    mocks.createWarehouse.mockRejectedValue(Object.assign(new Error('Conflict'), {
      body: { error: 'El uso Consumo de Cocina ya está asignado a la bodega activa "Bodega Cocina"' },
    }));
    const user = userEvent.setup();
    render(<CreateWarehousePage />);
    await user.type(screen.getAllByRole('textbox')[0], 'Segunda Cocina');
    await user.click(screen.getByLabelText('Consumo de Cocina'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/ya está asignado a la bodega activa "Bodega Cocina"/)).toBeInTheDocument();
  });

  it('lista consumos y ajustes con origen/destino correctos y permite filtrarlos', async () => {
    const user = userEvent.setup();
    render(<TransfersPage />);
    expect(await screen.findByRole('heading', { name: 'Movimientos de inventario' })).toBeInTheDocument();
    expect(screen.getByText('Consumo')).toBeInTheDocument();
    expect(screen.getByText('Ajuste')).toBeInTheDocument();
    const consumptionRow = screen.getByText('Consumo automático Cocina · dispatch #9').closest('tr')!;
    expect(within(consumptionRow).getByText('Bodega Cocina')).toBeInTheDocument();
    expect(within(consumptionRow).getByText('50 g')).toBeInTheDocument();
    expect(within(consumptionRow).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(consumptionRow).queryByText('Modificar')).not.toBeInTheDocument();
    expect(within(consumptionRow).queryByText('Eliminar')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Consumos' }));
    await waitFor(() => expect(mocks.fetchMovements).toHaveBeenLastCalledWith({
      skip: 0,
      take: 100,
      types: ['CONSUMPTION'],
    }));
    expect(screen.getByText('Consumo')).toBeInTheDocument();
    expect(screen.queryByText('Ajuste')).not.toBeInTheDocument();
  });
});
