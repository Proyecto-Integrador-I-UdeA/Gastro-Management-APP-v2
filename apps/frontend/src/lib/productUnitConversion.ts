export type ProductBaseUnit = 'g' | 'ml' | 'und';

export type ProductInputUnit =
  | 'g'
  | 'kg'
  | 'lb'
  | 'oz'
  | 'ml'
  | 'lt'
  | 'gal'
  | 'und'
  | 'docena'
  | 'paca';

export const PRODUCT_INPUT_UNITS: Array<{ value: ProductInputUnit; label: string }> = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'oz', label: 'Onzas (oz)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'lt', label: 'Litros (lt)' },
  { value: 'gal', label: 'Galones (gal)' },
  { value: 'und', label: 'Unidad (und)' },
  { value: 'docena', label: 'Docena (12 und)' },
  { value: 'paca', label: 'Paca (24 und)' },
];

export function isProductInputUnit(value: unknown): value is ProductInputUnit {
  return PRODUCT_INPUT_UNITS.some((u) => u.value === value);
}

const UNIT_FACTOR: Record<ProductInputUnit, { baseUnit: ProductBaseUnit; factor: number }> = {
  g: { baseUnit: 'g', factor: 1 },
  kg: { baseUnit: 'g', factor: 1000 },
  lb: { baseUnit: 'g', factor: 453.59237 },
  oz: { baseUnit: 'g', factor: 28.349523125 },
  ml: { baseUnit: 'ml', factor: 1 },
  lt: { baseUnit: 'ml', factor: 1000 },
  gal: { baseUnit: 'ml', factor: 3785.411784 },
  und: { baseUnit: 'und', factor: 1 },
  docena: { baseUnit: 'und', factor: 12 },
  paca: { baseUnit: 'und', factor: 24 },
};

export function convertToBaseUnits(inputUnit: ProductInputUnit, quantity: number) {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const config = UNIT_FACTOR[inputUnit];
  return {
    baseUnit: config.baseUnit,
    factor: config.factor * safeQuantity,
  };
}
