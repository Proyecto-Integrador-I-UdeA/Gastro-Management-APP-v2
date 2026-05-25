"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { apiFetch } from "@/lib/api";

export default function EditMenuItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hasDrink, setHasDrink] = useState(false);
  const [hasDessert, setHasDessert] = useState(false);
  const [active, setActive] = useState(true);

  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
  

    const fetchData = async () => {
      try {
        const menuItem = await apiFetch(`/menu-items/${id}`);
        const productsData = await apiFetch("/products");
        const recipesData = await apiFetch("/recipes");

        console.log("MENU ITEM EDIT:", menuItem);

        setName(menuItem.name || "");
        setDescription(menuItem.description || "");
        setHasDrink(menuItem.hasDrink || false);
        setHasDessert(menuItem.hasDessert || false);
        setActive(menuItem.active ?? true);

        setComponents(
          (menuItem.components || []).map((c: any) => ({
            productId: c.productId ?? null,
            recipeId: c.recipeId ?? null,
            quantity: c.quantity || 1,
          }))
        );

        setProducts(
          Array.isArray(productsData)
            ? productsData.filter((p: any) => p.active)
            : []
        );

        setRecipes(
          Array.isArray(recipesData)
            ? recipesData.filter((r: any) => r.active)
            : []
        );
      } catch (error) {
        console.error("ERROR CARGANDO PLATO:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const addComponent = () => {
    setComponents([
      ...components,
      {
        productId: null,
        recipeId: null,
        quantity: 1,
      },
    ]);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_: any, i: number) => i !== index));
  };
const handleSubmit = async () => {
  try {
    await apiFetch(`/menu-items/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        description,
        hasDrink,
        hasDessert,
        active,
        components,

        totalCost: analytics.cost,
        caloriesPerPortion: analytics.calories,
        proteinPerPortion: analytics.protein,
        carbsPerPortion: analytics.carbs,
        fatPerPortion: analytics.fat,
        sodiumPerPortion: analytics.sodium,
        sugarPerPortion: analytics.sugar,
        nutritionScore: analytics.nutritionScore,
      }),
    });

    router.push("/menu");
  } catch (error) {
    console.error("ERROR GUARDANDO:", error);
  }
};
const analytics = useMemo(() => {
  let totalCost = 0;
  let totalCalories = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalSodium = 0;
  let totalSugar = 0;

  let proteinComponents = 0;
  let carbComponents = 0;
  let fatComponents = 0;
  let vegetableComponents = 0;

  const detailed: any[] = [];

  components.forEach((item) => {
    const quantity = Number(item.quantity || 0);

    // RECETA
    if (item.recipeId) {
      const recipe = recipes.find(
        (r) => r.id === Number(item.recipeId)
      );

      if (!recipe) return;

      if (recipe.nutritionRole === "PROTEIN_BASE") {
        proteinComponents++;
      } else if (recipe.nutritionRole === "CARB_BASE") {
        carbComponents++;
      } else if (recipe.nutritionRole === "FAT_BASE") {
        fatComponents++;
      } else if (recipe.nutritionRole === "VEGETABLE_BASE") {
        vegetableComponents++;
      }

      const recipePortions = Number(recipe.portions || 1);

      const costPerPortion =
        recipePortions > 0
          ? Number(recipe.totalCost || 0) / recipePortions
          : 0;

      const cost = costPerPortion * quantity;

      totalCost += cost;
      totalCalories +=
        Number(recipe.caloriesPerPortion || 0) * quantity;
      totalFat +=
        Number(recipe.fatPerPortion || 0) * quantity;
      totalCarbs +=
        Number(recipe.carbsPerPortion || 0) * quantity;
      totalProtein +=
        Number(recipe.proteinPerPortion || 0) * quantity;
      totalSodium +=
        Number(recipe.sodiumPerPortion || 0) * quantity;
      totalSugar +=
        Number(recipe.sugarPerPortion || 0) * quantity;

      detailed.push({
        name: recipe.name,
        cost,
      });
    }

    // INGREDIENTE DIRECTO
    if (item.productId) {
      const product = products.find(
        (p) => p.id === Number(item.productId)
      );

      if (!product) return;

      const productName = String(
        product.name || ""
      ).toLowerCase();

      const vegetableKeywords = [
        "tomate",
        "cebolla",
        "lechuga",
        "zanahoria",
        "pepino",
        "espinaca",
        "brócoli",
        "brocoli",
        "coliflor",
        "repollo",
        "pimentón",
        "pimenton",
        "apio",
        "ajo",
        "berenjena",
        "calabacín",
        "calabacin",
        "champiñón",
        "champiñon",
        "setas",
        "vegetal",
        "verdura",
      ];

      const isVegetable = vegetableKeywords.some((k) =>
        productName.includes(k)
      );

      if (isVegetable) {
        vegetableComponents++;
      } else {
        const productProtein = Number(
          product.proteinPer100g || 0
        );

        const productCarbs = Number(
          product.carbsPer100g || 0
        );

        const productFat = Number(
          product.fatPer100g || 0
        );

        if (
          productProtein > productCarbs &&
          productProtein > productFat
        ) {
          proteinComponents++;
        } else if (
          productCarbs > productProtein &&
          productCarbs > productFat
        ) {
          carbComponents++;
        } else if (
          productFat > productProtein &&
          productFat > productCarbs
        ) {
          fatComponents++;
        }
      }

      const factor = quantity / 100;

      const costPerUnit =
        product.inputUnitQuantity > 0
          ? Number(product.unitCost || 0) /
            Number(product.inputUnitQuantity || 1)
          : 0;

      const cost = costPerUnit * quantity;

      totalCost += cost;
      totalCalories +=
        Number(product.caloriesPer100g || 0) * factor;
      totalFat +=
        Number(product.fatPer100g || 0) * factor;
      totalCarbs +=
        Number(product.carbsPer100g || 0) * factor;
      totalProtein +=
        Number(product.proteinPer100g || 0) * factor;
      totalSodium +=
        Number(product.sodiumPer100g || 0) * factor;
      totalSugar +=
        Number(product.sugarPer100g || 0) * factor;

      detailed.push({
        name: product.name,
        cost,
      });
    }
  });

  const fatCalories = totalFat * 9;
  const carbCalories = totalCarbs * 4;
  const proteinCalories = totalProtein * 4;

  const macroEnergyTotal =
    fatCalories + carbCalories + proteinCalories;

  const macroPercentages = {
    fat: macroEnergyTotal
      ? (fatCalories / macroEnergyTotal) * 100
      : 0,
    carbs: macroEnergyTotal
      ? (carbCalories / macroEnergyTotal) * 100
      : 0,
    protein: macroEnergyTotal
      ? (proteinCalories / macroEnergyTotal) * 100
      : 0,
  };

  const alerts: string[] = [];

  if (proteinComponents === 0 && components.length > 0) {
    alerts.push("Falta proteína principal");
  }

  if (vegetableComponents === 0 && components.length > 0) {
    alerts.push("Sin componente vegetal");
  }

  if (
    carbComponents >= 2 &&
    proteinComponents === 0
  ) {
    alerts.push("Exceso de componentes carbohidrato");
  }

  if (totalSodium > 1000) {
    alerts.push("Carga alta de sodio");
  }

  if (macroPercentages.fat > 55) {
    alerts.push("Exceso de grasas");
  }

  let nutritionScore = 100 - alerts.length * 8;

  if (nutritionScore < 0) {
    nutritionScore = 0;
  }

  return {
    cost: totalCost,
    calories: totalCalories,
    fat: totalFat,
    carbs: totalCarbs,
    protein: totalProtein,
    sodium: totalSodium,
    sugar: totalSugar,
    macroPercentages,
    nutritionScore,
    alerts,
  };
}, [components, products, recipes]);
  
      
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value || 0);

  if (!id || loading) {
    return <div>Cargando...</div>;
  }

 return (
  <DashboardLayout>
    <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
      Editar Plato
    </h1>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* FORMULARIO */}
      <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-6">
        <input
          className="w-full border p-3 rounded-xl"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del plato"
        />

        <textarea
          className="w-full border p-3 rounded-xl"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción"
          rows={3}
        />

        <div className="  flex gap-6">
          <label className="flex items-center gap-2">
            <input  className="accent-[#001F3F] w-4 h-4"
              type="checkbox"
      
              checked={hasDrink}
              onChange={(e) => setHasDrink(e.target.checked)}
            />
            Incluye bebida
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[#001F3F] w-4 h-4"
              checked={hasDessert}
              onChange={(e) => setHasDessert(e.target.checked)}
            />
            Incluye postre
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[#001F3F] w-4 h-4"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Activo
          </label>
        </div>

        {/* COMPONENTES */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Componentes del plato
          </h3>

          <div className="space-y-3">
            {components.map((item, index) => (
              <div key={index} className="flex gap-2 items-center">
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
                      updated[index].productId = Number(
                        value.replace("product-", "")
                      );
                      updated[index].recipeId = null;
                    } else if (value.startsWith("recipe-")) {
                      updated[index].recipeId = Number(
                        value.replace("recipe-", "")
                      );
                      updated[index].productId = null;
                    }

                    setComponents(updated);
                  }}
                >
                  <option value="">Seleccionar componente</option>

                  {products.map((p) => (
                    <option key={p.id} value={`product-${p.id}`}>
                      🧂 {p.name}
                    </option>
                  ))}

                  {recipes.map((r) => (
                    <option key={r.id} value={`recipe-${r.id}`}>
                      🍳 {r.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  className="border p-2 rounded w-1/3 text-right"
                  value={item.quantity}
                  onChange={(e) => {
                    const updated = [...components];
                    updated[index].quantity = Number(e.target.value);
                    setComponents(updated);
                  }}
                  placeholder="Cantidad"
                />

                <button
                  onClick={() => removeComponent(index)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* BOTONES */}
          <div className="flex justify-between mt-6">
            <button
              onClick={addComponent}
            className="px-5 py-2 bg-[#001F3F] hover:bg-[#003366] text-white rounded-xl font-semibold"
            >
              + Agregar componente
            </button>

            <Button onClick={handleSubmit}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>

      {/* PANEL INTELIGENTE */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex justify-between">
          <span>Costo del plato</span>
          <span className="font-bold text-green-300">
            {formatCurrency(analytics.cost)}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Calorías</span>
          <span className="font-bold">
            {analytics.calories.toFixed(0)} kcal
          </span>
        </div>

        <div className="flex justify-between">
          <span>Proteína</span>
          <span className="font-bold text-green-300">
            {analytics.protein.toFixed(1)} g
          </span>
        </div>

        <div className="flex justify-between">
          <span>Carbohidratos</span>
          <span className="font-bold text-blue-300">
            {analytics.carbs.toFixed(1)} g
          </span>
        </div>

        <div className="flex justify-between">
          <span>Grasas</span>
          <span className="font-bold">
            {analytics.fat.toFixed(1)} g
          </span>
        </div>

        <div className="flex justify-between">
          <span>Sodio</span>
          <span className="font-bold">
            {analytics.sodium.toFixed(0)} mg
          </span>
        </div>

        <div className="flex justify-between">
          <span>Azúcar</span>
          <span className="font-bold">
            {analytics.sugar.toFixed(1)} g
          </span>
        </div>

    <hr className="border-white/20" />

<div>
  <h3 className="font-semibold mb-3">
    Balance energético
  </h3>

  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Proteína</span>
      <span>
        {analytics.macroPercentages.protein.toFixed(1)}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Carbohidratos</span>
      <span>
        {analytics.macroPercentages.carbs.toFixed(1)}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Grasas</span>
      <span>
        {analytics.macroPercentages.fat.toFixed(1)}%
      </span>
    </div>
  </div>
</div>

<hr className="border-white/20" />

<div className="flex justify-between items-center">
  <span>Score nutricional</span>
  <span className="text-xl font-bold text-green-300">
    {analytics.nutritionScore}/100
  </span>
</div>

{analytics.alerts.length > 0 && (
  <div className="bg-yellow-500/10 border border-yellow-400/30 p-3 rounded text-sm space-y-2">
    {analytics.alerts.map((a: string, i: number) => (
      <div key={i}>⚠️ {a}</div>
    ))}
  </div>
)}
</div>
  </div>
  </DashboardLayout>
)}