'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { fetchProductById, updateProductRequest } from '@/lib/productsApi';
import { fetchSuppliers } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import type { ProductSupplier } from '@/types/product';

function ProductEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id');
  const productId = idParam ? parseInt(idParam, 10) : NaN;

  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!Number.isFinite(productId) || productId < 1) {
      setLoading(false);
      setLoadError('ID de producto no válido');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [product, supplierList] = await Promise.all([
          fetchProductById(productId),
          fetchSuppliers(),
        ]);
        if (cancelled) return;
        setSuppliers(supplierList);
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
      } catch (e) {
        if (cancelled) return;
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }
        setLoadError(getApiErrorMessage(e, 'No se pudo cargar el producto'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, router]);

  const handleUpdate = async () => {
    if (!Number.isFinite(productId) || productId < 1) return;

    const sid = Number(supplierId);
    if (!Number.isFinite(sid)) {
      alert('Selecciona un proveedor válido.');
      return;
    }

    setSubmitting(true);
    try {
      await updateProductRequest(productId, {
        internalCode,
        name,
        category,
        isIngredient,
        isSupply,
        isFinishedProduct,
        presentation,
        unitOfMeasure,
        expirationDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        minStock: parseFloat(minStock),
        maxStock: parseFloat(maxStock),
        currentStock: parseFloat(currentStock),
        unitCost: parseFloat(unitCost),
        supplierId: sid,
      });
      router.push(ROUTES.products.list);
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      alert(getApiErrorMessage(e, 'No se pudo actualizar el producto'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar title="Modificar Producto" />
        <div className="content-card" style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando…
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Topbar title="Modificar Producto" />
        <div className="content-card" style={{ padding: '1.5rem' }}>
          <p style={{ color: '#b91c1c' }}>{loadError}</p>
          <Link href={ROUTES.products.list} className="btn btn-outline mt-4 inline-block">
            Volver al listado
          </Link>
        </div>
      </>
    );
  }

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
                {suppliers.map((s) => (
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
          <button
            type="button"
            className="btn btn-success"
            onClick={() => void handleUpdate()}
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Modificar Producto'}
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
