'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import {
  fetchAllWarehouses,
  updateWarehouseRequest,
} from '@/lib/warehousesApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getUserPermissions } from '@/utils/permissions';
import type { WarehouseSummary } from '@/types/transfer';

export default function TransferWarehousesPage() {
  useAuthGuard('transfers.read');

  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [rows, setRows] = useState<WarehouseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllWarehouses();
      setRows(data);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudieron cargar las bodegas'));
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

  const canCreate =
    can('warehouses.create') || can('transfers.create');
  const canUpdate = can('warehouses.update');

  const toggleActive = async (w: WarehouseSummary) => {
    if (!canUpdate) return;
    const next = !w.active;
    if (
      !confirm(
        next
          ? `¿Activar la bodega "${w.name}"?`
          : `¿Inactivar la bodega "${w.name}"?`
      )
    ) {
      return;
    }
    setBusyId(w.id);
    try {
      await updateWarehouseRequest(w.id, { active: next });
      await load();
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      alert(getApiErrorMessage(e, 'No se pudo actualizar el estado'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Bodegas</h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Ubicaciones para traslados e inventario
          </h3>
          {canCreate && (
            <Button onClick={() => void router.push(ROUTES.transfers.warehousesCreate)}>
              + Nueva bodega
            </Button>
          )}
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            {error}
            <Button variant="secondary" className="mt-2" onClick={() => load()}>
              Reintentar
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3">Principal</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No hay bodegas.{' '}
                      {canCreate && (
                        <Link
                          href={ROUTES.transfers.warehousesCreate}
                          className="text-blue-600 hover:underline"
                        >
                          Crear una
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map((w) => (
                    <tr key={w.id} className="border-b border-gray-200/50 hover:bg-white/30">
                      <td className="py-2 pr-3 font-semibold">{w.name}</td>
                      <td className="py-2 pr-3 text-gray-600 max-w-xs truncate">
                        {w.description || '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {w.isMain ? (
                          <span className="px-2 inline-flex text-xs font-semibold rounded-full bg-[#001F3F]/10 text-[#001F3F]">
                            Sí
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 inline-flex text-xs font-semibold rounded-full ${
                            w.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {w.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-2 space-x-2 whitespace-nowrap">
                        {canUpdate ? (
                          <Link
                            href={ROUTES.transfers.warehouseEdit(w.id)}
                            className="text-blue-600 hover:underline"
                          >
                            Modificar
                          </Link>
                        ) : (
                          <span className="text-gray-400">Modificar</span>
                        )}
                        {canUpdate ? (
                          <Button
                            variant={w.active ? 'danger' : 'secondary'}
                            className="text-sm px-2 py-1"
                            disabled={busyId !== null}
                            onClick={() => toggleActive(w)}
                          >
                            {busyId === w.id ? '…' : w.active ? 'Inactivar' : 'Activar'}
                          </Button>
                        ) : null}
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
