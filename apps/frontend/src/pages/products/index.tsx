'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { useProductList } from '@/hooks/useProductList';
import { deleteProductRequest } from '@/lib/productsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { formatStockDisplay, productLowStock } from '@/types/product';

export default function ProductsPage() {
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
                  <th className="py-2">Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6">
                      No hay productos
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => (
                    <tr
                      key={prod.id}
                      className="hover:bg-gray-200/20 transition"
                    >
                      <td className="py-2">{prod.internalCode}</td>
                      <td><strong>{prod.name}</strong></td>
                      <td>{prod.category}</td>
                      <td>
                        {formatStockDisplay(prod)}
                        {productLowStock(prod) && (
                          <span className="text-red-500 ml-2">⚠</span>
                        )}
                      </td>

                      <td className="text-right space-x-3">

                        <Link
                          href={ROUTES.products.edit(prod.id)}
                          className="text-blue-600 hover:underline"
                        >
                          Modificar
                        </Link>

                        <Button
                          variant="danger"
                          className="text-sm px-3 py-1"
                          disabled={deletingId !== null}
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
