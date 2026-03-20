'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { useProducts } from '@/hooks/useProducts';

export default function ProductCreatePage() {
  const router = useRouter();
  const { saveProduct } = useProducts();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplier, setSupplier] = useState('');
  const [cost, setCost] = useState('');

  const handleSave = () => {
    if (
      !code ||
      !name ||
      !category ||
      !unit ||
      !expiryDate ||
      !minStock ||
      !maxStock ||
      !supplier ||
      !cost
    ) {
      alert('Por favor completa todos los campos del producto antes de guardar.');
      return;
    }

    saveProduct({
      code,
      name,
      category,
      stock: `0.0 ${unit}`,
      lowStock: true,
      expiryDate,
      minStock,
      maxStock,
      supplier,
      cost,
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
              <label>Código:</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
            <div className="input-group">
              <label>Unidad de Medida:</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-field">
                <option value="" disabled>
                  Unidad
                </option>
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
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input-field">
                <option value="" disabled>
                  Seleccione Proveedor
                </option>
                <option value="Distribuidora San Juan">Distribuidora San Juan</option>
                <option value="Mercados del Campo">Mercados del Campo</option>
              </select>
            </div>
            <div className="input-group-inline start-aligned">
              <label>Costo Unitario:</label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="input-field short-input"
                placeholder="0.00"
                step="0.01"
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
          <button type="button" className="btn btn-success" onClick={handleSave}>
            Guardar Producto
          </button>
        </div>
      </div>
    </>
  );
}
