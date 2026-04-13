'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { fetchWarehouseById, updateWarehouseRequest } from '@/lib/warehousesApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuardAny } from '@/hooks/useAuthGuard';
import { PERMS_WAREHOUSE_MUTATE } from '@/utils/permissions';
import { showSuccess } from '@/utils/toast';

export default function EditWarehousePage() {
  useAuthGuardAny(PERMS_WAREHOUSE_MUTATE);

  const router = useRouter();
  const { id } = router.query;
  const warehouseId = id ? parseInt(id as string, 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [isMain, setIsMain] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!Number.isFinite(warehouseId) || warehouseId < 1) {
      setLoading(false);
      setError('ID no válido');
      return;
    }

    const load = async () => {
      try {
        const w = await fetchWarehouseById(warehouseId);
        setName(w.name);
        setDescription(w.description ?? '');
        setActive(w.active);
        setIsMain(Boolean(w.isMain));
      } catch (e) {
        if (isUnauthorized(e)) {
          void router.push('/login');
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudo cargar la bodega'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router.isReady, warehouseId, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nombre requerido');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await updateWarehouseRequest(warehouseId, {
        name: name.trim(),
        description: description.trim() || null,
        active,
        isMain,
      });
      showSuccess('Bodega actualizada');
      void router.push(ROUTES.transfers.warehouses);
    } catch (err) {
      if (isUnauthorized(err)) {
        void router.push('/login');
        return;
      }
      setFormError(getApiErrorMessage(err, 'No se pudo guardar'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Editar bodega</h1>
      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-lg">
        {loading ? (
          <p className="text-gray-600">Cargando…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
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
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isMain}
                onChange={(e) => setIsMain(e.target.checked)}
              />
              <span>
                <span className="font-medium text-gray-800">Bodega principal</span>
                <span className="block text-gray-600 mt-0.5">
                  Entradas por compra van a la bodega principal. Solo puede haber una; al marcar esta,
                  se quita la marca en las demás.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Bodega activa
            </label>
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
        )}
      </div>
    </DashboardLayout>
  );
}
