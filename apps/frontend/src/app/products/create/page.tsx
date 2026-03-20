'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { createProductRequest } from '@/lib/productsApi';
import { fetchSuppliers } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import type { ProductSupplier } from '@/types/product';

export default function ProductCreatePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('Granel');
  const [isIngredient, setIsIngredient] = useState(true);
  const [isSupply, setIsSupply] = useState(false);
  const [isFinishedProduct, setIsFinishedProduct] = useState(false);
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSuppliers(true);
      setSupplierError(null);
      try {
        const list = await fetchSuppliers();
        if (!cancelled) {
          setSuppliers(list);
          if (list.length === 1) setSupplierId(String(list[0].id));
        }
      } catch (e) {
        if (!cancelled) {
          if (isUnauthorized(e)) {
            router.push('/login');
            return;
          }
          setSupplierError(getApiErrorMessage(e, 'No se pudieron cargar los proveedores'));
        }
      } finally {
        if (!cancelled) setLoadingSuppliers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSave = async () => {
    if (
      !internalCode ||
      !name ||
      !category ||
      !presentation ||
      !unitOfMeasure ||
      !minStock ||
      !maxStock ||
      !supplierId ||
      unitCost === ''
    ) {
      alert('Por favor completa todos los campos obligatorios del producto antes de guardar.');
      return;
    }

    const sid = Number(supplierId);
    if (!Number.isFinite(sid)) {
      alert('Selecciona un proveedor válido.');
      return;
    }

    setSubmitting(true);
    try {
      await createProductRequest({
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
        currentStock: 0,
        unitCost: parseFloat(unitCost),
        supplierId: sid,
      });
      router.push(ROUTES.products.list);
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      alert(getApiErrorMessage(e, 'No se pudo crear el producto'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSuppliers) {
    return (
      <>
        <Topbar title="Crear Producto" />
        <div className="content-card" style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando proveedores…
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Crear Producto" />

      <div id="form-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
        {supplierError && (
          <div
            className="p-4 rounded-lg"
            style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
          >
            {supplierError}
          </div>
        )}

        {suppliers.length === 0 ? (
          <div className="content-card" style={{ padding: '1.5rem' }}>
            <p>No hay proveedores registrados. Debes crear al menos uno en el backend (permiso suppliers:create)</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted, #6b7280)' }}>
              Tras registrarlos, vuelve a esta página.
            </p>
            <Link href={ROUTES.products.list} className="btn btn-outline mt-4 inline-block">
              Volver al listado
            </Link>
          </div>
        ) : (
          <>
            <section className="form-section">
              <div className="form-section-header">
                <h3>Detalles del Producto</h3>
                <div className="input-group-inline right-aligned">
                  <label>Código interno:</label>
                  <input
                    type="text"
                    value={internalCode}
                    onChange={(e) => setInternalCode(e.target.value)}
                    placeholder="Ej: PR-NUE-01"
                    className="input-field text-center"
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
                    placeholder="Nombre completo del producto"
                  />
                </div>
                <div className="input-group">
                  <label>Categoría:</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                    <option value="" disabled>
                      Clasificación
                    </option>
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
                    placeholder="Ej: Granel, Empaque, Envase"
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
                    <option value="" disabled>
                      Unidad
                    </option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="L">Litro (L)</option>
                    <option value="und">Unidad (und)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Fecha de Vencimiento (opcional):</label>
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

              <div className="form-grid split-2">
                <div className="input-group-inline">
                  <label>Stock Mínimo:</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="input-field short-input"
                    placeholder="0"
                  />
                </div>
                <div className="input-group-inline">
                  <label>Stock Máximo:</label>
                  <input
                    type="number"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                    className="input-field short-input"
                    placeholder="0"
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
                    <option value="" disabled>
                      Seleccione Proveedor
                    </option>
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
                    placeholder="0.00"
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
                onClick={() => void handleSave()}
                disabled={submitting}
              >
                {submitting ? 'Guardando…' : 'Guardar Producto'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
