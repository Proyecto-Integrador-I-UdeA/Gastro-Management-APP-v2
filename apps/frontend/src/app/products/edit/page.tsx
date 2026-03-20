'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { MOCK_SUPPLIERS } from '@/data/productSeed';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/types/product';

function ProductEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams?.get('code') ?? null;

  const { products, updateProduct, isLoaded } = useProducts();

  const [productId, setProductId] = useState<number | null>(null);
  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('');
  const [isIngredient, setIsIngredient] = useState(true);
  const [isSupply, setIsSupply] = useState(false);
  const [isFinishedProduct, setIsFinishedProduct] = useState(false);
  const [unitOfMeasure, setUnitOfMeasure] = useState('kg');
  const [currentStock, setCurrentStock] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState('');

  useEffect(() => {
    if (!isLoaded || !codeParam) return;

    const product = products.find((p) => p.internalCode === codeParam);
    if (!product) return;

    setProductId(product.id);
    setInternalCode(product.internalCode);
    setName(product.name || '');
    setCategory(product.category || '');
    setPresentation(product.presentation || 'Granel');
    setIsIngredient(product.isIngredient);
    setIsSupply(product.isSupply);
    setIsFinishedProduct(product.isFinishedProduct);
    setUnitOfMeasure(product.unitOfMeasure || 'kg');
    setCurrentStock(String(product.currentStock ?? 0));
    setExpiryDate(product.expirationDate ? product.expirationDate.slice(0, 10) : '');
    setMinStock(String(product.minStock ?? 0));
    setMaxStock(String(product.maxStock ?? 0));
    setSupplierId(String(product.supplierId));
    setUnitCost(String(product.unitCost ?? 0));
  }, [isLoaded, codeParam, products]);

  const handleUpdate = () => {
    if (productId == null) {
      alert('No se encontró el producto.');
      return;
    }

    const sid = Number(supplierId);
    if (!Number.isFinite(sid)) {
      alert('Selecciona un proveedor válido.');
      return;
    }

    const minS = parseFloat(minStock);
    const currS = parseFloat(currentStock);

    const updated: Product = {
      id: productId,
      internalCode,
      name,
      category,
      isIngredient,
      isSupply,
      isFinishedProduct,
      presentation,
      unitOfMeasure,
      expirationDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      minStock: minS,
      maxStock: parseFloat(maxStock),
      currentStock: currS,
      unitCost: parseFloat(unitCost),
      supplierId: sid,
      supplier: MOCK_SUPPLIERS.find((s) => s.id === sid),
    };

    updateProduct(updated);

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
              <label>Código interno:</label>
              <input
                type="text"
                value={internalCode}
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
            <div className="input-group full-width">
              <label>Presentación:</label>
              <input
                type="text"
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="input-group full-width field-stack">
              <label>Tipo de ítem</label>
              <div className="product-type-options" role="group" aria-label="Tipo de ítem">
                <label className="product-type-option">
                  <input
                    type="checkbox"
                    checked={isIngredient}
                    onChange={(e) => setIsIngredient(e.target.checked)}
                  />
                  <span>Ingrediente</span>
                </label>
                <label className="product-type-option">
                  <input type="checkbox" checked={isSupply} onChange={(e) => setIsSupply(e.target.checked)} />
                  <span>Insumo</span>
                </label>
                <label className="product-type-option">
                  <input
                    type="checkbox"
                    checked={isFinishedProduct}
                    onChange={(e) => setIsFinishedProduct(e.target.checked)}
                  />
                  <span>Producto terminado</span>
                </label>
              </div>
            </div>
            <div className="input-group">
              <label>Unidad de Medida:</label>
              <select
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                className="input-field"
              >
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
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="input-field"
              >
                {MOCK_SUPPLIERS.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group-inline start-aligned">
              <label>Costo unitario:</label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="input-field short-input"
                step="0.01"
              />
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
