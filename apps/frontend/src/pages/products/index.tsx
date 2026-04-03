'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { useProductList } from '@/hooks/useProductList';
import { deleteProductRequest } from '@/lib/productsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useEffect, useState } from "react";
import { getUserPermissions } from "@/utils/permissions";

export default function ProductsPage() {
  useAuthGuard("products.read");

  const [permissions, setPermissions] = useState<string[]>([]);
  const router = useRouter();
  const { products, loading, error, refetch } = useProductList();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el producto "${name}"? Esta acción no se puede deshacer.`)) return;

    setDeletingId(id);
    try {
      await deleteProductRequest(id);
      await refetch();
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      alert(getApiErrorMessage(e, 'No se pudo eliminar el producto'));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const perms = getUserPermissions();
      console.log("PERMISOS REALES:", perms);
    setPermissions(perms);
  }, []);

  const can = (perm: string) =>
     permissions.some(p => p.trim().toLowerCase() === perm.toLowerCase());

  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Productos
      </h1>

      {/* CONTENEDOR */}
      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Gestión completa del catálogo de productos
          </h3>

          <Button
            disabled={!can("products.create")}
            onClick={() => router.push(ROUTES.products.create)}
          >
            + Nuevo Producto
          </Button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* LOADING */}
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
                  <th className="pr-3 whitespace-nowrap">Stock mín.</th>
                  <th className="pr-3 whitespace-nowrap">Stock máx.</th>
                  <th className="pr-3">Proveedor</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6">
                      No hay productos
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-gray-200/20 transition"
                    >
                      <td className="py-2 pr-3">{prod.internalCode}</td>
                      <td className="pr-3">
                        <strong>{prod.name}</strong>
                      </td>
                      <td className="pr-3">{prod.category}</td>
                      <td className="pr-3 text-gray-700">{prod.minStock}</td>
                      <td className="pr-3 text-gray-700">{prod.maxStock}</td>
                      <td className="pr-3 text-gray-700">
                        {prod.supplier?.name ?? '—'}
                      </td>

                      <td className="text-right space-x-3">

                        {/* EDITAR */}
                        {can("products.update") ? (
                          <Link
                            href={ROUTES.products.edit(prod.id)}
                            className="text-blue-600 hover:underline"
                          >
                            Modificar
                          </Link>
                        ) : (
                          <span className="text-gray-400">Modificar</span>
                        )}

                        {/* ELIMINAR */}
                        <Button
                          variant="danger"
                          className="text-sm px-3 py-1"
                          disabled={
                            deletingId !== null || !can("products.delete")
                          }
                          onClick={() => handleDelete(prod.id, prod.name)}
                        >
                          {deletingId === prod.id ? '…' : 'Eliminar'}
                        </Button>

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