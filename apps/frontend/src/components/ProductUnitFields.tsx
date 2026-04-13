'use client';

import { useMemo } from 'react';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  PRODUCT_BASE_UNITS,
  PRODUCT_INPUT_UNITS,
  convertToBaseUnits,
  inputUnitsForBase,
} from '@/lib/productUnits';

type Props = {
  baseUnit: ProductBaseUnit;
  onBaseUnitChange: (b: ProductBaseUnit) => void;
  inputUnit: ProductInputUnit;
  onInputUnitChange: (u: ProductInputUnit) => void;
  inputUnitQuantity: string;
  onInputUnitQuantityChange: (v: string) => void;
};

const BASE_CONTEXT: Record<ProductBaseUnit, string> = {
  g: 'El sistema guardará el peso siempre en gramos (g). Así las recetas e inventario suman bien.',
  ml: 'El sistema guardará el volumen siempre en mililitros (ml).',
  und: 'El sistema contará en unidades sueltas (und): piezas, envases, etc.',
};

export default function ProductUnitFields({
  baseUnit,
  onBaseUnitChange,
  inputUnit,
  onInputUnitChange,
  inputUnitQuantity,
  onInputUnitQuantityChange,
}: Props) {
  const inputOptions = useMemo(() => inputUnitsForBase(baseUnit), [baseUnit]);

  const normalized = useMemo(() => {
    const q = parseFloat(inputUnitQuantity.replace(',', '.'));
    const qty = Number.isFinite(q) && q > 0 ? q : 1;
    return convertToBaseUnits(inputUnit, qty);
  }, [inputUnit, inputUnitQuantity]);

  const qtyParsed = useMemo(() => {
    const q = parseFloat(inputUnitQuantity.replace(',', '.'));
    return Number.isFinite(q) && q > 0 ? q : 1;
  }, [inputUnitQuantity]);

  const inputUnitLabel =
    PRODUCT_INPUT_UNITS.find((u) => u.value === inputUnit)?.label ?? inputUnit;

  const conversionLabel = `${normalized.amountInBase.toLocaleString('es-CL', {
    maximumFractionDigits: 6,
  })} ${normalized.baseUnit}`;

  const baseNoun: Record<ProductBaseUnit, string> = {
    g: 'gramos',
    ml: 'mililitros',
    und: 'unidades',
  };

  return (
    <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[#001F3F]">Unidades de medida</h2>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          Primero defines la <strong>unidad base</strong> del producto. Luego indicas <strong>cómo vas a
          ingresar cantidades</strong> (por bolsa, kilo, litro…). La caja de abajo muestra cómo el sistema
          convierte eso automáticamente.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#001F3F] text-[11px] font-bold text-white"
            aria-hidden
          >
            1
          </span>
          <label htmlFor="product-base-unit" className="text-sm font-medium text-gray-800">
            Unidad base en el sistema
          </label>
        </div>
        <p className="text-xs text-gray-500 pl-8">{BASE_CONTEXT[baseUnit]}</p>
        <select
          id="product-base-unit"
          value={baseUnit}
          onChange={(e) => onBaseUnitChange(e.target.value as ProductBaseUnit)}
          className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
        >
          {PRODUCT_BASE_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#001F3F] text-[11px] font-bold text-white"
            aria-hidden
          >
            2
          </span>
          <span className="text-sm font-medium text-gray-800">Cómo ingresas la cantidad</span>
        </div>
        <p className="text-xs text-gray-500 pl-8 leading-relaxed">
          Elige la <strong>unidad de cada registro</strong> (por ejemplo kilogramos si compras por kilo) y
          escribe la <strong>cantidad en esa unidad</strong>. Eso es lo que verás al cargar movimientos o
          recetas; el sistema lo pasa solo a la unidad base del paso 1.
        </p>

        <div className="pl-0 sm:pl-8 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
          <div className="flex-1 min-w-[160px]">
            <label htmlFor="product-input-unit" className="block text-xs font-medium text-gray-600 mb-1">
              Unidad del registro
            </label>
            <select
              id="product-input-unit"
              value={inputUnit}
              onChange={(e) => onInputUnitChange(e.target.value as ProductInputUnit)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
            >
              {inputOptions.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-end pb-2 text-gray-400 text-sm font-medium" aria-hidden>
            ×
          </div>

          <div className="w-full sm:w-36 sm:flex-none">
            <label htmlFor="product-input-qty" className="block text-xs font-medium text-gray-600 mb-1">
              Cantidad (en esa unidad)
            </label>
            <input
              id="product-input-qty"
              type="number"
              min="0.0001"
              step="any"
              value={inputUnitQuantity}
              onChange={(e) => onInputUnitQuantityChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F] focus:border-[#001F3F]"
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80 mb-1">
          Equivalencia automática
        </p>
        <p className="text-sm text-gray-800 leading-relaxed">
          <span className="font-medium text-emerald-900">
            {qtyParsed.toLocaleString('es-CL', { maximumFractionDigits: 6 })} {inputUnitLabel}
          </span>
          {' → '}
          <span className="font-semibold text-[#001F3F]">{conversionLabel}</span>
          <span className="text-gray-600">
            {' '}
            (referencia en {baseNoun[baseUnit]} para inventario y costos)
          </span>
        </p>
      </div>
    </div>
  );
}
