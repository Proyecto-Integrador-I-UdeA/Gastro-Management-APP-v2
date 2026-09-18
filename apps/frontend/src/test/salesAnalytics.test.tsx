import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesAnalyticsPage from '@/pages/sales/analytics';

const mocks = vi.hoisted(() => ({
  fetchSalesAnalytics: vi.fn(),
}));

vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: vi.fn() }));
vi.mock('@/lib/salesAnalyticsApi', () => ({ fetchSalesAnalytics: mocks.fetchSalesAnalytics }));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const response = {
  period: { preset: 'day', from: '2026-09-18', to: '2026-09-18', date: '2026-09-18' },
  currencies: [{
    currency: 'COP',
    summary: { salesAmount: '100.00', consumptionTaxAmount: '8.00', serviceAmount: '10.00', totalCollected: '118.00', closedOrders: 1, unitsSold: 2 },
    products: [{ menuItemId: 1, name: 'Hamburguesa', quantity: 2, salesAmount: '100.00', consumptionTaxAmount: '8.00', grossAmount: '108.00', consumptionSubtotal: '108.00' }],
    additions: [{ menuItemId: 2, name: 'Queso', quantity: 1, salesAmount: '5.00', consumptionTaxAmount: '0.40', grossAmount: '5.40', consumptionSubtotal: '5.40' }],
    categories: [{ categoryId: 3, categoryName: 'Fuertes', quantity: 3, salesAmount: '105.00', consumptionTaxAmount: '8.40', grossAmount: '113.40', consumptionSubtotal: '113.40' }],
    details: [{ settledAt: '2026-09-18T17:00:00.000Z', orderId: 10, table: 'M1', items: [{ name: 'Hamburguesa', quantity: 2, isAddition: false }], salesAmount: '100.00', consumptionTaxAmount: '8.00', serviceAmount: '10.00', totalCollected: '118.00', currency: 'COP' }],
  }],
  yearToDate: { from: '2026-01-01', to: '2026-09-18', currencies: [] },
  filterOptions: {
    products: [{ menuItemId: 1, name: 'Hamburguesa histórica' }],
    categories: [{ categoryId: 3, name: 'Fuertes' }],
    years: [2026, 2025],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchSalesAnalytics.mockResolvedValue(response);
});

describe('SALES-01A Sales Analytics', () => {
  it('muestra KPIs, productos, adiciones, categorías y detalle', async () => {
    render(<SalesAnalyticsPage />);
    expect(await screen.findByRole('heading', { name: 'Analítica de ventas' })).toBeInTheDocument();
    expect(screen.getByText('Productos vendidos')).toBeInTheDocument();
    expect(screen.getByText('Adiciones vendidas')).toBeInTheDocument();
    expect(screen.getByText('Ventas por categoría · COP')).toBeInTheDocument();
    expect(screen.getByText('Detalle de ventas · COP')).toBeInTheDocument();
    expect(screen.getAllByText('Hamburguesa').length).toBeGreaterThan(0);
    expect(screen.getByText('Servicio voluntario')).toBeInTheDocument();
    expect(screen.getByText(/Acumulado del año 2026/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Hamburguesa histórica' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fuertes' })).toBeInTheDocument();
  });

  it('envía periodo personalizado y filtro de producto', async () => {
    const user = userEvent.setup();
    render(<SalesAnalyticsPage />);
    await screen.findByRole('heading', { name: 'Analítica de ventas' });
    await user.click(screen.getByRole('button', { name: 'Personalizado' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Producto' }), '1');
    expect(mocks.fetchSalesAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'custom', from: '2026-09-18', to: '2026-09-18', menuItemId: 1 }));
  });

  it('muestra controles históricos y permite expandir el acumulado anual sin recargar', async () => {
    const user = userEvent.setup();
    render(<SalesAnalyticsPage />);
    await screen.findByRole('heading', { name: 'Analítica de ventas' });
    expect(screen.getByRole('button', { name: /Acumulado del año 2026/ })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: /Semana/ }));
    expect(screen.getByLabelText('Semana seleccionada')).toHaveValue('2026-09-18');
    expect(screen.getByText(/Semana .* de 2026/)).toBeInTheDocument();
    expect(mocks.fetchSalesAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'week', week: '2026-09-18' }));
    await user.click(screen.getByRole('button', { name: /Mes/ }));
    expect(screen.getByLabelText('Mes seleccionado')).toHaveValue('2026-09');
    expect(mocks.fetchSalesAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'month', month: '2026-09' }));
    await user.click(screen.getByRole('button', { name: /Año/ }));
    expect(screen.getByLabelText('Año seleccionado')).toHaveValue('2026');
    expect(mocks.fetchSalesAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'year', year: '2026' }));
    await user.click(screen.getByRole('button', { name: /Acumulado del año 2026/ }));
    expect(screen.getByRole('button', { name: /Acumulado del año 2026/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('muestra estado vacío y error de API', async () => {
    mocks.fetchSalesAnalytics.mockResolvedValueOnce({ ...response, currencies: [] });
    render(<SalesAnalyticsPage />);
    expect(await screen.findByText('No hay ventas cerradas para los filtros seleccionados.')).toBeInTheDocument();
    mocks.fetchSalesAnalytics.mockRejectedValueOnce(new Error('Sin conexión'));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  });
});
