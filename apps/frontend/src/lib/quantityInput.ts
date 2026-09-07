export type QuantityInputValue = number | string | null | undefined;

export type QuantityState =
  | { status: 'incomplete' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; value: number };

export function classifyQuantity(value: unknown): QuantityState {
  if (value === '' || value === null || value === undefined) {
    return { status: 'incomplete' };
  }

  const quantity = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(quantity)) {
    return {
      status: 'invalid',
      message: 'La cantidad debe ser un número válido.',
    };
  }

  if (quantity <= 0) {
    return {
      status: 'invalid',
      message: 'La cantidad debe ser mayor que 0.',
    };
  }

  return { status: 'valid', value: quantity };
}

export function quantityInputValue(rawValue: string): number | '' {
  return rawValue === '' ? '' : Number(rawValue);
}

export function quantityError(
  value: unknown,
  showIncomplete: boolean,
): string | null {
  const state = classifyQuantity(value);
  if (state.status === 'invalid') return state.message;
  if (state.status === 'incomplete' && showIncomplete) {
    return 'La cantidad es obligatoria.';
  }
  return null;
}

export function allQuantitiesValid(
  items: ReadonlyArray<{ quantity?: unknown }>,
): boolean {
  return items.every(item => classifyQuantity(item.quantity).status === 'valid');
}
