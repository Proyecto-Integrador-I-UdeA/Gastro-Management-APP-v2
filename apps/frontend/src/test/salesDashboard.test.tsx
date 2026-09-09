import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesDashboardPage from '@/pages/sales';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/utils/permissions', () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserPermissions.mockReturnValue(['sales.read']);
});

describe('dashboard del módulo de Ventas', () => {
  it('mantiene los módulos de Ventas y oculta Cocina sin kitchen.read', async () => {
    render(<SalesDashboardPage />);

    expect(await screen.findByRole('button', { name: /Mesas y pedidos/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Cocina/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Menú y precios/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Caja/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reservas y eventos/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Ventas / })).toBeDisabled();
  });

  it('muestra Cocina con kitchen.read y navega a /kitchen', async () => {
    const user = userEvent.setup();
    mocks.getUserPermissions.mockReturnValue(['sales.read', 'kitchen.read']);
    render(<SalesDashboardPage />);

    await user.click(await screen.findByRole('button', { name: /Cocina/ }));
    expect(mocks.push).toHaveBeenCalledWith('/kitchen');
  });

  it('navega desde Menú y precios hacia /sales/menu', async () => {
    const user = userEvent.setup();
    render(<SalesDashboardPage />);

    await user.click(await screen.findByRole('button', { name: /Menú y precios/ }));

    expect(mocks.push).toHaveBeenCalledWith('/sales/menu');
  });

  it('navega desde Mesas y pedidos hacia /sales/orders', async () => {
    const user = userEvent.setup();
    render(<SalesDashboardPage />);

    await user.click(await screen.findByRole('button', { name: /Mesas y pedidos/ }));

    expect(mocks.push).toHaveBeenCalledWith('/sales/orders');
  });

  it('protege también el dashboard cuando falta sales.read', async () => {
    mocks.getUserPermissions.mockReturnValue([]);

    render(<SalesDashboardPage />);

    expect(await screen.findByText('No tienes permiso para acceder al módulo de ventas.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Menú y precios/ })).not.toBeInTheDocument();
  });
});
