import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryPage from '@/pages/inventory';

const mocks = vi.hoisted(() => ({
  inventories: vi.fn(),
  warehouses: vi.fn(),
  router: { push: vi.fn() },
}));

vi.mock('@/lib/inventoriesApi', () => ({ fetchInventories: mocks.inventories }));
vi.mock('@/lib/warehousesApi', () => ({ fetchWarehouses: mocks.warehouses }));
vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Inventario negativo', () => {
  beforeEach(() => {
    mocks.warehouses.mockResolvedValue([{ id: 1, name: 'Bodega Principal', active: true }]);
    mocks.inventories.mockResolvedValue([{
      id: 1,
      quantity: -70,
      productId: 1,
      warehouseId: 1,
      product: {
        id: 1,
        internalCode: 'POLLO',
        name: 'Pechuga de pollo',
        unitOfMeasure: 'g',
        inputUnit: 'kg',
        inputUnitQuantity: 1,
        minStock: 100,
        maxStock: 1000,
        supplier: null,
      },
      warehouse: { id: 1, name: 'Bodega Principal', active: true },
    }]);
  });

  it('conserva el saldo real y lo marca como Requiere revisión', async () => {
    render(<InventoryPage />);
    await waitFor(() => expect(screen.getByText('Requiere revisión')).toBeInTheDocument());
    expect(screen.getByText('-70')).toBeInTheDocument();
    expect(screen.queryByText('Aumentar merma')).not.toBeInTheDocument();
  });
});
