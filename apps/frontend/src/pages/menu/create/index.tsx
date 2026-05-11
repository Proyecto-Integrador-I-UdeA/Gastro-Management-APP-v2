"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function CreateMenuItemPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hasDrink, setHasDrink] = useState(false);
  const [hasDessert, setHasDessert] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  // 🔥 cargar productos y recetas (FILTRANDO ACTIVAS)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsData = await apiFetch("/products");
        const recipesData = await apiFetch("/recipes");

        setProducts(Array.isArray(productsData) ? productsData : []);

        const list = Array.isArray(recipesData) ? recipesData : [];
        setRecipes(list.filter((r: any) => r.active === true));

      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, []);

  const addComponent = () => {
    setComponents([
      ...components,
      { productId: null, recipeId: null, quantity: 1 },
    ]);
  };

  const handleComponentChange = (index: number, field: string, value: any) => {
    const updated = [...components];
    updated[index][field] = value;
    setComponents(updated);
  };

  // 🔥 ANALYTICS INTELIGENTE (PLATOS)
  const analytics = useMemo(() => {
    let totalCost = 0;
    let totalCalories = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalSodium = 0;
    let totalSugar = 0;

    components.forEach((item) => {
      const quantity = item.quantity || 1;

      // PRODUCTOS
      if (item.productId) {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;

        totalCost += (product.unitCost || 0) * quantity;

        totalCalories += ((product.calories || 0) * quantity);
        totalFat += ((product.fat || 0) * quantity);
        totalCarbs += ((product.carbs || 0) * quantity);
        totalProtein += ((product.protein || 0) * quantity);
        totalSodium += ((product.sodium || 0) * quantity);
        totalSugar += ((product.sugar || 0) * quantity);
      }

      // RECETAS
      if (item.recipeId) {
        const recipe = recipes.find(r => r.id === item.recipeId);
        if (!recipe) return;

        const portions = recipe.portions || 1;

        const recipeCost =
          recipe.items?.reduce((sum: number, i: any) => sum + Number(i.totalCost || 0), 0) || 0;

        totalCost += (recipeCost / portions) * quantity;
      }
    });

    const macroTotal = totalFat + totalCarbs + totalProtein;

    return {
      cost: totalCost,
      calories: totalCalories,
      fat: macroTotal ? (totalFat / macroTotal) * 100 : 0,
      carbs: macroTotal ? (totalCarbs / macroTotal) * 100 : 0,
      protein: macroTotal ? (totalProtein / macroTotal) * 100 : 0,
      sodium: totalSodium,
      sugar: totalSugar,
    };

  }, [components, products, recipes]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value || 0);

  const handleSubmit = async () => {
    try {
      await apiFetch("/menu-items", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          hasDrink,
          hasDessert,
          components,
        }),
      });

      showSuccess("Plato creado correctamente");
      router.push("/menu");
    } catch (error) {
      console.error(error);
      showError("Error al crear plato");
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Crear Plato del Menú
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* FORMULARIO */}
        <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-6">

          <input
            className="w-full border p-2 rounded"
            placeholder="Nombre del plato"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full border p-2 rounded"
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex gap-4">
            <label>
              <input
                type="checkbox"
                checked={hasDrink}
                onChange={(e) => setHasDrink(e.target.checked)}
              />{" "}
              Incluye bebida
            </label>

            <label>
              <input
                type="checkbox"
                checked={hasDessert}
                onChange={(e) => setHasDessert(e.target.checked)}
              />{" "}
              Incluye postre
            </label>
          </div>

          {/* COMPONENTES */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Componentes del plato
            </h3>

            <button
              onClick={addComponent}
              className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
            >
              + Agregar componente
            </button>

            {components.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2">

                <select
                  className="border p-2 rounded w-1/2"
                  value={
                    item.productId
                      ? `product-${item.productId}`
                      : item.recipeId
                      ? `recipe-${item.recipeId}`
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    const updated = [...components];

                    if (value.startsWith("product-")) {
                      updated[index].productId = Number(value.replace("product-", ""));
                      updated[index].recipeId = null;
                    } else if (value.startsWith("recipe-")) {
                      updated[index].recipeId = Number(value.replace("recipe-", ""));
                      updated[index].productId = null;
                    }

                    setComponents(updated);
                  }}
                >
                  <option value="">Seleccionar</option>

                  {products.map((p) => (
                    <option key={`product-${p.id}`} value={`product-${p.id}`}>
                      🧂 {p.name}
                    </option>
                  ))}

                  {recipes.map((r) => (
                    <option key={`recipe-${r.id}`} value={`recipe-${r.id}`}>
                      🍳 {r.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  className="border p-2 rounded w-1/2 text-right"
                  value={item.quantity}
                  onChange={(e) =>
                    handleComponentChange(index, "quantity", Number(e.target.value))
                  }
                />
              </div>
            ))}
          </div>

          <Button onClick={handleSubmit}>
            Guardar Plato
          </Button>
        </div>

        {/* 🔥 PANEL INTELIGENTE */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">

          <div className="flex justify-between">
            <span>Costo</span>
            <span className="text-green-400 font-bold text-right">
              {formatCurrency(analytics.cost)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Calorías</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.calories.toFixed(0)} kcal
            </span>
          </div>

          <div className="flex justify-between">
            <span>Grasa</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.fat.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between">
            <span>Carbohidratos</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.carbs.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between">
            <span>Proteína</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.protein.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between">
          
            <span>Sodio</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.sodium.toFixed(0)} mg
            </span>
          </div>

          <div className="flex justify-between">
            <span>Azúcar</span>
            <span className="text-green-400 font-bold text-right">
              {analytics.sugar.toFixed(0)} g
            </span>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}