'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import {
  deleteTransferRequest,
  fetchInventoryMovements,
} from '@/lib/inventoryMovementsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getUserPermissions } from '@/utils/permissions';
import { showError } from '@/utils/toast';
import type { InventoryMovementRow, InventoryMovementType } from '@/types/transfer';

type MovementFilter = 'ALL' | InventoryMovementType;

const movementFilters: Array<{ value: MovementFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PURCHASE', label: 'Compras' },
  { value: 'TRANSFER', label: 'Traslados' },
  { value: 'CONSUMPTION', label: 'Consumos' },
  { value: 'ADJUSTMENT', label: 'Ajustes' },
  { value: 'WASTE', label: 'Mermas' },
];

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatBaseQuantity(quantity: number, unit: string | undefined) {
  const value = Number(quantity);
  return `${Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 6 }) : '—'} ${unit ?? ''}`.trim();
}

function movementTypeLabel(type: InventoryMovementType) {
  if (type === 'PURCHASE') return 'Compra';
  if (type === 'TRANSFER') return 'Traslado';
  if (type === 'CONSUMPTION') return 'Consumo';
  if (type === 'ADJUSTMENT') return 'Ajuste';
  return 'Merma/Desperdicio';
}

export default function TransfersPage() {
  useAuthGuard('transfers.read');

  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [items, setItems] = useState<InventoryMovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<MovementFilter>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInventoryMovements({
        skip: 0,
        take: 100,
        types: filter === 'ALL' ? undefined : [filter],
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudieron cargar los movimientos'));
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPermissions(getUserPermissions());
  }, []);

  const can = (perm: string) =>
    permissions.some((p) => p.trim().toLowerCase() === perm.toLowerCase());

  const canCreateTransfer = can('transfers.create');
  const canUpdateTransfer = can('transfers.update');
  const canDeleteTransfer = can('transfers.delete');

  const goToNewTransfer = () => {
    if (!canCreateTransfer) {
      showError('No tienes permiso para crear traslados');
      return;
    }
    void router.push(ROUTES.transfers.create);
  };

  const handleDelete = async (m: InventoryMovementRow) => {
    const msg =
      m.type === 'PURCHASE'
        ? `¿Eliminar esta entrada por compra? Se descontará ${m.quantity} del stock en bodega destino (el costo del producto en Kardex no se revierte automáticamente).`
        : `¿Eliminar este traslado? Se revertirá el stock (origen +${m.quantity}, destino −${m.quantity}).`;
    if (!confirm(msg)) {
      return;
    }
    setBusyId(m.id);
    try {
      await deleteTransferRequest(m.id);
      await load();
    } catch (err) {
      if (isUnauthorized(err)) {
        void router.push('/login');
        return;
      }
      alert(getApiErrorMessage(err, 'No se pudo eliminar el traslado'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Movimientos de inventario</h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Historial de movimientos
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {total} movimiento(s) en esta vista. Las bodegas se administran en la sección Bodegas.
            </p>
          </div>

          <Button type="button" onClick={goToNewTransfer}>
            + Nuevo movimiento
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtros de movimientos">
          {movementFilters.map(option => <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === option.value ? 'border-[#001F3F] bg-[#001F3F] text-white' : 'border-gray-300 bg-white/70 text-gray-700'}`}
            onClick={() => setFilter(option.value)}
          >{option.label}</button>)}
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            <p>{error}</p>
            <Button variant="secondary" className="mt-2" onClick={() => load()}>
              Reintentar
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">Cargando movimientos…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Origen</th>
                  <th className="py-2 pr-3">Destino</th>
                  <th className="py-2 pr-3">Cantidad (unidad base)</th>
                  <th className="py-2 pr-3">Costo u. ingreso</th>
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Notas</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      No hay movimientos en esta vista.{' '}
                      {canCreateTransfer && (
                        <Link
                          href={ROUTES.transfers.create}
                          className="text-blue-600 hover:underline"
                        >
                          Crear el primero
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  items.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-gray-200/50 hover:bg-white/30"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatWhen(m.createdAt)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {movementTypeLabel(m.type)}
                      </td>
                      <td className="py-2 pr-3">
                        <strong>{m.product?.name ?? `#${m.productId}`}</strong>
                        <div className="text-xs text-gray-500">
                          {m.product?.internalCode ?? '—'} ·{' '}
                          {m.product?.unitOfMeasure ?? ''}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {m.sourceWarehouse?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {m.destinationWarehouse?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-3">{formatBaseQuantity(m.quantity, m.product?.unitOfMeasure)}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {m.unitCost != null && m.unitCost !== ''
                          ? String(m.unitCost)
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">
                        {m.user?.fullName || m.user?.email || `#${m.userId}`}
                      </td>
                      <td className="py-2 pr-3 max-w-[160px] truncate text-gray-600">
                        {m.notes || '—'}
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          {m.type === 'TRANSFER' || m.type === 'PURCHASE' ? (
                            canUpdateTransfer ? (
                              <Link
                                href={ROUTES.transfers.edit(m.id)}
                                className="text-blue-600 hover:underline"
                              >
                                Modificar
                              </Link>
                            ) : (
                              <span
                                className="text-gray-400 text-sm cursor-default"
                                title="Tu rol necesita el permiso transfers.update (cierra sesión y vuelve a entrar si acabas de actualizar el seed)."
                              >
                                Modificar
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500 text-sm">—</span>
                          )}
                          {(m.type === 'TRANSFER' || m.type === 'PURCHASE') && canDeleteTransfer ? (
                            <Button
                              variant="danger"
                              className="text-sm px-2 py-1"
                              disabled={busyId !== null}
                              onClick={() => handleDelete(m)}
                            >
                              {busyId === m.id ? '…' : 'Eliminar'}
                            </Button>
                          ) : m.type === 'TRANSFER' || m.type === 'PURCHASE' ? (
                            <span
                              className="text-gray-400 text-sm cursor-default"
                              title="Se requiere el permiso transfers.delete"
                            >
                              Eliminar
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
