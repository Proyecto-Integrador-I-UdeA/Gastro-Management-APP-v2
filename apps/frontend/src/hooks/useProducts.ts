'use client';

/**
 * MOCK / localStorage — remove or replace when products load from the real API.
 *
 * DELETE or bypass when wiring GET/POST/PUT /products:
 * - STORAGE_KEY, LEGACY_STORAGE_KEY, persist(), readProductsFromStorage(), loadInitial()
 * - migrateFromV1, migrateFromSpanishLegacy, LegacyV1Row, LegacyProductSpanish, isAlignedRow (legacy only)
 * - saveProduct / updateProduct local persistence — swap for api calls + cache invalidation
 * - nextId() — backend assigns ids
 *
 * KEEP (or move next to API mappers):
 * - coerceProduct() pattern if you still need to normalize Decimal/string unitCost from JSON
 * - Product type lives in @/types/product
 */

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/types/product';
import { parseUnitCost } from '@/types/product';
import { DEFAULT_PRODUCTS, MOCK_SUPPLIERS } from '@/data/productSeed';

export type { Product } from '@/types/product';

/** TODO(API): remove localStorage key when products come only from backend. */
const STORAGE_KEY = 'gastronomic_products';
/** TODO(API): remove — only for ancient Spanish-key localStorage migration. */
const LEGACY_STORAGE_KEY = 'gastronomic_productos';

/** TODO(API): remove with migrateFromV1 — old English-key mock row shape. */
interface LegacyV1Row {
  code?: string;
  name?: string;
  category?: string;
  stock?: string;
  lowStock?: boolean;
  expiryDate?: string;
  minStock?: string;
  maxStock?: string;
  supplier?: string;
  cost?: string;
}

/** TODO(API): remove — detects already-migrated rows in localStorage. */
function isAlignedRow(row: Record<string, unknown>): boolean {
  return typeof row.internalCode === 'string' && typeof row.id === 'number' && typeof row.name === 'string';
}

/** Normalize row from API or cache (e.g. unitCost string). TODO: move near API layer when mock is gone. */
function coerceProduct(row: unknown): Product | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!isAlignedRow(r)) return null;
  const p = r as unknown as Product;
  const supplierId = typeof p.supplierId === 'number' ? p.supplierId : Number(p.supplierId);
  return {
    ...p,
    supplierId: Number.isFinite(supplierId) ? supplierId : MOCK_SUPPLIERS[0].id,
    unitCost: parseUnitCost(p.unitCost),
    supplier:
      p.supplier ?? MOCK_SUPPLIERS.find((s) => s.id === supplierId) ?? MOCK_SUPPLIERS[0],
  };
}

/** TODO(API): remove — migrates old mock rows (code + "58 kg" stock string) to Product. */
function migrateFromV1(rows: LegacyV1Row[]): Product[] {
  return rows.map((raw, i) => {
    const stockStr = String(raw.stock ?? '0 kg');
    const parts = stockStr.split(/\s+/);
    const currentStock = parseFloat(parts[0]) || 0;
    const unitOfMeasure = parts[1] || 'kg';
    const supplierName = String(raw.supplier ?? '');
    const supplier =
      MOCK_SUPPLIERS.find((s) => s.name === supplierName) ?? MOCK_SUPPLIERS[0];
    return {
      id: i + 1,
      internalCode: String(raw.code ?? `MIG-${i + 1}`),
      name: String(raw.name ?? ''),
      category: String(raw.category ?? ''),
      isIngredient: true,
      isSupply: false,
      isFinishedProduct: false,
      presentation: 'Granel',
      unitOfMeasure,
      expirationDate: raw.expiryDate
        ? new Date(raw.expiryDate).toISOString()
        : null,
      minStock: parseFloat(String(raw.minStock ?? 0)),
      maxStock: parseFloat(String(raw.maxStock ?? 0)),
      currentStock,
      unitCost: parseFloat(String(raw.cost ?? 0)),
      supplierId: supplier.id,
      supplier,
    };
  });
}

/** TODO(API): remove — migrates oldest Spanish-key localStorage to Product. */
function migrateFromSpanishLegacy(rows: LegacyProductSpanish[]): Product[] {
  return migrateFromV1(
    rows.map((row) => ({
      code: row.codigo,
      name: row.nombre,
      category: row.categoria,
      stock: row.stock,
      expiryDate: row.fechaVencimiento,
      minStock: row.stockMinimo,
      maxStock: row.stockMaximo,
      supplier: row.proveedor,
      cost: row.costo,
    }))
  );
}

/** TODO(API): remove with migrateFromSpanishLegacy. */
interface LegacyProductSpanish {
  codigo?: string;
  nombre?: string;
  categoria?: string;
  stock?: string;
  fechaVencimiento?: string;
  stockMinimo?: string;
  stockMaximo?: string;
  proveedor?: string;
  costo?: string;
}

/** TODO(API): remove — used by save/update to merge; replace with server state or React Query cache. */
export function readProductsFromStorage(): Product[] {
  return loadInitial();
}

/** TODO(API): replace with fetch + optional coerceProduct map; drop migration branches. */
function loadInitial(): Product[] {
  if (typeof window === 'undefined') return DEFAULT_PRODUCTS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0] as Record<string, unknown>;
        if (isAlignedRow(first)) {
          const normalized = parsed
            .map((row) => coerceProduct(row))
            .filter((p): p is Product => p != null);
          return normalized.length ? normalized : DEFAULT_PRODUCTS;
        }
        if (typeof first.code === 'string') {
          const migrated = migrateFromV1(parsed as LegacyV1Row[]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
        if (typeof first.codigo === 'string') {
          const migrated = migrateFromSpanishLegacy(parsed as LegacyProductSpanish[]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated;
        }
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as LegacyProductSpanish[];
      const migrated = Array.isArray(parsed)
        ? migrateFromSpanishLegacy(parsed)
        : DEFAULT_PRODUCTS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    /* fall through */
  }

  return DEFAULT_PRODUCTS;
}

/** TODO(API): remove — backend autoincrement. */
function nextId(products: Product[]): number {
  return products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initial = loadInitial();
    setProducts(initial);
    // TODO(API): remove seed write — list should come from GET /products only.
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    }
    setIsLoaded(true);
  }, []);

  /** TODO(API): remove localStorage write; keep setState or SWR/React Query. */
  const persist = useCallback((next: Product[]) => {
    setProducts(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  /** TODO(API): replace with POST /products + refresh list. */
  const saveProduct = useCallback(
    (item: Omit<Product, 'id'> & { id?: number }) => {
      const current = readProductsFromStorage();
      const id = item.id ?? nextId(current);
      const supplier =
        MOCK_SUPPLIERS.find((s) => s.id === item.supplierId) ?? MOCK_SUPPLIERS[0];
      const row: Product = {
        ...item,
        id,
        supplierId: supplier.id,
        supplier,
        unitCost: parseUnitCost(item.unitCost),
      };
      persist([...current, row]);
    },
    [persist]
  );

  /** TODO(API): replace with PUT /products/:id + refresh. */
  const updateProduct = useCallback(
    (item: Product) => {
      const current = readProductsFromStorage();
      const index = current.findIndex((p) => p.internalCode === item.internalCode);
      if (index === -1) return;
      const supplier =
        MOCK_SUPPLIERS.find((s) => s.id === item.supplierId) ?? MOCK_SUPPLIERS[0];
      const row: Product = {
        ...item,
        supplierId: supplier.id,
        supplier,
        unitCost: parseUnitCost(item.unitCost),
      };
      const next = [...current];
      next[index] = row;
      persist(next);
    },
    [persist]
  );

  return { products, saveProduct, updateProduct, isLoaded };
}
