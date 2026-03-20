'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'gastronomic_products';
const LEGACY_STORAGE_KEY = 'gastronomic_productos';

export interface Product {
  code: string;
  name: string;
  category: string;
  stock: string;
  lowStock: boolean;
  expiryDate?: string;
  minStock?: string;
  maxStock?: string;
  supplier?: string;
  cost?: string;
}

interface LegacyProduct {
  codigo?: string;
  nombre?: string;
  categoria?: string;
  stock?: string;
  bajoStock?: boolean;
  activo?: boolean;
  fechaVencimiento?: string;
  stockMinimo?: string;
  stockMaximo?: string;
  proveedor?: string;
  costo?: string;
}

function fromLegacy(row: LegacyProduct): Product {
  return {
    code: row.codigo ?? '',
    name: row.nombre ?? '',
    category: row.categoria ?? '',
    stock: row.stock ?? '',
    lowStock: row.bajoStock ?? false,
    expiryDate: row.fechaVencimiento,
    minStock: row.stockMinimo,
    maxStock: row.stockMaximo,
    supplier: row.proveedor,
    cost: row.costo,
  };
}

// TODO: Remove this once we have a real default products
const defaultProducts: Product[] = [
  { code: 'PR-POL-01', name: 'Pechuga de Pollo', category: 'Proteína', stock: '58.0 kg', lowStock: false },
  { code: 'VE-TOM-02', name: 'Tomate Chonto', category: 'Vegetal', stock: '45.0 kg', lowStock: false },
  { code: 'LA-QUE-05', name: 'Queso Mozzarella', category: 'Lácteos', stock: '8.0 kg', lowStock: true },
  { code: 'AB-ARR-01', name: 'Arroz Grano Largo', category: 'Abarrotes', stock: '100.0 kg', lowStock: false },
  { code: 'LI-ACE-10', name: 'Aceite de Girasol', category: 'Grasas', stock: '20.0 L', lowStock: false },
  { code: 'PR-RES-02', name: 'Pechuga de Pollo Filete', category: 'Proteína', stock: '8.0 kg', lowStock: true },
  { code: 'VE-CEB-02', name: 'Cebolla Blanca Cabezona', category: 'Vegetal', stock: '20.0 kg', lowStock: false },
];

export function readProductsFromStorage(): Product[] {
  return loadInitial();
}

function loadInitial(): Product[] {
  if (typeof window === 'undefined') return defaultProducts;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0] as Record<string, unknown>;
        if (first && typeof first.code === 'string') {
          return parsed as Product[];
        }
        if (first && typeof first.codigo === 'string') {
          const migrated = (parsed as LegacyProduct[]).map(fromLegacy);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated;
        }
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as LegacyProduct[];
      const migrated = Array.isArray(parsed) ? parsed.map(fromLegacy) : defaultProducts;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    /* fall through */
  }

  return defaultProducts;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initial = loadInitial();
    setProducts(initial);
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    }
    setIsLoaded(true);
  }, []);

  const persist = useCallback((next: Product[]) => {
    setProducts(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const saveProduct = useCallback(
    (item: Product) => {
      const current = readProductsFromStorage();
      persist([...current, item]);
    },
    [persist]
  );

  const updateProduct = useCallback(
    (item: Product) => {
      const current = readProductsFromStorage();
      const index = current.findIndex((p) => p.code === item.code);
      if (index === -1) return;
      const next = [...current];
      next[index] = item;
      persist(next);
    },
    [persist]
  );

  return { products, saveProduct, updateProduct, isLoaded };
}
