import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecipeQuantityField from '@/components/recipes/RecipeQuantityField';

describe('guía accesible de cantidad de receta', () => {
  it.each([
    ['g', 'gramos'],
    ['ml', 'mililitros'],
    ['und', 'unidades'],
  ])('muestra %s y ayuda dinámica para productos', (unit, name) => {
    render(
      <RecipeQuantityField value={2} onChange={vi.fn()} productBaseUnit={unit} />,
    );

    expect(screen.getByLabelText(`Unidad de cantidad: ${unit}`)).toHaveTextContent(unit);
    expect(screen.getByText(
      `Registra la cantidad en ${name} (${unit}), que es la unidad base configurada para este producto.`,
    )).toBeInTheDocument();
    expect(screen.getByLabelText('Información sobre la unidad de cantidad'))
      .toBeInTheDocument();
  });

  it('no inventa unidad antes de seleccionar producto', () => {
    render(<RecipeQuantityField value={0} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(/Unidad de cantidad:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Información sobre la unidad de cantidad'))
      .not.toBeInTheDocument();
  });

  it('actualiza la cantidad y expresa subrecetas en porciones', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RecipeQuantityField value={0} onChange={onChange} isSubRecipe />);

    await user.type(screen.getByLabelText('Cantidad'), '2');
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByLabelText('Unidad de cantidad: porciones')).toBeInTheDocument();
    expect(screen.getByText('Registra la cantidad de porciones de la sub-receta.'))
      .toBeInTheDocument();
  });

  it('permite borrar temporalmente sin convertir el campo vacío en cero', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RecipeQuantityField value={2} onChange={onChange} productBaseUnit="g" />);

    await user.clear(screen.getByLabelText('Cantidad'));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra validación local para cero, negativo y vacío al intentar guardar', () => {
    const { rerender } = render(
      <RecipeQuantityField value={0} onChange={vi.fn()} productBaseUnit="g" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.');

    rerender(
      <RecipeQuantityField value={-1} onChange={vi.fn()} productBaseUnit="g" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0.');

    rerender(
      <RecipeQuantityField
        value=""
        onChange={vi.fn()}
        productBaseUnit="g"
        showIncompleteError
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad es obligatoria.');
  });
});
