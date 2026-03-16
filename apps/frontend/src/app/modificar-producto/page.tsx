'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { useProductos } from '@/hooks/useProductos';

function ModificarProductoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeToEdit = searchParams.get('codigo');
  
  const { productos, updateProducto, isLoaded } = useProductos();

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [stockActual, setStockActual] = useState('0');
  const [fechaVencimiento, setFecha] = useState('');
  const [stockMinimo, setStockMin] = useState('');
  const [stockMaximo, setStockMax] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [costo, setCosto] = useState('');

  useEffect(() => {
    if (isLoaded && codeToEdit) {
      const product = productos.find(p => p.codigo === codeToEdit);
      if (product) {
        setCodigo(product.codigo);
        setNombre(product.nombre || '');
        setCategoria(product.categoria || '');
        
        // Extract stock
        let stockVal = 0;
        let unitStr = 'kg';
        if (product.stock) {
          const parts = product.stock.split(' ');
          if (parts.length > 0) stockVal = parseFloat(parts[0]) || 0;
          if (parts.length > 1) unitStr = parts[1];
        }
        
        setUnidad(unitStr);
        setStockActual(stockVal.toString());
        setFecha(product.fechaVencimiento || '');
        setStockMin(product.stockMinimo || '0');
        setStockMax(product.stockMaximo || '0');
        setProveedor(product.proveedor || '');
        setCosto(product.costo || '0');
      }
    }
  }, [isLoaded, codeToEdit, productos]);

  const handleUpdate = () => {
    const minS = parseFloat(stockMinimo);
    const currS = parseFloat(stockActual);
    
    updateProducto({
      codigo, // Note: The code should not be modifiable so we pass the original one
      nombre,
      categoria,
      stock: `${parseFloat(stockActual).toFixed(1)} ${unidad}`,
      bajoStock: currS < minS,
      activo: false,
      fechaVencimiento,
      stockMinimo,
      stockMaximo,
      proveedor,
      costo
    });

    alert('¡Producto modificado y actualizado con éxito en la base de datos!');
    router.push('/');
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
                value={codigo} 
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
                value={nombre} 
                onChange={e => setNombre(e.target.value)} 
                className="input-field" 
              />
            </div>
            <div className="input-group">
              <label>Categoría:</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="input-field">
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
          
          <div className="form-grid split-3" style={{ gap: '1.5rem', justifyContent: 'space-between' }}>
            <div className="input-group-inline">
              <label>Stock Mínimo:</label>
              <input 
                type="number" 
                value={stockMinimo} 
                onChange={e => setStockMin(e.target.value)} 
                className="input-field short-input" 
              />
            </div>
            <div className="input-group-inline">
              <label>Stock Máximo:</label>
              <input 
                type="number" 
                value={stockMaximo} 
                onChange={e => setStockMax(e.target.value)} 
                className="input-field short-input" 
              />
            </div>
            <div className="input-group-inline right-aligned">
              <label>Stock Actual:</label>
              <input 
                type="number" 
                value={stockActual} 
                onChange={e => setStockActual(e.target.value)} 
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
              <select value={proveedor} onChange={e => setProveedor(e.target.value)} className="input-field">
                <option value="Pollos Bucanero">Pollos Bucanero</option>
                <option value="Distribuidora San Juan">Distribuidora San Juan</option>
                <option value="Mercados del Campo">Mercados del Campo</option>
              </select>
            </div>
            <div className="input-group-inline start-aligned">
              <label>Costo Unitario:</label>
              <input 
                type="text" 
                value={costo} 
                onChange={e => setCosto(e.target.value)} 
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
          <Link href="/" className="btn btn-outline" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
            Cancelar
          </Link>
          <button className="btn btn-success" onClick={handleUpdate}>Modificar Producto</button>
        </div>
      </div>
    </>
  );
}

export default function ModificarProducto() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ModificarProductoContent />
    </Suspense>
  );
}
