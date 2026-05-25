'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ProductUnitFields from '@/components/ProductUnitFields';
import { ROUTES } from '@/constants/routes';
import { createProductRequest } from '@/lib/productsApi';
import {
  fetchIngredientCatalog,
  createIngredientCatalogItem,
  type IngredientCatalogItem,
} from '@/lib/ingredientCatalogApi';
import { fetchSuppliers } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import type { ProductSupplier } from '@/types/product';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  coerceInputUnitForBase,
} from '@/lib/productUnits';
import { showError } from '@/utils/toast';

export default function ProductCreatePage() {
  useAuthGuard('products.create');
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('');
  const [isIngredient, setIsIngredient] = useState(true);
  const [isSupply, setIsSupply] = useState(false);
  const [isFinishedProduct, setIsFinishedProduct] = useState(false);

const [catalogItems, setCatalogItems] = useState<IngredientCatalogItem[]>([]);
const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
const [selectedCatalogItem, setSelectedCatalogItem] =
  useState<IngredientCatalogItem | null>(null);

const [catalogSearch, setCatalogSearch] = useState('');
const [showCatalogResults, setShowCatalogResults] = useState(false);



const [showCreateCatalog, setShowCreateCatalog] = useState(false);

const [newCatalogName, setNewCatalogName] = useState('');
const [newCatalogCategory, setNewCatalogCategory] = useState('');

const [newCalories, setNewCalories] = useState('');
const [newCarbs, setNewCarbs] = useState('');
const [newFat, setNewFat] = useState('');
const [newProtein, setNewProtein] = useState('');
const [newSugar, setNewSugar] = useState('');
const [newSodium, setNewSodium] = useState('');

  const [baseUnit, setBaseUnit] = useState<ProductBaseUnit>('g');
  const [inputUnit, setInputUnit] = useState<ProductInputUnit>('kg');
  const [inputUnitQuantity, setInputUnitQuantity] = useState('1');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const filteredCatalogItems = catalogItems.filter((item) =>
  item.name.toLowerCase().includes(catalogSearch.toLowerCase())
);

  useEffect(() => {
    setInputUnit((prev) => coerceInputUnitForBase(baseUnit, prev));
  }, [baseUnit]);

  useEffect(() => {
  let cancelled = false;

  async function loadData() {
    setLoadingSuppliers(true);
    setSupplierError(null);

    try {
      const [supplierList, catalogList] = await Promise.all([
        fetchSuppliers(),
        fetchIngredientCatalog(),
      ]);
      console.log("CATALOGO NUTRICIONAL:", catalogList);
      if (!cancelled) {
        setSuppliers(supplierList);
        setCatalogItems(catalogList);

        if (supplierList.length === 1) {
          setSupplierId(String(supplierList[0].id));
        }
      }
    } catch (e) {
      if (!cancelled) {
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }

        setSupplierError(
          getApiErrorMessage(
            e,
            'No se pudieron cargar proveedores o catálogo nutricional'
          )
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingSuppliers(false);
      }
    }
  }

  loadData();

  return () => {
    cancelled = true;
  };
}, [router]); 

async function handleCreateCatalogItem() {
  try {
    const created = await createIngredientCatalogItem({
      name: newCatalogName,
      category: newCatalogCategory,
      caloriesPer100g: Number(newCalories),
      carbsPer100g: Number(newCarbs),
      fatPer100g: Number(newFat),
      proteinPer100g: Number(newProtein),
      sugarPer100g: Number(newSugar),
      sodiumPer100g: Number(newSodium),
    });

    setCatalogItems((prev) => [...prev, created]);
    setSelectedCatalogId(created.id);
    setSelectedCatalogItem(created);

    setShowCreateCatalog(false);

    setNewCatalogName('');
    setNewCatalogCategory('');
    setNewCalories('');
    setNewCarbs('');
    setNewFat('');
    setNewProtein('');
    setNewSugar('');
    setNewSodium('');
  } catch (error) {
    console.error(error);
    alert('No se pudo crear ingrediente nutricional');
  }
}

  const handleSave = async () => {
    if (
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

    const minN = parseFloat(minStock.replace(',', '.'));
    const maxN = parseFloat(maxStock.replace(',', '.'));
    if (!Number.isFinite(minN) || !Number.isFinite(maxN)) {
      alert('Stock mínimo y máximo deben ser números válidos');
      return;
    }
    if (minN > maxN) {
      showError('El stock mínimo no puede ser mayor que el stock máximo.');
      return;
    }

    setSubmitting(true);

    try {
    await createProductRequest({
  name,
  category,

  isIngredient,
  isSupply,
  isFinishedProduct,

  presentation,

  unitOfMeasure: baseUnit,
  inputUnit,
  inputUnitQuantity: iuq,

  minStock: minN,
  maxStock: maxN,

  supplierId: sid,
  unitCost,

  catalogId: selectedCatalogId,

  caloriesPer100g:
    selectedCatalogItem?.caloriesPer100g ?? undefined,

  carbsPer100g:
    selectedCatalogItem?.carbsPer100g ?? undefined,

  fatPer100g:
    selectedCatalogItem?.fatPer100g ?? undefined,

  proteinPer100g:
    selectedCatalogItem?.proteinPer100g ?? undefined,

  sugarPer100g:
    selectedCatalogItem?.sugarPer100g ?? undefined,

  sodiumPer100g:
    selectedCatalogItem?.sodiumPer100g ?? undefined,
});
    

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
        <div className="text-center py-10">Cargando proveedores...</div>
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

            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:col-span-2"
            />

            <Input
              label="Categoría"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />

            <Input
              label="Presentación"
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
            />

            <ProductUnitFields
              baseUnit={baseUnit}
              onBaseUnitChange={setBaseUnit}
              inputUnit={inputUnit}
              onInputUnitChange={setInputUnit}
              inputUnitQuantity={inputUnitQuantity}
              onInputUnitQuantityChange={setInputUnitQuantity}
            />

            <Input
              label="Stock mínimo"
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />

            <Input
              label="Stock máximo"
              type="number"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
            />
            <div>
            <label>Costo por unidad</label>
            <input
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
            placeholder="Ej: 500"
            />
           </div>

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
              <input
                type="checkbox"
                checked={isIngredient}
                onChange={(e) => setIsIngredient(e.target.checked)}
              />{' '}
              Ingrediente
            </label>
            <label>
              <input
                type="checkbox"
                checked={isSupply}
                onChange={(e) => setIsSupply(e.target.checked)}
              />{' '}
              Insumo
            </label>
            <label>
              <input
                type="checkbox"
                checked={isFinishedProduct}
                onChange={(e) => setIsFinishedProduct(e.target.checked)}
              />{' '}
              Producto terminado
            </label>
          </div>

{isIngredient && (
  <div className="mt-6 bg-gray-50 border rounded-xl p-6">
    <h3 className="text-lg font-semibold mb-4">
      Información nutricional del ingrediente por cada 100g o ml
    </h3>

    <div className="mb-4">
      <label className="block text-sm mb-1">
        Seleccionar ingrediente del catálogo
      </label>

    <div className="relative">
  <input
    type="text"
    value={catalogSearch}
    onChange={(e) => {
      setCatalogSearch(e.target.value);
      setShowCatalogResults(true);

      if (!e.target.value.trim()) {
        setSelectedCatalogId(null);
        setSelectedCatalogItem(null);
      }
    }}
    onFocus={() => setShowCatalogResults(true)}
    placeholder="Escribe para buscar ingrediente..."
    className="w-full border rounded-md p-2"
  />

  {showCatalogResults && catalogSearch.trim() && (
    <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
      {filteredCatalogItems.length > 0 ? (
        filteredCatalogItems.slice(0, 20).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSelectedCatalogId(item.id);
              setSelectedCatalogItem(item);
              setCatalogSearch(item.name);
              setShowCatalogResults(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100"
          >
            {item.name}
          </button>
        ))
      ) : (
        <div className="px-4 py-2 text-gray-500">
          No se encontraron ingredientes
        </div>
      )}
    </div>
  )}
</div>

    </div>
   
   <Button
  type="button"
  variant="primary"
  onClick={() => setShowCreateCatalog(!showCreateCatalog)}
  className="mb-6"
>
  {showCreateCatalog
    ? 'Cerrar creación manual'
    : '+ Crear ingrediente nutricional'}
</Button>

    {showCreateCatalog && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-xl p-4 mb-6 bg-white">
        <input
          placeholder="Nombre"
          value={newCatalogName}
          onChange={(e) => setNewCatalogName(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Categoría"
          value={newCatalogCategory}
          onChange={(e) => setNewCatalogCategory(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Calorías(Kcal /100g)"
          value={newCalories}
          onChange={(e) => setNewCalories(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Carbohidratos(g /100g)"
          value={newCarbs}
          onChange={(e) => setNewCarbs(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Grasas(g /100g)"
          value={newFat}
          onChange={(e) => setNewFat(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Proteína(g /100g)"
          value={newProtein}
          onChange={(e) => setNewProtein(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Azúcares(g /100g)"
          value={newSugar}
          onChange={(e) => setNewSugar(e.target.value)}
          className="border rounded-md p-2"
        />

        <input
          placeholder="Sodio(mg /100g)"
          value={newSodium}
          onChange={(e) => setNewSodium(e.target.value)}
          className="border rounded-md p-2"
        />

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={handleCreateCatalogItem}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Guardar ingrediente nutricional
          </button>
        </div>
      </div>
    )}
{selectedCatalogItem && (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
    <div>
      <strong>Calorías /100g:</strong>{' '}
      {selectedCatalogItem.caloriesPer100g ?? 0} kcal
    </div>

    <div>
      <strong>Carbohidratos /100g:</strong>{' '}
      {selectedCatalogItem.carbsPer100g ?? 0} g
    </div>

    <div>
      <strong>Grasas /100g:</strong>{' '}
      {selectedCatalogItem.fatPer100g ?? 0} g
    </div>

    <div>
      <strong>Proteína /100g:</strong>{' '}
      {selectedCatalogItem.proteinPer100g ?? 0} g
    </div>

    <div>
      <strong>Azúcares /100g:</strong>{' '}
      {selectedCatalogItem.sugarPer100g ?? 0} g
    </div>

    <div>
      <strong>Sodio /100g:</strong>{' '}
      {selectedCatalogItem.sodiumPer100g ?? 0} mg
    </div>
  </div>
)}
  </div>
)}

<div className="flex justify-end gap-4 mt-6">
           
      
            <Button
              variant="secondary"   
              onClick={() => router.push(ROUTES.products.list)}
            >
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