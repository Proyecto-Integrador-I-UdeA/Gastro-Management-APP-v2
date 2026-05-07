'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { useProductList } from '@/hooks/useProductList';
import { setProductActiveRequest } from '@/lib/productsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getUserPermissions } from '@/utils/permissions';
import { productTypeLabels } from '@/types/product';
import { showError, showSuccess } from '@/utils/toast';

export default function ProductsPage() {
  useAuthGuard('products.read');

  const [permissions, setPermissions] = useState<string[]>([]);
  const router = useRouter();

  const { products, loading, error, refetch, filterSupplierId, supplierLabel } =
    useProductList();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleToggleActive = async (id: number, name: string, active: boolean) => {
    const action = active ? 'inactivar' : 'activar';
    if (!confirm(`¿Confirmas que deseas ${action} el producto "${name}"?`)) {
      return;
    }

    setBusyId(id);
    try {
      await setProductActiveRequest(id, !active);
      showSuccess(
        active
          ? `El producto "${name}" se inactivó correctamente.`
          : `El producto "${name}" se activó correctamente.`
      );
      await refetch();
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      showError(getApiErrorMessage(e, `No se pudo ${action} el producto`));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    setPermissions(getUserPermissions());
  }, []);

  const can = (perm: string) =>
    permissions.some((p) => p.trim().toLowerCase() === perm.toLowerCase());

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">Productos</h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Gestión completa del catálogo de productos
          </h3>

          <Button
            disabled={!can('products.create')}
            onClick={() => router.push(ROUTES.products.create)}
          >
            + Nuevo Producto
          </Button>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            <p>{error}</p>
            <Button variant="secondary" className="mt-2" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {filterSupplierId != null && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando productos del proveedor{' '}
              <span className="font-semibold">
                {supplierLabel ?? `#${filterSupplierId}`}
              </span>
              .
            </p>
            <Button variant="secondary" className="shrink-0" onClick={() => void router.push(ROUTES.products.list)}>
              Quitar filtro
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">Cargando productos…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Código</th>
                  <th className="pr-3">Producto</th>
                  <th className="pr-3">Categoría</th>
                  <th className="pr-3">Tipo</th>
                  <th className="pr-3 whitespace-nowrap">Stock mín.</th>
                  <th className="pr-3 whitespace-nowrap">Stock máx.</th>
                  <th className="pr-3">Proveedor</th>
                  <th className="pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6">
                      {filterSupplierId != null
                        ? 'No hay productos para este proveedor'
                        : 'No hay productos'}
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const types = productTypeLabels(prod);
                    return (
                      <tr
                        key={prod.id}
                        className="hover:bg-gray-200/20 transition"
                      >
                        <td className="py-2 pr-3">{prod.internalCode}</td>
                        <td className="pr-3">
                          <strong>{prod.name}</strong>
                        </td>
                        <td className="pr-3">{prod.category}</td>
                        <td className="pr-3 max-w-[220px]">
                          {types.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {types.map((label) => (
                                <span
                                  key={label}
                                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#001F3F]/10 text-[#001F3F]"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="pr-3 text-gray-700">{prod.minStock}</td>
                        <td className="pr-3 text-gray-700">{prod.maxStock}</td>
                        <td className="pr-3 text-gray-700">
                          {prod.supplier?.name ?? '—'}
                        </td>
                        <td className="pr-3">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              prod.active !== false
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {prod.active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="text-left space-x-3 whitespace-nowrap">
                          {can('products.update') ? (
                            <Link
                              href={ROUTES.products.edit(prod.id)}
                              className="text-blue-600 hover:underline"
                            >
                              Modificar
                            </Link>
                          ) : (
                            <span className="text-gray-400">Modificar</span>
                          )}

                          <Button
                            variant={prod.active !== false ? 'danger' : 'secondary'}
                            className="text-sm px-3 py-1"
                            disabled={busyId !== null || !can('products.update')}
                            onClick={() =>
                              handleToggleActive(
                                prod.id,
                                prod.name,
                                prod.active !== false
                              )
                            }
                          >
                            {busyId === prod.id
                              ? '…'
                              : prod.active !== false
                                ? 'Inactivar'
                                : 'Activar'}
                          </Button>
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
