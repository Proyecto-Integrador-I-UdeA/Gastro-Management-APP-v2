'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types/product';
import { fetchProductsWithSuppliers } from '@/lib/productsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';

export function useProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductsWithSuppliers();
      setProducts(data);
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudieron cargar los productos'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { products, loading, error, refetch };
}
