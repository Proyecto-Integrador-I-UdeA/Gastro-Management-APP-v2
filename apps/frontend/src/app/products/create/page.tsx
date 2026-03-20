'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { MOCK_SUPPLIERS } from '@/data/productSeed';
import { useProducts } from '@/hooks/useProducts';

export default function ProductCreatePage() {
  const router = useRouter();
  const { saveProduct } = useProducts();

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

  const handleSave = () => {
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

    saveProduct({
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

    alert('¡Producto guardado exitosamente!');
    router.push(ROUTES.products.list);
  };

  return (
    <>
      <Topbar title="Crear Producto" />

      <div id="form-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
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
          <button type="button" className="btn btn-success" onClick={handleSave}>
            Guardar Producto
          </button>
        </div>
      </div>
    </>
  );
}
