import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PriceCalculationPage from '@/pages/costs/price';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/toast', () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess,
}));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const currentPrice = {
  id: 10,
  amount: '31000.00',
  marginRate: '0.350000',
  taxRate: '0.190000',
  validFrom: '2026-09-01T00:00:00.000Z',
  validUntil: null,
};

const preview = {
  menuItemId: 1,
  cost: {
    baseCost: '12000.0000',
    indirectCost: '5000.0000',
    totalCost: '17000.0000',
  },
  pricing: {
    marginRate: '0.400000',
    taxRate: '0.190000',
    priceBeforeTax: '28333.3333',
    taxAmount: '5383.3333',
    calculatedAmount: '33716.6666',
    roundingIncrement: '1000.00',
    amount: '34000.00',
    currency: 'COP',
    taxIncluded: true,
  },
  currentPrice,
};

const publishedPrice = {
  ...currentPrice,
  id: 11,
  amount: '34000.00',
  marginRate: '0.400000',
};

function configureApi(existingPrice: typeof currentPrice | null = currentPrice) {
  mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/menu-items') {
      return [{ id: 1, name: 'Plato de prueba', active: true }];
    }
    if (path.endsWith('/sale-prices')) {
      return existingPrice ? [existingPrice] : [];
    }
    if (path.endsWith('/sale-price/calculate')) {
      const body = JSON.parse(String(options?.body));
      return {
        ...preview,
        pricing: {
          ...preview.pricing,
          marginRate: body.marginRate,
          taxRate: body.taxRate,
        },
        currentPrice: existingPrice,
      };
    }
    if (path.endsWith('/sale-price')) {
      return {
        ...preview,
        currentPrice: publishedPrice,
      };
    }
    throw new Error(`Endpoint inesperado: ${path}`);
  });
}

async function selectMenuItem() {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('option', { name: 'Plato de prueba' }))
    .toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText('Seleccionar plato'), '1');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Preview de precio' }))
    .toBeInTheDocument());
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  configureApi();
});

describe('pantalla oficial de precios de venta', () => {
  it('muestra el preview del backend separado del precio vigente', async () => {
    render(<PriceCalculationPage />);
    await selectMenuItem();

    const previewSection = screen.getByRole('heading', { name: 'Preview de precio' })
      .closest('section')!;
    const currentSection = screen.getByRole('heading', { name: 'Precio vigente' })
      .closest('section')!;

    expect(within(previewSection).getByText(/34[.,]000/)).toBeInTheDocument();
    expect(within(currentSection).getByText(/31[.,]000/)).toBeInTheDocument();
    expect(within(previewSection).getByText(/Costo actual:/)).toBeInTheDocument();
    expect(within(previewSection).getByText(/Precio calculado:/)).toBeInTheDocument();
  });

  it('recalcula al editar tasas sin publicar automáticamente', async () => {
    render(<PriceCalculationPage />);
    const user = await selectMenuItem();
    mocks.apiFetch.mockClear();

    const marginInput = screen.getByLabelText('Margen de utilidad');
    const taxInput = screen.getByLabelText('Impuesto');
    await user.clear(marginInput);
    await user.type(marginInput, '0.5');
    await user.clear(taxInput);
    await user.type(taxInput, '0.2');

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/costs/menu-items/1/sale-price/calculate',
        {
          method: 'POST',
          body: JSON.stringify({ marginRate: '0.5', taxRate: '0.2' }),
        },
      );
    });
    expect(mocks.apiFetch.mock.calls.some(([path]) => (
      path === '/costs/menu-items/1/sale-price'
    ))).toBe(false);
  });

  it('publica solo tasas y usa la respuesta backend como nuevo precio vigente', async () => {
    render(<PriceCalculationPage />);
    const user = await selectMenuItem();

    await user.click(screen.getByRole('button', { name: 'Actualizar precio de venta' }));

    await waitFor(() => expect(mocks.showSuccess)
      .toHaveBeenCalledWith('Precio de venta publicado correctamente'));
    const publishCall = mocks.apiFetch.mock.calls.find(([path]) => (
      path === '/costs/menu-items/1/sale-price'
    ));
    expect(publishCall).toBeDefined();
    expect(JSON.parse(String(publishCall?.[1]?.body))).toEqual({
      marginRate: '0.400000',
      taxRate: '0.190000',
    });
    expect(JSON.parse(String(publishCall?.[1]?.body))).not.toHaveProperty('amount');

    const currentSection = screen.getByRole('heading', { name: 'Precio vigente' })
      .closest('section')!;
    expect(within(currentSection).getByText(/34[.,]000/)).toBeInTheDocument();
  });

  it('ofrece Guardar cuando todavía no existe precio vigente', async () => {
    mocks.apiFetch.mockReset();
    configureApi(null);
    render(<PriceCalculationPage />);
    await selectMenuItem();

    expect(screen.getByRole('button', { name: 'Guardar precio de venta' }))
      .toBeInTheDocument();
  });
});
