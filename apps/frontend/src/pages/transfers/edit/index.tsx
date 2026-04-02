'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import {
  fetchInventoryMovementById,
  patchTransferRequest,
} from '@/lib/inventoryMovementsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { showSuccess } from '@/utils/toast';

export default function EditTransferPage() {
  useAuthGuard('transfers.update');

  const router = useRouter();
  const { id } = router.query;
  const movementId = id ? parseInt(id as string, 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!Number.isFinite(movementId) || movementId < 1) {
      setLoading(false);
      setError('ID de traslado no válido');
      return;
    }

    const load = async () => {
      try {
        const m = await fetchInventoryMovementById(movementId);
        if (m.type !== 'TRANSFER') {
          setError('Solo se pueden editar traslados.');
          return;
        }
        setQuantity(String(m.quantity));
        setNotes(m.notes ?? '');
        setSummary(
          `${m.product?.name ?? 'Producto'} · ${m.sourceWarehouse?.name ?? '?'} → ${m.destinationWarehouse?.name ?? '?'}`
        );
      } catch (e) {
        if (isUnauthorized(e)) {
          void router.push('/login');
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudo cargar el traslado'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router.isReady, movementId, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      alert('Cantidad inválida');
      return;
    }

    setSubmitting(true);
    try {
      await patchTransferRequest(movementId, {
        quantity: qty,
        notes: notes.trim() || null,
      });
      showSuccess('Traslado actualizado');
      void router.push(ROUTES.transfers.list);
    } catch (err) {
      if (isUnauthorized(err)) {
        void router.push('/login');
        return;
      }
      alert(getApiErrorMessage(err, 'No se pudo guardar'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Editar traslado</h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)] max-w-xl">
        {loading ? (
          <p className="text-gray-600">Cargando…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">{summary}</p>
            <p className="text-xs text-gray-500">
              Al cambiar la cantidad se revierte el movimiento anterior y se aplica el nuevo (mismas
              bodegas y producto).
            </p>
            <Input
              label="Cantidad *"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Notas</label>
              <textarea
                className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void router.push(ROUTES.transfers.list)}
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
