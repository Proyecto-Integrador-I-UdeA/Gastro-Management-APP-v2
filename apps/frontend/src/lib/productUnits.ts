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

export const PRODUCT_BASE_UNITS: Array<{ value: ProductBaseUnit; label: string }> = [
  { value: 'g', label: 'Gramo (g) — peso' },
  { value: 'ml', label: 'Mililitro (ml) — volumen' },
  { value: 'und', label: 'Unidad (und)' },
];

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

export function isProductBaseUnit(value: unknown): value is ProductBaseUnit {
  return value === 'g' || value === 'ml' || value === 'und';
}

export function isProductInputUnit(value: unknown): value is ProductInputUnit {
  return PRODUCT_INPUT_UNITS.some((u) => u.value === value);
}

const UNIT_FACTOR: Record<ProductInputUnit, { baseUnit: ProductBaseUnit; factorPerUnit: number }> =
  {
    g: { baseUnit: 'g', factorPerUnit: 1 },
    kg: { baseUnit: 'g', factorPerUnit: 1000 },
    lb: { baseUnit: 'g', factorPerUnit: 453.59237 },
    oz: { baseUnit: 'g', factorPerUnit: 28.349523125 },
    ml: { baseUnit: 'ml', factorPerUnit: 1 },
    lt: { baseUnit: 'ml', factorPerUnit: 1000 },
    gal: { baseUnit: 'ml', factorPerUnit: 3785.411784 },
    und: { baseUnit: 'und', factorPerUnit: 1 },
    docena: { baseUnit: 'und', factorPerUnit: 12 },
    paca: { baseUnit: 'und', factorPerUnit: 24 },
  };

/** Cantidad equivalente en la unidad base (g, ml o und). */
export function convertToBaseUnits(inputUnit: ProductInputUnit, quantity: number) {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const config = UNIT_FACTOR[inputUnit];
  return {
    baseUnit: config.baseUnit,
    amountInBase: config.factorPerUnit * safeQuantity,
  };
}

export function inputUnitsForBase(base: ProductBaseUnit): Array<{ value: ProductInputUnit; label: string }> {
  return PRODUCT_INPUT_UNITS.filter((u) => UNIT_FACTOR[u.value].baseUnit === base);
}

export function coerceInputUnitForBase(
  base: ProductBaseUnit,
  current: string
): ProductInputUnit {
  const u = isProductInputUnit(current) ? current : 'g';
  const allowed = inputUnitsForBase(base).map((x) => x.value);
  if (allowed.includes(u)) return u;
  return allowed[0] ?? 'g';
}

/** Normaliza texto legado del API a una unidad base del dropdown. */
/** Etiqueta amigable para mostrar la unidad de ingreso del catálogo de productos. */
export function formatProductInputUnitLabel(unit: string): string {
  const u = PRODUCT_INPUT_UNITS.find((x) => x.value === unit);
  return u?.label ?? unit;
}

export function parseBaseUnitFromStored(raw: string): ProductBaseUnit {
  const t = raw.trim().toLowerCase();
  if (t === 'g' || t === 'gramo' || t === 'gramos') return 'g';
  if (t === 'ml' || t === 'mililitro' || t === 'mililitros') return 'ml';
  if (t === 'und' || t === 'unidad' || t === 'u' || t === 'unidades') return 'und';
  if (isProductBaseUnit(t)) return t;
  return 'g';
}
