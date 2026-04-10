'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ProductUnitFields from '@/components/ProductUnitFields';
import { ROUTES } from '@/constants/routes';
import { createProductRequest } from '@/lib/productsApi';
import { fetchSuppliers } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import type { ProductSupplier } from '@/types/product';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  coerceInputUnitForBase,
} from '@/lib/productUnits';

export default function ProductCreatePage() {
  useAuthGuard('products.create');
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('');
  const [isIngredient, setIsIngredient] = useState(true);
  const [isSupply, setIsSupply] = useState(false);
  const [isFinishedProduct, setIsFinishedProduct] = useState(false);
  const [baseUnit, setBaseUnit] = useState<ProductBaseUnit>('g');
  const [inputUnit, setInputUnit] = useState<ProductInputUnit>('kg');
  const [inputUnitQuantity, setInputUnitQuantity] = useState('1');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');

  useEffect(() => {
    setInputUnit((prev) => coerceInputUnitForBase(baseUnit, prev));
  }, [baseUnit]);

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

          setSupplierError(
            getApiErrorMessage(e, 'No se pudieron cargar los proveedores')
          );
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
     // !internalCode ||
      !name ||
      !category ||
      !presentation ||
      !minStock ||
      !maxStock ||
      !supplierId
    ) {
      alert('Completa todos los campos obligatorios');
      return;
    }

    const sid = Number(supplierId);
    if (!Number.isFinite(sid)) {
      alert('Proveedor inválido');
      return;
    }

    const iuq = parseFloat(inputUnitQuantity.replace(',', '.'));
    if (!Number.isFinite(iuq) || iuq <= 0) {
      alert('La cantidad por unidad ingresada debe ser mayor a cero');
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
        unitOfMeasure: baseUnit,
        inputUnit,
        inputUnitQuantity: iuq,
        minStock: parseFloat(minStock),
        maxStock: parseFloat(maxStock),
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

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">Nuevo producto</h1>

      {loadingSuppliers && <div className="text-center py-10">Cargando proveedores...</div>}

      {supplierError && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{supplierError}</div>
      )}

      {!loadingSuppliers && suppliers.length === 0 && (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <p>No hay proveedores registrados.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push(ROUTES.products.list)}
          >
            Volver
          </Button>
        </div>
      )}

      {!loadingSuppliers && suppliers.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<<<<<<< HEAD

          {/*  <Input label="Código interno" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />*/}
=======
            <Input label="Código interno" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
>>>>>>> 61b2c1b00457346cdb3c78fc47c62c36d1ed0c92
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="md:col-span-2" />

            <Input label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input label="Presentación" value={presentation} onChange={(e) => setPresentation(e.target.value)} />

            <ProductUnitFields
              baseUnit={baseUnit}
              onBaseUnitChange={setBaseUnit}
              inputUnit={inputUnit}
              onInputUnitChange={setInputUnit}
              inputUnitQuantity={inputUnitQuantity}
              onInputUnitQuantityChange={setInputUnitQuantity}
            />

            <Input label="Stock mínimo" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <Input label="Stock máximo" type="number" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Proveedor</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border rounded-md p-2"
              >
                <option value="">Seleccionar</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-4 flex-wrap">
            <label>
              <input type="checkbox" checked={isIngredient} onChange={(e) => setIsIngredient(e.target.checked)} />{' '}
              Ingrediente
            </label>
            <label>
              <input type="checkbox" checked={isSupply} onChange={(e) => setIsSupply(e.target.checked)} /> Insumo
            </label>
            <label>
              <input type="checkbox" checked={isFinishedProduct} onChange={(e) => setIsFinishedProduct(e.target.checked)} />{' '}
              Producto terminado
            </label>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="secondary" onClick={() => router.push(ROUTES.products.list)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar Producto'}
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
