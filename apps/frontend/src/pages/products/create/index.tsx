'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { createProductRequest } from '@/lib/productsApi';
import { fetchSuppliers } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import {
  isExpirationDateNotBeforeToday,
  todayLocalDateInputValue,
} from '@/utils/expirationDate';
import type { ProductSupplier } from '@/types/product';
import {
  PRODUCT_INPUT_UNITS,
  convertToBaseUnits,
  type ProductInputUnit,
} from '@/lib/productUnitConversion';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { showError, showSuccess } from '@/utils/toast';

export default function ProductCreatePage() {
  useAuthGuard("products.create");
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
  const [inputUnit, setInputUnit] = useState<ProductInputUnit>('kg');
  const [inputUnitQuantity, setInputUnitQuantity] = useState('1');
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
  }, []);

  const handleSave = async () => {
    if (
     // !internalCode ||
      !name ||
      !category ||
      !presentation ||
      !inputUnitQuantity ||
      !minStock ||
      !maxStock ||
      !supplierId ||
      unitCost === ''
    ) {
      showError('Completa todos los campos obligatorios');
      return;
    }

    const sid = Number(supplierId);
    const quantityPerInputUnit = Number.parseFloat(inputUnitQuantity);

    if (!Number.isFinite(sid)) {
      showError('Proveedor inválido');
      return;
    }
    if (!Number.isFinite(quantityPerInputUnit) || quantityPerInputUnit <= 0) {
      showError('La cantidad por unidad debe ser mayor a 0');
      return;
    }
    if (expiryDate && !isExpirationDateNotBeforeToday(expiryDate)) {
      showError('La fecha de vencimiento no puede ser anterior a la fecha actual.');
      return;
    }

    const minStockN = parseFloat(minStock);
    const maxStockN = parseFloat(maxStock);
    const unitCostN = parseFloat(unitCost);
    if (!Number.isFinite(minStockN) || minStockN < 0) {
      showError('El stock mínimo no puede ser negativo.');
      return;
    }
    if (!Number.isFinite(maxStockN) || maxStockN < 0) {
      showError('El stock máximo no puede ser negativo.');
      return;
    }
    if (!Number.isFinite(unitCostN) || unitCostN < 0) {
      showError('El costo unitario no puede ser negativo.');
      return;
    }

    if (!confirm('¿Confirmas que deseas guardar este nuevo producto?')) {
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
        unitOfMeasure: normalized.baseUnit,
        inputUnit,
        inputUnitQuantity: quantityPerInputUnit,
        expirationDate: expiryDate
          ? new Date(expiryDate).toISOString()
          : null,
        minStock: minStockN,
        maxStock: maxStockN,
        currentStock: 0,
        unitCost: unitCostN,
        supplierId: sid,
      });

      showSuccess('El producto se guardó correctamente.');
      router.push(ROUTES.products.list);

    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }

      showError(getApiErrorMessage(e, 'No se pudo crear el producto'));

    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>

      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Nuevo producto
      </h1>

      {loadingSuppliers && (
        <div className="text-center py-10">
          Cargando proveedores...
        </div>
      )}

      {supplierError && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {supplierError}
        </div>
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

          {/*  <Input label="Código interno" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />*/}
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

            <Input
              label="Stock mínimo"
              type="number"
              min="0"
              step="any"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
            <Input
              label="Stock máximo"
              type="number"
              min="0"
              step="any"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
            />

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

            <Input
              label="Costo unitario"
              type="number"
              min="0"
              step="any"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />

          </div>

          {/* tipo producto */}
          <div className="mt-4 flex gap-4 flex-wrap">
            <label><input type="checkbox" checked={isIngredient} onChange={(e) => setIsIngredient(e.target.checked)} /> Ingrediente</label>
            <label><input type="checkbox" checked={isSupply} onChange={(e) => setIsSupply(e.target.checked)} /> Insumo</label>
            <label><input type="checkbox" checked={isFinishedProduct} onChange={(e) => setIsFinishedProduct(e.target.checked)} /> Producto terminado</label>
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