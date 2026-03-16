'use client';

import { useState, useEffect } from 'react';

export interface Producto {
  codigo: string;
  nombre: string;
  categoria: string;
  stock: string;
  bajoStock: boolean;
  activo: boolean;
  fechaVencimiento?: string;
  stockMinimo?: string;
  stockMaximo?: string;
  proveedor?: string;
  costo?: string;
}

const productosBase: Producto[] = [
  { codigo: 'PR-POL-01', nombre: 'Pechuga de Pollo', categoria: 'Proteína', stock: '58.0 kg', bajoStock: false, activo: true },
  { codigo: 'VE-TOM-02', nombre: 'Tomate Chonto', categoria: 'Vegetal', stock: '45.0 kg', bajoStock: false, activo: false },
  { codigo: 'LA-QUE-05', nombre: 'Queso Mozzarella', categoria: 'Lácteos', stock: '8.0 kg', bajoStock: true, activo: false },
  { codigo: 'AB-ARR-01', nombre: 'Arroz Grano Largo', categoria: 'Abarrotes', stock: '100.0 kg', bajoStock: false, activo: false },
  { codigo: 'LI-ACE-10', nombre: 'Aceite de Girasol', categoria: 'Grasas', stock: '20.0 L', bajoStock: false, activo: false },
  { codigo: 'PR-RES-02', nombre: 'Pechuga de Pollo Filete', categoria: 'Proteína', stock: '8.0 kg', bajoStock: true, activo: false },
  { codigo: 'VE-CEB-02', nombre: 'Cebolla Blanca Cabezona', categoria: 'Vegetal', stock: '20.0 kg', bajoStock: false, activo: false }
];

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gastronomic_productos');
    if (saved) {
      setProductos(JSON.parse(saved));
    } else {
      setProductos(productosBase);
      localStorage.setItem('gastronomic_productos', JSON.stringify(productosBase));
    }
    setIsLoaded(true);
  }, []);

  const saveProducto = (nuevo: Producto) => {
    const updated = [...productos, nuevo];
    setProductos(updated);
    localStorage.setItem('gastronomic_productos', JSON.stringify(updated));
  };

  const updateProducto = (modificado: Producto) => {
    const index = productos.findIndex(p => p.codigo === modificado.codigo);
    if (index !== -1) {
      const updated = [...productos];
      updated[index] = modificado;
      setProductos(updated);
      localStorage.setItem('gastronomic_productos', JSON.stringify(updated));
    }
  };

  const setActive = (codigo: string) => {
    const updated = productos.map(p => ({
      ...p,
      activo: p.codigo === codigo
    }));
    setProductos(updated);
    // Note: We might not want to save the 'activo' state to localStorage permanently,
    // or maybe we do depending on requirements. In script.js it was transient via DOM class.
  };

  return { productos, saveProducto, updateProducto, setActive, isLoaded };
}
