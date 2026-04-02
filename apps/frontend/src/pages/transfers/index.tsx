'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import {
  deleteTransferRequest,
  fetchTransferMovements,
} from '@/lib/inventoryMovementsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getUserPermissions } from '@/utils/permissions';
import { showError } from '@/utils/toast';
import type { InventoryMovementRow } from '@/types/transfer';

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

function movementTypeLabel(type: string) {
  if (type === 'PURCHASE') return 'Compra';
  if (type === 'TRANSFER') return 'Traslado';
  return type;
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTransferMovements({ skip: 0, take: 100 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudieron cargar los traslados'));
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Traslados</h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Traslados y entradas por compra
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Historial ({total} en esta vista). Las bodegas se administran en la sección Bodegas.
            </p>
          </div>

          <Button type="button" onClick={goToNewTransfer}>
            + Nuevo movimiento
          </Button>
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
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Costo u.</th>
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
                      <td className="py-2 pr-3">{m.quantity}</td>
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
                          {m.type === 'TRANSFER' ? (
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
                            <span
                              className="text-gray-500 text-sm cursor-default"
                              title="Las entradas por compra no se editan. Si hubo un error, elimina el movimiento y registra de nuevo."
                            >
                              No editable
                            </span>
                          )}
                          {canDeleteTransfer ? (
                            <Button
                              variant="danger"
                              className="text-sm px-2 py-1"
                              disabled={busyId !== null}
                              onClick={() => handleDelete(m)}
                            >
                              {busyId === m.id ? '…' : 'Eliminar'}
                            </Button>
                          ) : (
                            <span
                              className="text-gray-400 text-sm cursor-default"
                              title="Se requiere el permiso transfers.delete"
                            >
                              Eliminar
                            </span>
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
