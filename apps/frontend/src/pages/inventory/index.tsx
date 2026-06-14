'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import { fetchInventories } from '@/lib/inventoriesApi';
import { fetchWarehouses } from '@/lib/warehousesApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type { InventoryListRow } from '@/types/inventory';
import type { WarehouseSummary } from '@/types/transfer';
import { formatInventoryEntryUnitDescriptor } from '@/lib/productUnits';

function rowLowStock(row: InventoryListRow): boolean {
  return row.quantity < row.product.minStock;
}

export default function InventoryPage() {
  useAuthGuard('inventory.read');

  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [rows, setRows] = useState<InventoryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const whId =
        warehouseId === '' ? undefined : parseInt(warehouseId, 10);
      const data = await fetchInventories(
        whId != null && !Number.isNaN(whId) ? { warehouseId: whId } : undefined
      );
      setRows(data);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudo cargar el inventario'));
    } finally {
      setLoading(false);
    }
  }, [router, warehouseId]);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const wh = await fetchWarehouses(true);
        setWarehouses(wh);
      } catch (e) {
        if (isUnauthorized(e)) {
          void router.push('/login');
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudieron cargar las bodegas'));
      }
    };
    void loadRefs();
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const code = r.product.internalCode?.toLowerCase() ?? '';
      const name = r.product.name?.toLowerCase() ?? '';
      return code.includes(q) || name.includes(q);
    });
  }, [rows, search]);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-2">Inventario</h1>
      <p className="text-sm text-gray-600 mb-6">
        Existencias por bodega. Los movimientos se registran en{' '}
        <Link href={ROUTES.transfers.list} className="text-blue-700 underline font-medium">
          Traslados
        </Link>
        .
      </p>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700">Bodega</label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Todas las bodegas</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 max-w-md">
              <Input
                label="Buscar producto"
                placeholder="Código o nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Actualizar
          </Button>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            <p>{error}</p>
            <Button variant="secondary" className="mt-2" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-600">Cargando existencias…</div>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-sm text-gray-600 mb-3">
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              {search.trim() ? ' (filtrado)' : ''}
            </p>
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Bodega</th>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Proveedor</th>
                  <th className="py-2 pr-3 text-right">Cantidad</th>
                  <th
                    className="py-2 pr-3"
                    title="Cuánto representa cada unidad de la cantidad (catálogo del producto)"
                  >
                    Unidad de ingreso
                  </th>
                  <th className="py-2 pr-3 text-right">Stock mín.</th>
                  <th className="py-2 pr-3 text-right">Stock máx.</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-500">
                      No hay líneas de inventario para este criterio.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const low = rowLowStock(r);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-gray-200/50 hover:bg-white/30"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{r.warehouse.name}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.product.internalCode}</td>
                        <td className="py-2 pr-3">{r.product.name}</td>
                        <td className="py-2 pr-3 text-gray-600">
                          {r.product.supplier?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.quantity}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-700">
                          {formatInventoryEntryUnitDescriptor(
                            r.product.inputUnit,
                            r.product.inputUnitQuantity
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-600">
                          {r.product.minStock}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-600">
                          {r.product.maxStock}
                        </td>
                        <td className="py-2">
                          {low ? (
                            <span className="text-red-700 font-medium text-xs uppercase tracking-wide">
                              Bajo mínimo
                            </span>
                          ) : (
                            <span className="text-green-800 text-xs">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
