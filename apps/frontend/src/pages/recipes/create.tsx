"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function CreateRecipePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [portions, setPortions] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // 🔥 LIMITES
  const LIMITS = {
    costPerPortion: { warning: 8000, danger: 12000 },
    calories: { warning: 700, danger: 1000 },
    fat: { warning: 35, danger: 50 },
    sodium: { warning: 800, danger: 1200 },
    sugar: { warning: 25, danger: 40 },
  };

  const getStatus = (value: number, { warning, danger }: any) => {
    if (value >= danger) return "danger";
    if (value >= warning) return "warning";
    return "ok";
  };

  const getColorClass = (status: string) => {
    if (status === "danger") return "text-red-400";
    if (status === "warning") return "text-yellow-300";
    return "text-green-400";
  };

  const fetchProducts = async () => {
    try {
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : data.data || [];
      setProducts(list.filter((p: any) => p.isIngredient));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addItem = () => {
    setItems([...items, { productId: "", quantity: 0 }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const analytics = useMemo(() => {
    let totalCost = 0;

    let totalCalories = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalSodium = 0;
    let totalSugar = 0;

    const detailed = items.map((item) => {
      const product = products.find((p) => p.id === Number(item.productId));
      if (!product) return { cost: 0 };

      const quantity = item.quantity || 0;

      const cost = product.unitCost * quantity;
      totalCost += cost;

      totalCalories += ((product.caloriesPer100g || 0) * quantity) / 100;
      totalFat += ((product.fatPer100g || 0) * quantity) / 100;
      totalCarbs += ((product.carbsPer100g || 0) * quantity) / 100;
      totalProtein += ((product.proteinPer100g || 0) * quantity) / 100;
      totalSodium += ((product.sodiumPer100g || 0) * quantity) / 100;
      totalSugar += ((product.sugarPer100g || 0) * quantity) / 100;

      return {
        ...item,
        cost,
        productName: product.name,
      };
    });

    const costPerPortion = portions > 0 ? totalCost / portions : 0;
    const caloriesPerPortion = portions > 0 ? totalCalories / portions : 0;

    const macroTotal = totalFat + totalCarbs + totalProtein;

    const macroPercentages = {
      fat: macroTotal ? (totalFat / macroTotal) * 100 : 0,
      carbs: macroTotal ? (totalCarbs / macroTotal) * 100 : 0,
      protein: macroTotal ? (totalProtein / macroTotal) * 100 : 0,
    };

    const alerts: string[] = [];

    if (costPerPortion > LIMITS.costPerPortion.danger) {
      alerts.push("Costo por porción fuera de rango crítico");
    }

    if (caloriesPerPortion > LIMITS.calories.danger) {
      alerts.push("Calorías excesivas");
    }

    if (macroPercentages.fat > LIMITS.fat.danger) {
      alerts.push("Exceso de grasa");
    }

    if ((totalSodium / portions) > LIMITS.sodium.danger) {
      alerts.push("Alto contenido de sodio");
    }

    if ((totalSugar / portions) > LIMITS.sugar.danger) {
      alerts.push("Exceso de azúcar");
    }

    detailed.forEach((d: any) => {
      if (d.cost / totalCost > 0.4) {
        alerts.push(`"${d.productName}" domina el costo`);
      }
    });

    return {
      totalCost,
      costPerPortion,
      caloriesPerPortion,
      macroPercentages,
      sodiumPerPortion: portions > 0 ? totalSodium / portions : 0,
      sugarPerPortion: portions > 0 ? totalSugar / portions : 0,
      alerts,
    };
  }, [items, products, portions]);

  const handleSubmit = async () => {
    try {
      await apiFetch("/recipes", {
        method: "POST",
        body: JSON.stringify({
          name,
          batchQuantity: 1,
          portions,
          items,
          processes: [],
        }),
      });

      showSuccess("Receta creada correctamente");
      router.push("/recipes");
    } catch (error) {
      console.error(error);
      showError("Error al crear receta");
    }
  };

  const costStatus = getStatus(analytics.costPerPortion, LIMITS.costPerPortion);
  const caloriesStatus = getStatus(analytics.caloriesPerPortion, LIMITS.calories);
  const fatStatus = getStatus(analytics.macroPercentages.fat, LIMITS.fat);
  const sodiumStatus = getStatus(analytics.sodiumPerPortion, LIMITS.sodium);
  const sugarStatus = getStatus(analytics.sugarPerPortion, LIMITS.sugar);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Crear Receta
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* FORMULARIO */}
        <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-6">

          <input
            className="w-full border p-2 rounded"
            placeholder="Nombre de la receta"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="number"
            className="w-full border p-2 rounded"
            value={portions}
            onChange={(e) => setPortions(Number(e.target.value))}
          />

          <button onClick={addItem} className="bg-blue-500 text-white px-4 py-2 rounded">
            + Ingrediente
          </button>

          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select
                value={item.productId || ""}
                onChange={(e) =>
                  handleItemChange(index, "productId", Number(e.target.value))
                }
                className="border p-2 rounded w-1/2"
              >
                <option value="">Seleccionar</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                className="border p-2 rounded w-1/2 text-right"
                value={item.quantity}
                onChange={(e) =>
                  handleItemChange(index, "quantity", Number(e.target.value))
                }
              />
            </div>
          ))}

          <Button onClick={handleSubmit}>
            Guardar Receta
          </Button>
        </div>

        {/* PANEL INTELIGENTE */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">

          {/* COSTO */}
          <div className="flex justify-between items-start">
            <span>Costo por porción</span>
            <div className="text-right">
              <div className={`${getColorClass(costStatus)} font-bold`}>
                {formatCurrency(analytics.costPerPortion)}
              </div>
              <div className="text-xs text-gray-400">
                límite: {formatCurrency(LIMITS.costPerPortion.warning)} - {formatCurrency(LIMITS.costPerPortion.danger)}
              </div>
            </div>
          </div>

          {/* CALORÍAS */}
          <div className="flex justify-between items-start">
            <span>Calorías</span>
            <div className="text-right">
              <div className={`${getColorClass(caloriesStatus)} font-bold`}>
                {analytics.caloriesPerPortion.toFixed(0)} kcal
              </div>
              <div className="text-xs text-gray-400">
                límite: {LIMITS.calories.warning} - {LIMITS.calories.danger}
              </div>
            </div>
          </div>

          {/* GRASA */}
          <div className="flex justify-between items-start">
            <span>Grasa</span>
            <div className="text-right">
              <div className={`${getColorClass(fatStatus)} font-bold`}>
                {analytics.macroPercentages.fat.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">
                límite: {LIMITS.fat.warning}% - {LIMITS.fat.danger}%
              </div>
            </div>
          </div>

          {/* SODIO */}
          <div className="flex justify-between items-start">
            <span>Sodio</span>
            <div className="text-right">
              <div className={`${getColorClass(sodiumStatus)} font-bold`}>
                {analytics.sodiumPerPortion.toFixed(0)} mg
              </div>
              <div className="text-xs text-gray-400">
                límite: {LIMITS.sodium.warning} - {LIMITS.sodium.danger}
              </div>
            </div>
          </div>

          {/* AZÚCAR */}
          <div className="flex justify-between items-start">
            <span>Azúcar</span>
            <div className="text-right">
              <div className={`${getColorClass(sugarStatus)} font-bold`}>
                {analytics.sugarPerPortion.toFixed(0)} g
              </div>
              <div className="text-xs text-gray-400">
                límite: {LIMITS.sugar.warning} - {LIMITS.sugar.danger}
              </div>
            </div>
          </div>

          {/* ALERTAS */}
          {analytics.alerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-400/30 p-3 rounded text-sm">
              {analytics.alerts.map((a, i) => (
                <div key={i}>⚠️ {a}</div>
              ))}
            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
}