'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { useProductos } from '@/hooks/useProductos';

export default function CrearProducto() {
  const router = useRouter();
  const { saveProducto } = useProductos();

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidad, setUnidad] = useState('');
  const [fechaVencimiento, setFecha] = useState('');
  const [stockMinimo, setStockMin] = useState('');
  const [stockMaximo, setStockMax] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [costo, setCosto] = useState('');

  const handleSave = () => {
    if (!codigo || !nombre || !categoria || !unidad || !fechaVencimiento || !stockMinimo || !stockMaximo || !proveedor || !costo) {
      alert('Por favor completa todos los campos del producto antes de guardar.');
      return;
    }

    saveProducto({
      codigo,
      nombre,
      categoria,
      stock: `0.0 ${unidad}`,
      bajoStock: true,
      activo: false,
      fechaVencimiento,
      stockMinimo,
      stockMaximo,
      proveedor,
      costo
    });

    alert('¡Producto guardado exitosamente!');
    router.push('/');
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
                value={codigo} 
                onChange={e => setCodigo(e.target.value)} 
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
                value={nombre} 
                onChange={e => setNombre(e.target.value)} 
                className="input-field" 
                placeholder="Nombre completo del producto" 
              />
            </div>
            <div className="input-group">
              <label>Categoría:</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="input-field">
                <option value="" disabled>Clasificación</option>
                <option value="Proteína">Proteína</option>
                <option value="Vegetal">Vegetal</option>
                <option value="Lácteos">Lácteos</option>
                <option value="Abarrotes">Abarrotes</option>
                <option value="Grasas">Grasas</option>
              </select>
            </div>
            <div className="input-group">
              <label>Unidad de Medida:</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value)} className="input-field">
                <option value="" disabled>Unidad</option>
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
                  value={fechaVencimiento} 
                  onChange={e => setFecha(e.target.value)} 
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
                value={stockMinimo} 
                onChange={e => setStockMin(e.target.value)} 
                className="input-field short-input" 
                placeholder="0" 
              />
            </div>
            <div className="input-group-inline">
              <label>Stock Máximo:</label>
              <input 
                type="number" 
                value={stockMaximo} 
                onChange={e => setStockMax(e.target.value)} 
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
              <select value={proveedor} onChange={e => setProveedor(e.target.value)} className="input-field">
                <option value="" disabled>Seleccione Proveedor</option>
                <option value="Distribuidora San Juan">Distribuidora San Juan</option>
                <option value="Mercados del Campo">Mercados del Campo</option>
              </select>
            </div>
            <div className="input-group-inline start-aligned">
              <label>Costo Unitario:</label>
              <input 
                type="number" 
                value={costo} 
                onChange={e => setCosto(e.target.value)} 
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
          <Link href="/" className="btn btn-outline" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
            Cancelar
          </Link>
          <button className="btn btn-success" onClick={handleSave}>Guardar Producto</button>
        </div>
      </div>
    </>
  );
}
