import { useId } from 'react';
import {
  isProductBaseUnit,
  productBaseUnitName,
  ProductBaseUnit,
} from '@/lib/productUnits';
import {
  QuantityInputValue,
  quantityError,
  quantityInputValue,
} from '@/lib/quantityInput';

type RecipeQuantityFieldProps = {
  value: QuantityInputValue;
  onChange: (value: number | '') => void;
  productBaseUnit?: string | null;
  isSubRecipe?: boolean;
  showIncompleteError?: boolean;
};

function productHelp(unit: ProductBaseUnit): string {
  return `Registra la cantidad en ${productBaseUnitName(unit)} (${unit}), que es la unidad base configurada para este producto.`;
}

export default function RecipeQuantityField({
  value,
  onChange,
  productBaseUnit,
  isSubRecipe = false,
  showIncompleteError = false,
}: RecipeQuantityFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const baseUnit = isProductBaseUnit(productBaseUnit)
    ? productBaseUnit
    : null;
  const unitLabel = isSubRecipe ? 'porciones' : baseUnit;
  const helpText = isSubRecipe
    ? 'Registra la cantidad de porciones de la sub-receta.'
    : baseUnit
      ? productHelp(baseUnit)
      : null;
  const validationError = quantityError(value, showIncompleteError);
  const displayValue =
    typeof value === 'number'
      ? Number.isFinite(value) ? value : ''
      : typeof value === 'string' && value !== '' && Number.isFinite(Number(value))
        ? value
        : '';

  return (
    <div className="w-1/4 min-w-[9rem]">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
        <label htmlFor={inputId}>Cantidad</label>
        {helpText && (
          <details className="relative">
            <summary
              className="cursor-help list-none rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Información sobre la unidad de cantidad"
            >
              ⓘ
            </summary>
            <p className="absolute right-0 z-10 mt-1 w-64 rounded-lg bg-slate-900 p-2 text-left text-xs font-normal text-white shadow-lg">
              {helpText}
            </p>
          </details>
        )}
      </div>
      <div className="flex items-stretch">
        <input
          id={inputId}
          type="number"
          min="0"
          step="any"
          className="min-w-0 flex-1 rounded-l border p-2 text-right"
          value={displayValue}
          onChange={(event) => onChange(quantityInputValue(event.target.value))}
          aria-invalid={validationError ? 'true' : 'false'}
          aria-describedby={validationError ? errorId : undefined}
        />
        {unitLabel && (
          <span
            className="flex items-center rounded-r border border-l-0 bg-slate-100 px-2 text-sm font-semibold text-slate-700"
            aria-label={`Unidad de cantidad: ${unitLabel}`}
          >
            {unitLabel}
          </span>
        )}
      </div>
      {validationError && (
        <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
