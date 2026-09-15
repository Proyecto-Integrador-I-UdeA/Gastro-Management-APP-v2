import { useEffect, useMemo, useState } from 'react';
import type { CountReferences, PhysicalCountReason } from '@/types/inventoryPhysicalCount';
import type { CountLineInput } from '@/lib/inventoryPhysicalCountsApi';

export const reasons: Array<{ value: PhysicalCountReason; label: string }> = [
  { value: 'PHYSICAL_COUNT', label: 'Conteo físico' }, { value: 'UNRECORDED_ENTRY', label: 'Entrada no registrada' },
  { value: 'WASTE_OR_YIELD_VARIANCE', label: 'Variación de merma o rendimiento' }, { value: 'DAMAGE_OR_LOSS', label: 'Daño o pérdida' },
  { value: 'DATA_CORRECTION', label: 'Corrección de datos' }, { value: 'OTHER', label: 'Otro' },
];

export function invalidCountLines(lines: CountLineInput[]) {
  return lines.some(line => line.countedQuantity !== null && (!Number.isFinite(line.countedQuantity) || line.countedQuantity < 0));
}

function quantity(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 }).format(value);
}

function normalizeProductSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[—–·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function PhysicalCountEditor(props: {
  references: CountReferences; warehouseId: number; lines: CountLineInput[]; reason: PhysicalCountReason; notes: string; readOnly?: boolean;
  onWarehouse?: (id: number) => void; onLines: (lines: CountLineInput[]) => void; onReason: (reason: PhysicalCountReason) => void; onNotes: (notes: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const products = new Map(props.references.products.map(product => [product.id, product]));
  const query = normalizeProductSearch(search);
  const available = props.references.products.filter(product => {
    if (props.lines.some(line => line.productId === product.id)) return false;
    return !query || normalizeProductSearch(`${product.name} ${product.internalCode}`).includes(query);
  });
  useEffect(() => {
    setActiveResult(current => Math.min(current, Math.max(available.length - 1, 0)));
  }, [available.length]);
  const addProduct = (productId: number) => {
    if (props.lines.some(line => line.productId === productId)) return;
    props.onLines([...props.lines, { productId, countedQuantity: null }]);
    setSearch('');
    setSearchOpen(false);
    setActiveResult(0);
  };
  const summary = useMemo(() => props.lines.reduce((acc, line) => {
    if (line.countedQuantity === null) return acc;
    const variance = line.countedQuantity - (products.get(line.productId)?.systemQuantity ?? 0);
    acc.matches += variance === 0 ? 1 : 0; acc.shortages += variance < 0 ? 1 : 0; acc.surpluses += variance > 0 ? 1 : 0;
    acc.impact += variance * Number(products.get(line.productId)?.unitCostEstimate ?? 0); return acc;
  }, { matches: 0, shortages: 0, surpluses: 0, impact: 0 }), [props.lines, props.references.products]);
  return <>
    <div className="grid gap-4 md:grid-cols-2">
      <label>Bodega<select aria-label="Bodega" disabled={props.readOnly || !props.onWarehouse} value={props.warehouseId || ''} onChange={event => props.onWarehouse?.(Number(event.target.value))} className="mt-1 w-full rounded border p-2"><option value="">Seleccionar</option>{props.references.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.isMain ? ' · Principal' : ''}</option>)}</select></label>
      <label>Motivo<select aria-label="Motivo" disabled={props.readOnly} value={props.reason} onChange={event => props.onReason(event.target.value as PhysicalCountReason)} className="mt-1 w-full rounded border p-2">{reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
    </div>
    <label className="mt-4 block">Observaciones<textarea aria-label="Observaciones" disabled={props.readOnly} value={props.notes} onChange={event => props.onNotes(event.target.value)} className="mt-1 w-full rounded border p-2" rows={3} /></label>
    {!props.readOnly && <div className="relative mt-4 max-w-xl">
      <label htmlFor="physical-count-product-search">Agregar producto</label>
      <input
        id="physical-count-product-search"
        role="combobox"
        aria-label="Buscar y agregar producto"
        aria-autocomplete="list"
        aria-expanded={searchOpen}
        aria-controls="physical-count-product-results"
        aria-activedescendant={searchOpen && available[activeResult] ? `physical-count-product-${available[activeResult].id}` : undefined}
        value={search}
        onFocus={() => setSearchOpen(true)}
        onBlur={() => setSearchOpen(false)}
        onChange={event => { setSearch(event.target.value); setSearchOpen(true); setActiveResult(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault(); setSearchOpen(true); setActiveResult(current => available.length ? Math.min(current + 1, available.length - 1) : 0);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault(); setActiveResult(current => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && searchOpen && available[activeResult]) {
            event.preventDefault(); addProduct(available[activeResult].id);
          } else if (event.key === 'Escape') {
            setSearchOpen(false);
          }
        }}
        className="mt-1 w-full rounded border p-2"
        placeholder="Buscar y agregar producto..."
      />
      {searchOpen && <ul id="physical-count-product-results" role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border bg-white py-1 shadow-lg">
        {available.map((product, index) => <li
          id={`physical-count-product-${product.id}`}
          key={product.id}
          role="option"
          aria-selected={index === activeResult}
          className={`cursor-pointer px-3 py-2 ${index === activeResult ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'}`}
          onMouseDown={event => { event.preventDefault(); addProduct(product.id); }}
          onMouseEnter={() => setActiveResult(index)}
        >{product.name} — {product.internalCode}</li>)}
        {available.length === 0 && <li className="px-3 py-2 text-sm text-gray-600">No se encontraron productos</li>}
      </ul>}
    </div>}
    <div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Producto</th><th>Sistema (unidad base)</th><th>Físico (unidad base)</th><th>Diferencia</th><th>Costo unit.</th><th>Impacto estimado</th><th /></tr></thead><tbody>{props.lines.map((line, index) => { const p = products.get(line.productId); const invalid = line.countedQuantity !== null && (!Number.isFinite(line.countedQuantity) || line.countedQuantity < 0); const variance = line.countedQuantity === null || invalid ? null : line.countedQuantity - (p?.systemQuantity ?? 0); const estimated = variance === null || p?.unitCostEstimate === null ? null : variance * Number(p?.unitCostEstimate ?? 0); return <tr key={line.productId} className="border-b"><td className="p-2">{p?.name ?? `Producto #${line.productId}`}</td><td>{quantity(p?.systemQuantity ?? 0)} {p?.unitOfMeasure}</td><td><input aria-label={`Cantidad física ${p?.name ?? line.productId}`} aria-invalid={invalid} disabled={props.readOnly} type="number" min="0" step="any" value={line.countedQuantity ?? ''} onChange={event => { const raw = event.target.value; const next = [...props.lines]; next[index] = { ...line, countedQuantity: raw === '' ? null : Number(raw) }; props.onLines(next); }} className="w-32 rounded border p-2" /><span className="ml-2 text-xs text-gray-500">{p?.unitOfMeasure ?? ''}</span>{invalid && <p role="alert" className="text-xs text-red-700">La cantidad física debe ser un número mayor o igual a 0.</p>}</td><td className={variance !== null && variance < 0 ? 'text-red-700' : variance !== null && variance > 0 ? 'text-green-700' : ''}>{variance === null ? '—' : `${variance > 0 ? '+' : ''}${quantity(variance)} ${p?.unitOfMeasure}`}</td><td>{p?.unitCostEstimate === null ? '—' : Number(p?.unitCostEstimate ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td><td>{estimated === null ? '—' : estimated.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td><td>{!props.readOnly && <button type="button" className="text-red-700" onClick={() => props.onLines(props.lines.filter((_, i) => i !== index))}>Quitar</button>}</td></tr>; })}</tbody></table></div>
    <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-5"><p>Productos: <strong>{props.lines.length}</strong></p><p>Coincidencias: <strong>{summary.matches}</strong></p><p>Faltantes: <strong>{summary.shortages}</strong></p><p>Sobrantes: <strong>{summary.surpluses}</strong></p><p>Impacto estimado: <strong>{summary.impact.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</strong></p></div>
    <p className="mt-3 text-sm text-gray-600">Las diferencias pueden deberse a compras no registradas, desperdicios, errores de receta, unidades o variaciones reales de consumo.</p>
  </>;
}
