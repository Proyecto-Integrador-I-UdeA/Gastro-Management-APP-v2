'use client';

import { useMemo } from 'react';
import Input from '@/components/Input';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  PRODUCT_BASE_UNITS,
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

  const conversionLabel = `${normalized.amountInBase.toLocaleString('es-CL', {
    maximumFractionDigits: 6,
  })} ${normalized.baseUnit}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Unidad de medida (base en sistema)</label>
        <select
          value={baseUnit}
          onChange={(e) => onBaseUnitChange(e.target.value as ProductBaseUnit)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
        >
          {PRODUCT_BASE_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Unidad ingresada</label>
        <select
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

      <Input
        label="Cantidad por unidad ingresada"
        type="number"
        min="0.0001"
        step="any"
        value={inputUnitQuantity}
        onChange={(e) => onInputUnitQuantityChange(e.target.value)}
      />

      <div className="md:col-span-2">
        <Input
          label="Conversión automática (no editable)"
          value={conversionLabel}
          readOnly
          disabled
          className="bg-gray-100 cursor-not-allowed"
        />
      </div>
    </>
  );
}
