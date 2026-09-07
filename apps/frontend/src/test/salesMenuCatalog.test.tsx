import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesMenuCatalogPage from '@/pages/sales/menu';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock('@/utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/permissions', () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const catalog = {
  categories: [{
    id: 1,
    name: 'Platos fuertes',
    displayOrder: 1,
    items: [{
      id: 10,
      name: 'Ajiaco santafereño',
      description: 'Ajiaco tradicional',
      kind: 'STANDARD',
      available: true,
      includedItemsText: 'Incluye arroz y aguacate.',
      category: { id: 1, name: 'Platos fuertes' },
      price: {
        amount: '34000.00',
        currency: 'COP',
        taxIncluded: true,
        validFrom: '2026-09-06T12:00:00.000Z',
      },
    }],
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserPermissions.mockReturnValue(['sales.read']);
  mocks.apiFetch.mockResolvedValue(catalog);
});

describe('catálogo operacional de ventas', () => {
  it('carga únicamente el endpoint de Sales y muestra categoría, plato y precio COP', async () => {
    render(<SalesMenuCatalogPage />);

    expect(await screen.findByRole('heading', { name: 'Ajiaco santafereño' }))
      .toBeInTheDocument();
    expect(screen.getAllByText('Platos fuertes').length).toBeGreaterThan(0);
    expect(screen.getByText(/34[.\s]?000/)).toBeInTheDocument();
    expect(screen.getByText('Incluye arroz y aguacate.')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/sales/menu-catalog');
    expect(mocks.apiFetch.mock.calls.some(([path]) => String(path).startsWith('/menu-items')))
      .toBe(false);
    expect(mocks.apiFetch.mock.calls.some(([path]) => String(path).startsWith('/costs/')))
      .toBe(false);
    expect(screen.queryByText(/costo|margen|impuesto/i)).not.toBeInTheDocument();
  });

  it('mantiene visible un item activo agotado como referencia operacional', async () => {
    mocks.apiFetch.mockResolvedValue({
      categories: [{
        ...catalog.categories[0],
        items: [{ ...catalog.categories[0].items[0], available: false }],
      }],
    });

    render(<SalesMenuCatalogPage />);

    expect(await screen.findByRole('heading', { name: 'Ajiaco santafereño' }))
      .toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('muestra estado vacío como condición operacional normal', async () => {
    mocks.apiFetch.mockResolvedValue({ categories: [] });

    render(<SalesMenuCatalogPage />);

    expect(await screen.findByText('No hay productos disponibles para la venta.'))
      .toBeInTheDocument();
  });

  it('depende de sales.read y no consulta la API cuando falta el permiso', async () => {
    mocks.getUserPermissions.mockReturnValue([]);

    render(<SalesMenuCatalogPage />);

    expect(await screen.findByText('No tienes permiso para consultar el catálogo de ventas.'))
      .toBeInTheDocument();
    await waitFor(() => expect(mocks.apiFetch).not.toHaveBeenCalled());
  });
});
