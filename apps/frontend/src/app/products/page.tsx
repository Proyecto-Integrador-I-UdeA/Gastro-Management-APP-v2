'use client';

import { useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { useProducts } from '@/hooks/useProducts';

export default function ProductsPage() {
  const { products, isLoaded } = useProducts();
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  if (!isLoaded) {
    return null;
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
              {products.map((prod) => (
                <tr
                  key={prod.code}
                  className={hoveredCode === prod.code ? 'active-row' : ''}
                  onMouseEnter={() => setHoveredCode(prod.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                >
                  <td>{prod.code}</td>
                  <td>
                    <strong>{prod.name}</strong>
                  </td>
                  <td>{prod.category}</td>
                  <td>
                    {prod.stock}
                    {prod.lowStock && (
                      <i className="fa-solid fa-triangle-exclamation warning-icon" title="Stock Bajo"></i>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={ROUTES.products.edit(prod.code)} className="action-btn">
                      Modificar
                    </Link>
                  </td>
                </tr>
              ))}
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
