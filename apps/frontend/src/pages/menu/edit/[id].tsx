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

        console.log("MENU ITEM:", menuItem);

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

        setProducts(productsData || []);
        setRecipes((recipesData || []).filter((r: any) => r.active));

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
      { productId: null, recipeId: null, quantity: 1 },
    ]);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
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

    components.forEach((item) => {
      const quantity = item.quantity || 1;

      if (item.productId) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return;

        totalCost += (product.unitCost || 0) * quantity;
        totalCalories += (product.calories || 0) * quantity;
        totalFat += (product.fat || 0) * quantity;
        totalCarbs += (product.carbs || 0) * quantity;
        totalProtein += (product.protein || 0) * quantity;
        totalSodium += (product.sodium || 0) * quantity;
        totalSugar += (product.sugar || 0) * quantity;
      }

      if (item.recipeId) {
        const recipe = recipes.find((r) => r.id === item.recipeId);
        if (!recipe) return;

        const portions = recipe.portions || 1;
        const recipeCost =
          recipe.items?.reduce(
            (sum: number, i: any) => sum + Number(i.totalCost || 0),
            0
          ) || 0;

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

  if (!id || loading) {
    return <div>Cargando...</div>;
  }

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Editar Plato
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-6">

          <input
            className="w-full border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full border p-2 rounded"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex gap-4">
            <label>
              <input
                type="checkbox"
                checked={hasDrink}
                onChange={(e) => setHasDrink(e.target.checked)}
              />
              Bebida
            </label>

            <label>
              <input
                type="checkbox"
                checked={hasDessert}
                onChange={(e) => setHasDessert(e.target.checked)}
              />
              Postre
            </label>

            <label>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Activo
            </label>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Componentes</h3>

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
                      updated[index].productId = Number(
                        value.replace("product-", "")
                      );
                      updated[index].recipeId = null;
                    } else {
                      updated[index].recipeId = Number(
                        value.replace("recipe-", "")
                      );
                      updated[index].productId = null;
                    }

                    setComponents(updated);
                  }}
                >
                  <option value="">Seleccionar</option>

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
                  className="border p-2 rounded w-1/2 text-right"
                  value={item.quantity}
                  onChange={(e) => {
                    const updated = [...components];
                    updated[index].quantity = Number(e.target.value);
                    setComponents(updated);
                  }}
                />

                <button
                  onClick={() => removeComponent(index)}
                  className="text-red-500"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>

          <Button onClick={handleSubmit}>
            Guardar cambios
          </Button>
        </div>

        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex justify-between">
            <span>Costo</span>
            <span className="text-green-400 font-bold">
              {formatCurrency(analytics.cost)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Calorías</span>
            <span className="text-green-400 font-bold">
              {analytics.calories.toFixed(0)} kcal
            </span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}