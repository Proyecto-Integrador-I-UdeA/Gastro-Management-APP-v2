'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import type { NextRouter } from 'next/router';
import type { Product } from '@/types/product';
import { fetchProductsWithSuppliers } from '@/lib/productsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';

function parseSupplierIdFromQuery(query: NextRouter['query']): number | null {
  const raw = query.supplierId;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === undefined || s === '') return null;
  const n = parseInt(String(s), 10);
  return Number.isNaN(n) ? null : n;
}

function parseSupplierIdFromAsPath(asPath: string): number | null {
  const q = asPath.indexOf('?');
  if (q < 0) return null;
  const params = new URLSearchParams(asPath.slice(q + 1));
  const id = params.get('supplierId');
  if (!id) return null;
  const n = parseInt(id, 10);
  return Number.isNaN(n) ? null : n;
}

/** Etiqueta en UI: preferimos `supplierCode` (código interno); `supplier` queda por enlaces antiguos. */
function parseSupplierLabelFromQuery(query: NextRouter['query']): string | null {
  const codeRaw = query.supplierCode;
  const code = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw;
  if (typeof code === 'string' && code !== '') {
    try {
      return decodeURIComponent(code);
    } catch {
      return code;
    }
  }
  const raw = query.supplier;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || s === '') return null;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseSupplierLabelFromAsPath(asPath: string): string | null {
  const q = asPath.indexOf('?');
  if (q < 0) return null;
  const params = new URLSearchParams(asPath.slice(q + 1));
  const code = params.get('supplierCode');
  if (code) {
    try {
      return decodeURIComponent(code);
    } catch {
      return code;
    }
  }
  const name = params.get('supplier');
  if (!name) return null;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function parseFiltersFromLocationSearch(search: string): {
  supplierId: number | null;
  supplierLabel: string | null;
} {
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (!q) return { supplierId: null, supplierLabel: null };
  const params = new URLSearchParams(q);
  const rawId = params.get('supplierId');
  let supplierId: number | null = null;
  if (rawId) {
    const n = parseInt(rawId, 10);
    supplierId = Number.isNaN(n) ? null : n;
  }
  const rawCode = params.get('supplierCode');
  const rawName = params.get('supplier');
  let supplierLabel: string | null = null;
  if (rawCode) {
    try {
      supplierLabel = decodeURIComponent(rawCode);
    } catch {
      supplierLabel = rawCode;
    }
  } else if (rawName) {
    try {
      supplierLabel = decodeURIComponent(rawName);
    } catch {
      supplierLabel = rawName;
    }
  }
  return { supplierId, supplierLabel };
}

/**
 * Lista productos; si la URL lleva `?supplierId=`, filtra en API.
 * Espera a `router.isReady` para no disparar un GET sin filtro antes de que Next exponga el query.
 */
export function useProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);

  const urlFilter = useMemo(() => {
    if (!router.isReady) {
      return { ready: false as const };
    }
    let supplierId =
      parseSupplierIdFromQuery(router.query) ??
      parseSupplierIdFromAsPath(router.asPath);
    let supplierLabel =
      parseSupplierLabelFromQuery(router.query) ??
      parseSupplierLabelFromAsPath(router.asPath);
    if (
      typeof window !== 'undefined' &&
      supplierId === null &&
      window.location.search.length > 1
    ) {
      const fromWin = parseFiltersFromLocationSearch(window.location.search);
      supplierId = fromWin.supplierId;
      if (supplierLabel === null) {
        supplierLabel = fromWin.supplierLabel;
      }
    }
    return {
      ready: true as const,
      supplierId,
      supplierLabel,
    };
  }, [
    router.isReady,
    router.asPath,
    router.query.supplierId,
    router.query.supplierCode,
    router.query.supplier,
  ]);

  const filterSupplierId = urlFilter.ready ? urlFilter.supplierId : null;
  const supplierLabel = urlFilter.ready ? urlFilter.supplierLabel : null;

  const runFetch = useCallback(
    async (supplierId: number | null) => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        setLoading(false);
        return;
      }

      const generation = ++fetchGenerationRef.current;
      setLoading(true);
      setError(null);
      try {
        const sid =
          supplierId != null && !Number.isNaN(supplierId) ? supplierId : null;
        const data = await fetchProductsWithSuppliers(sid);
        if (generation !== fetchGenerationRef.current) {
          return;
        }
        setProducts(data);
      } catch (e) {
        if (generation !== fetchGenerationRef.current) {
          return;
        }
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudieron cargar los productos'));
        setProducts([]);
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    if (!urlFilter.ready) {
      return;
    }
    void runFetch(urlFilter.supplierId);
  }, [urlFilter, runFetch]);

  const refetch = useCallback(async () => {
    if (!urlFilter.ready) {
      return;
    }
    await runFetch(urlFilter.supplierId);
  }, [urlFilter, runFetch]);

  return {
    products,
    loading: loading || !urlFilter.ready,
    error,
    refetch,
    filterSupplierId,
    supplierLabel,
  };
}
