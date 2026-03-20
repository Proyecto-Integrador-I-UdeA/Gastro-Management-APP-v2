'use client';

import { useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { useProductList } from '@/hooks/useProductList';
import { formatStockDisplay, productLowStock } from '@/types/product';

export default function ProductsPage() {
  const { products, loading, error, refetch } = useProductList();
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  if (loading) {
    return (
      <>
        <Topbar title="Productos" />
        <div className="content-card" style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando productos…
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Productos" />

      <div className="content-card" id="list-view">
        <div className="card-header">
          <h3>Gestión completa del catálogo de productos</h3>
          <Link
            href={ROUTES.products.create}
            className="btn btn-primary"
            id="btn-new-product"
            style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: '0.5rem' }}></i> Nuevo Producto
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
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock Actual</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && !error ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay productos. Crea el primero con &quot;Nuevo Producto&quot; (requiere proveedores en
                    la base de datos).
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr
                    key={prod.id}
                    className={hoveredCode === prod.internalCode ? 'active-row' : ''}
                    onMouseEnter={() => setHoveredCode(prod.internalCode)}
                    onMouseLeave={() => setHoveredCode(null)}
                  >
                    <td>{prod.internalCode}</td>
                    <td>
                      <strong>{prod.name}</strong>
                    </td>
                    <td>{prod.category}</td>
                    <td>
                      {formatStockDisplay(prod)}
                      {productLowStock(prod) && (
                        <i className="fa-solid fa-triangle-exclamation warning-icon" title="Stock Bajo"></i>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={ROUTES.products.edit(prod.id)} className="action-btn">
                        Modificar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="search-container">
          <div className="search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Buscar por nombre, código o categoría..."
              className="search-input"
            />
          </div>
        </div>
      </div>
    </>
  );
}
