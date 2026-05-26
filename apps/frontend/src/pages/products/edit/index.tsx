'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ProductUnitFields from '@/components/ProductUnitFields';
import { ROUTES } from '@/constants/routes';
import {
  createProductRequest,
  fetchProductById,
  updateProductRequest,
} from '@/lib/productsApi';
import { fetchSuppliers, fetchSupplierById } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { showError, showSuccess } from '@/utils/toast';
import { getUserPermissions } from '@/utils/permissions';
import type { ProductSupplier } from '@/types/product';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  type ProductBaseUnit,
  type ProductInputUnit,
  coerceInputUnitForBase,
  isProductInputUnit,
  parseBaseUnitFromStored,
} from '@/lib/productUnits';
import {
  fetchIngredientCatalog,
  createIngredientCatalogItem,
  type IngredientCatalogItem,
} from '@/lib/ingredientCatalogApi';

export default function ProductEditPage() {
  useAuthGuard('products.update');

  const router = useRouter();
  const { id } = router.query;

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
  const [unitCost, setUnitCost] = useState(0);

  const [catalogItems, setCatalogItems] = useState<IngredientCatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(
    null
  );
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<IngredientCatalogItem | null>(null);
    const [caloriesPer100g, setCaloriesPer100g] = useState(0);
    const [carbsPer100g, setCarbsPer100g] = useState(0);
    const [fatPer100g, setFatPer100g] = useState(0);
    const [proteinPer100g, setProteinPer100g] = useState(0);
    const [sugarPer100g, setSugarPer100g] = useState(0);
    const [sodiumPer100g, setSodiumPer100g] = useState(0);

const [isSeedProduct, setIsSeedProduct] = useState(false);

  const [showCreateCatalog, setShowCreateCatalog] = useState(false);

  const [newCatalogName, setNewCatalogName] = useState('');
  const [newCatalogCategory, setNewCatalogCategory] = useState('');

  const [newCalories, setNewCalories] = useState('');
  const [newCarbs, setNewCarbs] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newSugar, setNewSugar] = useState('');
  const [newSodium, setNewSodium] = useState('');

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSupplierId, setDuplicateSupplierId] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [canDuplicateProduct, setCanDuplicateProduct] = useState(false);

  useEffect(() => {
    setCanDuplicateProduct(getUserPermissions().includes('products.create'));
  }, []);

  useEffect(() => {
    setInputUnit((prev) => coerceInputUnitForBase(baseUnit, prev));
  }, [baseUnit]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!id || typeof id !== 'string') {
      setLoading(false);
      setError('ID de producto no válido');
      return;
    }

    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      setLoading(false);
      setError('ID de producto no válido');
      return;
    }

    const loadData = async () => {
      try {
        const product = await fetchProductById(productId);
        console.log("EDIT PRODUCT:", product);
        const catalogList = await fetchIngredientCatalog();
        let supplierList = await fetchSuppliers();

        if (!supplierList.some((s) => s.id === product.supplierId)) {
          const currentSupplier = await fetchSupplierById(product.supplierId);
          supplierList = [...supplierList, currentSupplier];
        }

        setSuppliers(supplierList);
        setCatalogItems(catalogList);

        setInternalCode(product.internalCode || '');
        setName(product.name || '');
        setCategory(product.category || '');
        setPresentation(product.presentation || '');

        setIsIngredient(product.isIngredient);
        setIsSupply(product.isSupply);
        setIsFinishedProduct(product.isFinishedProduct);

        setUnitCost(product.unitCost || 0);
        setCaloriesPer100g(product.caloriesPer100g || 0);
        setCarbsPer100g(product.carbsPer100g || 0);
        setFatPer100g(product.fatPer100g || 0);
        setProteinPer100g(product.proteinPer100g || 0);
        setSugarPer100g(product.sugarPer100g || 0);
        setSodiumPer100g(product.sodiumPer100g || 0);

        setIsSeedProduct(Boolean(product.isSeedProduct));

        const base = parseBaseUnitFromStored(product.unitOfMeasure || 'g');
        setBaseUnit(base);

        const rawIu = product.inputUnit;
        const iu = isProductInputUnit(rawIu) ? rawIu : 'g';

        setInputUnit(coerceInputUnitForBase(base, iu));

        setInputUnitQuantity(String(product.inputUnitQuantity ?? 1));
        setMinStock(String(product.minStock ?? 0));
        setMaxStock(String(product.maxStock ?? 0));
        setSupplierId(String(product.supplierId));

       if (product.catalogId) {
  const selected =
    catalogList.find(
      (item) => item.id === product.catalogId
    ) || null;

  setSelectedCatalogId(product.catalogId);

  setSelectedCatalogItem(
    selected || {
      id: product.catalogId,
      name: product.name,
      category: product.category,
      caloriesPer100g: product.caloriesPer100g ?? 0,
      carbsPer100g: product.carbsPer100g ?? 0,
      fatPer100g: product.fatPer100g ?? 0,
      proteinPer100g: product.proteinPer100g ?? 0,
      sugarPer100g: product.sugarPer100g ?? 0,
      sodiumPer100g: product.sodiumPer100g ?? 0,
    }
  );
}   
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
  }, [id, router, router.isReady]);

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
const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!id || typeof id !== 'string') {
    console.error('❌ ID no disponible:', id);
    return;
  }

  const productId = parseInt(id, 10);

  if (isNaN(productId)) {
    console.error('❌ ID inválido:', productId);
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
      minStock: minN,
      maxStock: maxN,
      supplierId: sid,
      unitCost,

      catalogId: selectedCatalogId,
     caloriesPer100g,
     carbsPer100g,
     fatPer100g,
     proteinPer100g,
     sugarPer100g,
     sodiumPer100g,
     
      
    } as any);

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

const openDuplicateModal = () => {
  const currentSid = Number(supplierId);
  const others = suppliers.filter((s) => s.id !== currentSid);

  if (others.length === 0) {
    showError(
      'No hay otro proveedor disponible. Crea un proveedor nuevo o asigna este producto desde el formulario.'
    );
    return;
  }

  setDuplicateSupplierId(String(others[0].id));
  setDuplicateModalOpen(true);
};

const handleDuplicateProduct = async () => {
  const dupSid = Number(duplicateSupplierId);

  if (!Number.isFinite(dupSid)) {
    showError('Selecciona un proveedor válido.');
    return;
  }

  if (dupSid === Number(supplierId)) {
    showError('Elige un proveedor distinto al actual para el duplicado.');
    return;
  }

  if (!name.trim() || !presentation.trim()) {
    showError('Nombre y presentación son obligatorios para duplicar.');
    return;
  }

  const iuq = parseFloat(inputUnitQuantity.replace(',', '.'));

  if (!Number.isFinite(iuq) || iuq <= 0) {
    showError('La cantidad por unidad ingresada debe ser mayor a cero.');
    return;
  }

  const minN = parseFloat(minStock.replace(',', '.'));
  const maxN = parseFloat(maxStock.replace(',', '.'));

  if (!Number.isFinite(minN) || !Number.isFinite(maxN)) {
    showError('Stock mínimo y máximo deben ser números válidos.');
    return;
  }

  if (minN > maxN) {
    showError('El stock mínimo no puede ser mayor que el stock máximo.');
    return;
  }

  setDuplicating(true);

  try {
    const created = await createProductRequest({
      name: name.trim(),
      category: category || '',
      isIngredient,
      isSupply,
      isFinishedProduct,
      presentation: presentation.trim(),
      unitOfMeasure: baseUnit,
      inputUnit,
      inputUnitQuantity: iuq,
      minStock: minN,
      maxStock: maxN,
      supplierId: dupSid,
      unitCost,

      catalogId: selectedCatalogId,

      caloriesPer100g: selectedCatalogItem?.caloriesPer100g ?? undefined,
      carbsPer100g: selectedCatalogItem?.carbsPer100g ?? undefined,
      fatPer100g: selectedCatalogItem?.fatPer100g ?? undefined,
      proteinPer100g: selectedCatalogItem?.proteinPer100g ?? undefined,
      sugarPer100g: selectedCatalogItem?.sugarPer100g ?? undefined,
      sodiumPer100g: selectedCatalogItem?.sodiumPer100g ?? undefined,
    } as any);

    showSuccess('Producto duplicado. Se asignó un código interno nuevo.');

    setDuplicateModalOpen(false);

    await router.push(ROUTES.products.edit(created.id));
  } catch (e) {
    if (isUnauthorized(e)) {
      router.push('/login');
      return;
    }

    showError(getApiErrorMessage(e, 'No se pudo crear el duplicado'));
  } finally {
    setDuplicating(false);
  }
};
const isProtectedProduct =
  Boolean(selectedCatalogId) || isSeedProduct;

return (
  <DashboardLayout>
    <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
      Editar producto
    </h1>

    {loading && <div className="text-center py-10">Cargando...</div>}

    {error && (
      <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
        {error}
      </div>
    )}

    {!loading && !error && (
      <form
        onSubmit={handleUpdate}
        className="bg-white p-6 rounded-xl shadow-md max-w-4xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Código interno" value={internalCode} disabled />

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

          <Input
            label="Costo por unidad"
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
          />

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
    <h3 className="text-lg font-semibold mb-1">
      Información nutricional del producto
    </h3>

    <p className="text-sm text-gray-600 mb-6">
      Los valores nutricionales se expresan por cada 100 gramos o 100 ml.
    </p>
    {isProtectedProduct && (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        Este producto utiliza información nutricional del catálogo base del
        sistema y no puede modificarse.
      </div>
    )}

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input
    label="Calorías (kcal /100g)"
    type="number"
    value={String(caloriesPer100g)}
  disabled={isProtectedProduct}
  onChange={(e) =>
  setCaloriesPer100g(Number(e.target.value))
}
  />

      <Input
        label="Carbohidratos (g /100g)"
        type="number"
        value={String(carbsPer100g)}
        disabled={isProtectedProduct} 

onChange={(e) =>
  setCarbsPer100g(Number(e.target.value))
}


      />

      <Input
        label="Grasas (g /100g)"
        type="number"
        value={String(fatPer100g)}
        disabled={isProtectedProduct}
      onChange={(e) =>
  setFatPer100g(Number(e.target.value))
}

      />

      <Input
        label="Proteína (g /100g)"
        type="number"
        value={String(proteinPer100g)}
      disabled={isProtectedProduct}
      onChange={(e) =>
  setProteinPer100g(Number(e.target.value))
}
      />

      <Input
        label="Azúcares (g /100g)"
        type="number"
        value={String(sugarPer100g)}
        disabled={isProtectedProduct}
      onChange={(e) =>
  setSugarPer100g(Number(e.target.value))
}
      />

      <Input
        label="Sodio (mg /100g)"
        type="number"
        value={String(sodiumPer100g)}
        disabled={isProtectedProduct}
      onChange={(e) =>
  setSodiumPer100g(Number(e.target.value))
}
      />
    </div>
  </div>
)}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 mt-6">
          <div className="flex flex-wrap gap-3 sm:mr-auto">
            {canDuplicateProduct && (
              <Button
                type="button"
                variant="primary"
                onClick={openDuplicateModal}
              >
                Duplicar producto
              </Button>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.push(ROUTES.products.list)}
            >
              Cancelar
            </Button>

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </form>
    )}

    {duplicateModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-product-title"
        onClick={(e) =>
          e.target === e.currentTarget &&
          setDuplicateModalOpen(false)
        }
      >
        <div
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="duplicate-product-title"
            className="text-lg font-bold text-[#04203b]"
          >
            Duplicar producto
          </h2>

          <p className="text-sm text-gray-600">
            Se creará un producto nuevo con los mismos datos del
            formulario y un código interno nuevo.
          </p>

          <div>
            <label
              htmlFor="duplicate-supplier"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Proveedor del duplicado
            </label>

            <select
              id="duplicate-supplier"
              value={duplicateSupplierId}
              onChange={(e) =>
                setDuplicateSupplierId(e.target.value)
              }
              className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
            >
              {suppliers
                .filter((s) => s.id !== Number(supplierId))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDuplicateModalOpen(false)}
            >
              Cerrar
            </Button>

            <Button
              type="button"
              onClick={() => void handleDuplicateProduct()}
              disabled={duplicating}
            >
              {duplicating ? 'Creando…' : 'Crear duplicado'}
            </Button>
          </div>
        </div>
      </div>
    )}
  </DashboardLayout>
);
}



































































































































 
 
 

 

 

 
 
 
 
 
 
 

 
 
 
 
 
 
 
 

 
 

 
 
 
 
 
 

 
 
 
 
 
 
 
 
 
 
 
 
 

 
 

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
