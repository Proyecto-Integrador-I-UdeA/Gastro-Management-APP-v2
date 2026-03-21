'use client';

import { useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { useSupplierList } from '@/hooks/useSupplierList';
import { deleteSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useRouter } from 'next/navigation';

export default function SuppliersPage() {
  const router = useRouter();
  const { suppliers, loading, error, refetch } = useSupplierList();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el proveedor "${name}"? No podrás si tiene productos asociados.`)) {
      return;
    }
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

  if (loading) {
    return (
      <>
        <Topbar title="Proveedores" />
        <div className="content-card" style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando proveedores…
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Proveedores" />

      <div className="content-card" id="list-view">
        <div className="card-header">
          <h3>Directorio de proveedores</h3>
          <Link
            href={ROUTES.suppliers.create}
            className="btn btn-primary"
            style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: '0.5rem' }}></i>
            Nuevo proveedor
          </Link>
        </div>

        {error && (
          <div
            className="p-4 mb-4 rounded-lg"
            style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
          >
            <p style={{ margin: 0 }}>{error}</p>
            <button type="button" className="btn btn-outline mt-2" onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>NIT / RUT</th>
                <th>Teléfono</th>
                <th>Contacto</th>
                <th>Dirección</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && !error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay proveedores. Crea uno con &quot;Nuevo proveedor&quot;.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className={hoveredId === s.id ? 'active-row' : ''}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <td>{s.internalCode}</td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.taxId}</td>
                    <td>{s.phone}</td>
                    <td>{s.contactPerson || '—'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.address}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link href={ROUTES.suppliers.edit(s.id)} className="action-btn" style={{ marginRight: '0.5rem' }}>
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="action-btn"
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#b91c1c',
                          cursor: deletingId === s.id ? 'wait' : 'pointer',
                        }}
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(s.id, s.name)}
                      >
                        {deletingId === s.id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
