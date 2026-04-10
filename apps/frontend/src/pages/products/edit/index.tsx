'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ProductUnitFields from '@/components/ProductUnitFields';
import { ROUTES } from '@/constants/routes';
import { fetchProductById, updateProductRequest } from '@/lib/productsApi';
import { fetchSuppliers, fetchSupplierById } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import type { ProductSupplier } from '@/types/product';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  coerceInputUnitForBase,
  isProductInputUnit,
  parseBaseUnitFromStored,
} from '@/lib/productUnits';

export default function ProductEditPage() {
  useAuthGuard('products.update');
  const router = useRouter();
  const { id } = router.query;

  const productId = id ? parseInt(id as string, 10) : NaN;

  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('');
  const [isIngredient, setIsIngredient] = useState(true);
  const [isSupply, setIsSupply] = useState(false);
  const [isFinishedProduct, setIsFinishedProduct] = useState(false);
  const [baseUnit, setBaseUnit] = useState<ProductBaseUnit>('g');
  const [inputUnit, setInputUnit] = useState<ProductInputUnit>('g');
  const [inputUnitQuantity, setInputUnitQuantity] = useState('1');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');

  useEffect(() => {
    setInputUnit((prev) => coerceInputUnitForBase(baseUnit, prev));
  }, [baseUnit]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!Number.isFinite(productId) || productId < 1) {
      setLoading(false);
      setError('ID de producto no válido');
      return;
    }

    const loadData = async () => {
      try {
        const product = await fetchProductById(productId);
        let supplierList = await fetchSuppliers();

        if (!supplierList.some((s) => s.id === product.supplierId)) {
          const currentSupplier = await fetchSupplierById(product.supplierId);
          supplierList = [...supplierList, currentSupplier];
        }

        setSuppliers(supplierList);

        setInternalCode(product.internalCode || '');
        setName(product.name || '');
        setCategory(product.category || '');
        setPresentation(product.presentation || '');
        setIsIngredient(product.isIngredient);
        setIsSupply(product.isSupply);
        setIsFinishedProduct(product.isFinishedProduct);

        const base = parseBaseUnitFromStored(product.unitOfMeasure || 'g');
        setBaseUnit(base);
        const rawIu = product.inputUnit;
        const iu = isProductInputUnit(rawIu) ? rawIu : 'g';
        setInputUnit(coerceInputUnitForBase(base, iu));
        setInputUnitQuantity(String(product.inputUnitQuantity ?? 1));

        setMinStock(String(product.minStock ?? 0));
        setMaxStock(String(product.maxStock ?? 0));
        setSupplierId(String(product.supplierId));
      } catch (e) {
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }

        setError(getApiErrorMessage(e, 'No se pudo cargar el producto'));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [productId, router.isReady, router]);

  const handleUpdate = async () => {
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
      await updateProductRequest(productId, {
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

      alert(getApiErrorMessage(e, 'No se pudo actualizar el producto'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">Editar producto</h1>

      {loading && <div className="text-center py-10">Cargando...</div>}

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Código interno" value={internalCode} disabled />

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
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
