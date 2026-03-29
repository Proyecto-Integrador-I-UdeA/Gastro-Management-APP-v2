'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { fetchProductById, updateProductRequest } from '@/lib/productsApi';
import { fetchSuppliers, fetchSupplierById } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import {
  isExpirationDateNotBeforeToday,
  todayLocalDateInputValue,
} from '@/utils/expirationDate';
import type { ProductSupplier } from '@/types/product';
import {
  PRODUCT_INPUT_UNITS,
  convertToBaseUnits,
  isProductInputUnit,
  type ProductInputUnit,
} from '@/lib/productUnitConversion';

export default function ProductEditPage() {
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
  const [inputUnit, setInputUnit] = useState<ProductInputUnit>('kg');
  const [inputUnitQuantity, setInputUnitQuantity] = useState('1');
  const [currentStock, setCurrentStock] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const normalized = convertToBaseUnits(
    inputUnit,
    Number.parseFloat(inputUnitQuantity)
  );

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

        // Si el producto quedó asociado a un proveedor inactivo, `fetchSuppliers()` lo filtra.
        // En ese caso, agregamos el proveedor actual para que el select no quede vacío.
        if (!supplierList.some((s) => s.id === product.supplierId)) {
          const currentSupplier = await fetchSupplierById(product.supplierId);
          supplierList = [...supplierList, currentSupplier];
        }

        setSuppliers(supplierList);

        setInternalCode(product.internalCode);
        setName(product.name || '');
        setCategory(product.category || '');
        setPresentation(product.presentation || 'Granel');
        setIsIngredient(product.isIngredient);
        setIsSupply(product.isSupply);
        setIsFinishedProduct(product.isFinishedProduct);
        setInputUnit(
          isProductInputUnit(product.inputUnit)
            ? product.inputUnit
            : product.unitOfMeasure
        );
        setInputUnitQuantity(String(product.inputUnitQuantity ?? 1));
        setCurrentStock(String(product.currentStock ?? 0));
        setExpiryDate(
          product.expirationDate
            ? product.expirationDate.slice(0, 10)
            : ''
        );
        setMinStock(String(product.minStock ?? 0));
        setMaxStock(String(product.maxStock ?? 0));
        setSupplierId(String(product.supplierId));
        setUnitCost(String(product.unitCost ?? 0));

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

    loadData();
  }, [productId, router.isReady]);

  const handleUpdate = async () => {
    const sid = Number(supplierId);
    const quantityPerInputUnit = Number.parseFloat(inputUnitQuantity);

    if (!Number.isFinite(sid)) {
      alert('Proveedor inválido');
      return;
    }
    if (!Number.isFinite(quantityPerInputUnit) || quantityPerInputUnit <= 0) {
      alert('La cantidad por unidad debe ser mayor a 0');
      return;
    }
    if (expiryDate && !isExpirationDateNotBeforeToday(expiryDate)) {
      alert('La fecha de vencimiento no puede ser anterior a la fecha actual.');
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
        unitOfMeasure: normalized.baseUnit,
        inputUnit,
        inputUnitQuantity: quantityPerInputUnit,
        expirationDate: expiryDate
          ? new Date(expiryDate).toISOString()
          : null,
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

  return (
    <DashboardLayout>

      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Editar producto
      </h1>

      {loading && (
        <div className="text-center py-10">Cargando...</div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Input label="Código interno" value={internalCode} disabled />

            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="md:col-span-2" />

            <Input label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input label="Presentación" value={presentation} onChange={(e) => setPresentation(e.target.value)} />

            <div>
              <label className="block text-sm mb-1">Unidad ingresada</label>
              <select
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value as ProductInputUnit)}
                className="w-full border rounded-md p-2"
              >
                {PRODUCT_INPUT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Cantidad por unidad ingresada"
              type="number"
              min="0.0001"
              step="any"
              value={inputUnitQuantity}
              onChange={(e) => setInputUnitQuantity(e.target.value)}
            />
            <Input
              label="Conversión automática"
              value={`${normalized.factor.toFixed(2)} ${normalized.baseUnit}`}
              disabled
              className="md:col-span-2 bg-gray-100"
            />
            <Input
              label="Fecha de vencimiento"
              type="date"
              min={todayLocalDateInputValue()}
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />

            <Input label="Stock mínimo" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <Input label="Stock máximo" type="number" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
            <Input label="Stock actual" type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />

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

            <Input label="Costo unitario" type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />

          </div>

          {/* tipo */}
          <div className="mt-4 flex gap-4 flex-wrap">
            <label><input type="checkbox" checked={isIngredient} onChange={(e) => setIsIngredient(e.target.checked)} /> Ingrediente</label>
            <label><input type="checkbox" checked={isSupply} onChange={(e) => setIsSupply(e.target.checked)} /> Insumo</label>
            <label><input type="checkbox" checked={isFinishedProduct} onChange={(e) => setIsFinishedProduct(e.target.checked)} /> Producto terminado</label>
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