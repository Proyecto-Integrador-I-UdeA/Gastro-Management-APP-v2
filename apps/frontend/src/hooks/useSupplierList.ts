'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Supplier } from '@/types/supplier';
import { fetchSuppliersList } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';

export function useSupplierList() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
      const data = await fetchSuppliersList();
      setSuppliers(data);
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudieron cargar los proveedores'));
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { suppliers, loading, error, refetch };
}
