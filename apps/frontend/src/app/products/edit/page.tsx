'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { useProducts } from '@/hooks/useProducts';

function ProductEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams?.get('code') ?? null;

  const { products, updateProduct, isLoaded } = useProducts();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplier, setSupplier] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (!isLoaded || !codeParam) return;

    const product = products.find((p) => p.code === codeParam);
    if (!product) return;

    setCode(product.code);
    setName(product.name || '');
    setCategory(product.category || '');

    let stockVal = 0;
    let unitStr = 'kg';
    if (product.stock) {
      const parts = product.stock.split(' ');
      if (parts.length > 0) stockVal = parseFloat(parts[0]) || 0;
      if (parts.length > 1) unitStr = parts[1];
    }

    setUnit(unitStr);
    setCurrentStock(stockVal.toString());
    setExpiryDate(product.expiryDate || '');
    setMinStock(product.minStock || '0');
    setMaxStock(product.maxStock || '0');
    setSupplier(product.supplier || '');
    setCost(product.cost || '0');
  }, [isLoaded, codeParam, products]);

  const handleUpdate = () => {
    const minS = parseFloat(minStock);
    const currS = parseFloat(currentStock);

    updateProduct({
      code,
      name,
      category,
      stock: `${parseFloat(currentStock).toFixed(1)} ${unit}`,
      lowStock: currS < minS,
      expiryDate,
      minStock,
      maxStock,
      supplier,
      cost,
    });

    alert('¡Producto modificado y actualizado con éxito en la base de datos!');
    router.push(ROUTES.products.list);
  };

  if (!isLoaded) return null;

  return (
    <>
      <Topbar title="Modificar Producto" />

      <div id="form-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
        <section className="form-section">
          <div className="form-section-header">
            <h3>Detalles del Producto</h3>
            <div className="input-group-inline right-aligned">
              <label>Código:</label>
              <input
                type="text"
                value={code}
                disabled
                className="input-disabled text-center"
                style={{ width: '150px' }}
              />
            </div>
          </div>
          <hr className="section-divider" />

          <div className="form-grid">
            <div className="input-group full-width">
              <label>Nombre del Producto:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="input-group">
              <label>Categoría:</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                <option value="Proteína">Proteína</option>
                <option value="Vegetal">Vegetal</option>
                <option value="Lácteos">Lácteos</option>
                <option value="Abarrotes">Abarrotes</option>
                <option value="Grasas">Grasas</option>
              </select>
            </div>
            <div className="input-group">
              <label>Unidad de Medida:</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-field">
                <option value="kg">Kilogramo (kg)</option>
                <option value="L">Litro (L)</option>
                <option value="und">Unidad (und)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Fecha de Vencimiento:</label>
              <div className="date-input-wrapper">
                <i className="fa-regular fa-calendar input-icon"></i>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="input-field pl-8"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h3>Límites de Stock</h3>
          </div>
          <hr className="section-divider" />

          <div className="form-grid split-3" style={{ gap: '1.5rem', justifyContent: 'space-between' }}>
            <div className="input-group-inline">
              <label>Stock Mínimo:</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="input-field short-input"
              />
            </div>
            <div className="input-group-inline">
              <label>Stock Máximo:</label>
              <input
                type="number"
                value={maxStock}
                onChange={(e) => setMaxStock(e.target.value)}
                className="input-field short-input"
              />
            </div>
            <div className="input-group-inline right-aligned">
              <label>Stock Actual:</label>
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="input-field short-input"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h3>Proveedor y Costeo</h3>
          </div>
          <hr className="section-divider" />

          <div className="form-grid">
            <div className="input-group full-width">
              <label>Proveedor:</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input-field">
                <option value="Pollos Bucanero">Pollos Bucanero</option>
                <option value="Distribuidora San Juan">Distribuidora San Juan</option>
                <option value="Mercados del Campo">Mercados del Campo</option>
              </select>
            </div>
            <div className="input-group-inline start-aligned">
              <label>Costo Unitario:</label>
              <input
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="input-field short-input"
              />
            </div>
            <div className="input-group-inline start-aligned">
              <label>Moneda:</label>
              <select className="input-field short-input" defaultValue="USD">
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
          </div>
        </section>

        <div className="form-actions">
          <Link
            href={ROUTES.products.list}
            className="btn btn-outline"
            style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}
          >
            Cancelar
          </Link>
          <button type="button" className="btn btn-success" onClick={handleUpdate}>
            Modificar Producto
          </button>
        </div>
      </div>
    </>
  );
}

export default function ProductEditPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ProductEditContent />
    </Suspense>
  );
}
