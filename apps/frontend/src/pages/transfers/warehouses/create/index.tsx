'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { createWarehouseRequest } from '@/lib/warehousesApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getUserPermissions } from '@/utils/permissions';
import { showError, showSuccess } from '@/utils/toast';

export default function CreateWarehousePage() {
  useAuthGuard('transfers.read');

  const router = useRouter();
  useEffect(() => {
    const p = getUserPermissions().map((x) => x.toLowerCase());
    if (!p.includes('warehouses.create') && !p.includes('transfers.create')) {
      showError('No tienes permiso para crear bodegas');
      void router.replace(ROUTES.transfers.warehouses);
    }
  }, [router]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nombre requerido');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await createWarehouseRequest({
        name: name.trim(),
        description: description.trim() || null,
        active: true,
      });
      showSuccess('Bodega creada');
      void router.push(ROUTES.transfers.warehouses);
    } catch (err) {
      if (isUnauthorized(err)) {
        void router.push('/login');
        return;
      }
      setFormError(getApiErrorMessage(err, 'No se pudo crear la bodega'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Nueva bodega</h1>
      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void router.push(ROUTES.transfers.warehouses)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
