import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateRecipePage from '@/pages/recipes/create';
import RecipeDetail from '@/pages/recipes/[id]';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { id: '7' }, isReady: true }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const products = [
  {
    id: 1,
    name: 'Pechuga de pollo',
    isIngredient: true,
    active: true,
    unitOfMeasure: 'g',
    inputUnit: 'kg',
    inputUnitQuantity: 1,
    unitCost: 18_000,
    caloriesPer100g: 165,
    proteinPer100g: 31,
  },
  {
    id: 2,
    name: 'Aceite',
    isIngredient: true,
    active: true,
    unitOfMeasure: 'ml',
    inputUnit: 'lt',
    inputUnitQuantity: 1,
    unitCost: 10_000,
  },
  {
    id: 3,
    name: 'Huevo',
    isIngredient: true,
    active: true,
    unitOfMeasure: 'und',
    inputUnit: 'docena',
    inputUnitQuantity: 1,
    unitCost: 12_000,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cantidad y preview de costos en recetas', () => {
  it('creación muestra la unidad seleccionada, la actualiza y calcula 200 g como 3600', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateRecipePage />);

    await screen.findByText('Crear Receta');
    await user.click(screen.getByRole('button', { name: '+ Ingrediente' }));
    expect(screen.queryByLabelText(/Unidad de cantidad:/)).not.toBeInTheDocument();

    const productOption = await screen.findByRole('option', { name: 'Pechuga de pollo' });
    const productSelect = productOption.parentElement as HTMLSelectElement;
    await user.selectOptions(productSelect, '1');
    expect(screen.getByLabelText('Unidad de cantidad: g')).toBeInTheDocument();
    expect(screen.getByText(/Registra la cantidad en gramos \(g\)/)).toBeInTheDocument();

    const quantity = screen.getByLabelText('Cantidad');
    await user.clear(quantity);
    await user.type(quantity, '200');
    expect(screen.getByText(/3[.,]600/)).toBeInTheDocument();

    await user.selectOptions(productSelect, '2');
    expect(screen.getByLabelText('Unidad de cantidad: ml')).toBeInTheDocument();
    expect(screen.getByText(/Registra la cantidad en mililitros \(ml\)/)).toBeInTheDocument();

    await user.selectOptions(productSelect, '3');
    expect(screen.getByLabelText('Unidad de cantidad: und')).toBeInTheDocument();
    expect(screen.getByText(/Registra la cantidad en unidades \(und\)/)).toBeInTheDocument();
  });

  it('edición conserva la unidad base visible y el costo convertido', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/recipes/7') {
        return {
          id: 7,
          name: 'Receta existente',
          description: '',
          portions: 1,
          items: [{ productId: 1, subRecipeId: null, quantity: 200 }],
          processes: [],
        };
      }
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<RecipeDetail />);

    await screen.findByDisplayValue('Receta existente');
    await user.click(screen.getByRole('button', { name: 'Ingredientes' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Unidad de cantidad: g')).toBeInTheDocument();
      expect(screen.getByText(/3[.,]600/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Registra la cantidad en gramos \(g\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar receta completa' }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true);
  });

  it('mantiene el costo válido con varias filas y no guarda una fila incompleta', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateRecipePage />);

    await user.click(screen.getByRole('button', { name: '+ Ingrediente' }));
    let ingredientOptions = await screen.findAllByRole('option', { name: 'Pechuga de pollo' });
    await user.selectOptions(ingredientOptions[0].parentElement as HTMLSelectElement, '1');
    await user.type(screen.getByLabelText('Cantidad'), '200');

    await user.click(screen.getByRole('button', { name: '+ Ingrediente' }));
    ingredientOptions = await screen.findAllByRole('option', { name: 'Aceite' });
    await user.selectOptions(ingredientOptions[1].parentElement as HTMLSelectElement, '2');

    expect(screen.getByText(/3[.,]600/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar Receta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad es obligatoria.');
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('una cantidad negativa no rompe creación y bloquea el guardado', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateRecipePage />);

    await user.click(screen.getByRole('button', { name: '+ Ingrediente' }));
    const option = await screen.findByRole('option', { name: 'Pechuga de pollo' });
    await user.selectOptions(option.parentElement as HTMLSelectElement, '1');
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '-1' } });

    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.');
    await user.click(screen.getByRole('button', { name: 'Guardar Receta' }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('cantidad cero con producto seleccionado muestra validación y bloquea creación', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateRecipePage />);

    await user.click(screen.getByRole('button', { name: '+ Ingrediente' }));
    const option = await screen.findByRole('option', { name: 'Pechuga de pollo' });
    await user.selectOptions(option.parentElement as HTMLSelectElement, '1');
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '0' } });

    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.');
    await user.click(screen.getByRole('button', { name: 'Guardar Receta' }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('cantidad cero persistida bloquea la edición de una receta', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/recipes/7') {
        return {
          id: 7,
          name: 'Receta con cero',
          description: '',
          portions: 1,
          items: [{ productId: 1, subRecipeId: null, quantity: 0 }],
          processes: [],
        };
      }
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<RecipeDetail />);

    await screen.findByDisplayValue('Receta con cero');
    await user.click(screen.getByRole('button', { name: 'Ingredientes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.');

    await user.click(screen.getByRole('button', { name: 'Guardar receta completa' }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it('un dato no numérico cargado no se convierte en cero y bloquea edición', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/recipes/7') {
        return {
          id: 7,
          name: 'Receta inválida',
          description: '',
          portions: 1,
          items: [{ productId: 1, subRecipeId: null, quantity: 'abc' }],
          processes: [],
        };
      }
      if (path === '/products') return products;
      if (path === '/recipes') return [];
      throw new Error(`Endpoint inesperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<RecipeDetail />);

    await screen.findByDisplayValue('Receta inválida');
    await user.click(screen.getByRole('button', { name: 'Ingredientes' }));
    expect(screen.getByLabelText('Cantidad')).toHaveValue(null);
    expect(screen.getByRole('alert')).toHaveTextContent(/número válido/);

    await user.click(screen.getByRole('button', { name: 'Guardar receta completa' }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });
});
