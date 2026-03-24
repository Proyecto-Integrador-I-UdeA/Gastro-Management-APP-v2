'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '../../components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { useSupplierList } from '@/hooks/useSupplierList';
import { deleteSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useRouter } from 'next/router';

export default function SuppliersPage() {
  const router = useRouter();
  const { suppliers, loading, error, refetch } = useSupplierList();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el proveedor "${name}"?`)) return;

    setDeletingId(id);
    try {
      await deleteSupplierRequest(id);
      await refetch();
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      alert(getApiErrorMessage(e, 'No se pudo eliminar el proveedor'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>

      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Proveedores
      </h1>

      {/* CARD */}
      <div className="bg-white p-6 rounded-xl shadow-md">

        {/* HEADER CARD */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Directorio de proveedores
          </h3>

          <Button
            onClick={() => router.push(ROUTES.suppliers.create)}
          >
            + Nuevo proveedor
          </Button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}

            <Button
              variant="secondary"
              className="ml-4 mt-2"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* TABLA */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">

            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">NIT / RUT</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Contacto</th>
                <th className="p-3">Dirección</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>

            <tbody>
              {suppliers.length === 0 && !error ? (
                <tr>
                  <td colSpan={7} className="text-center p-6">
                    No hay proveedores.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="p-3">{s.internalCode}</td>
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3">{s.taxId}</td>
                    <td className="p-3">{s.phone}</td>
                    <td className="p-3">{s.contactPerson || '—'}</td>
                    <td className="p-3 max-w-[200px] truncate">
                      {s.address}
                    </td>

                    <td className="p-3 text-right space-x-3">

                      <Link
                        href={ROUTES.suppliers.edit(s.id)}
                        className="text-blue-600 hover:underline"
                      >
                        Editar
                      </Link>

                      <Button
                        variant="danger"
                        className="text-sm px-3 py-1"
                        disabled={deletingId !== null}
                        onClick={() => handleDelete(s.id, s.name)}
                      >
                        {deletingId === s.id ? '…' : 'Eliminar'}
                      </Button>

                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

      </div>

    </DashboardLayout>
  );
}































































































































