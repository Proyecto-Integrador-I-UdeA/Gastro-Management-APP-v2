"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  isIngredient: boolean;
  unitCost: number;
  inputUnitQuantity: number;
  caloriesPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  proteinPer100g?: number;
  sodiumPer100g?: number;
  sugarPer100g?: number;
};

type RecipeItem = {
  itemType: "product" | "recipe";
  productId?: number | string;
  subRecipeId?: number | string;
  quantity: number;
};





export default function CreateRecipePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [portions, setPortions] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [items, setItems] = useState<RecipeItem[]>([]);

  const LIMITS = {
    costPerPortion: { warning: 8000, danger: 12000 },
    calories: { warning: 700, danger: 900 },
    sodium: { warning: 700, danger: 1000 },
    sugar: { warning: 15, danger: 20 },
  };

  const getStatus = (
    value: number,
    { warning, danger }: { warning: number; danger: number }
  ) => {
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
      const list = Array.isArray(data) ? data : [];

      setProducts(
        list.filter((p: Product) => p.isIngredient)
      );
    } catch (error) {
      console.error(error);
      showError("No se pudieron cargar los ingredientes");
    }
  };

  const fetchRecipes = async () => {
  try {
    const data = await apiFetch("/recipes");
    const list = Array.isArray(data) ? data : [];

    setRecipes(list);
  } catch (error) {
    console.error(error);
    showError("No se pudieron cargar recetas");
  }
};

  useEffect(() => {
    fetchProducts();
    fetchRecipes();
  }, []);

  const addItem = () => {
  setItems([
    ...items,
    {
      itemType: "product",
      productId: "",
      subRecipeId: "",
      quantity: 0,
    },
  ]);
}; 

  const handleItemChange = (
    index: number,
    field: keyof RecipeItem,
    value: string | number
  ) => {
    const updated = [...items];
    updated[index][field] = value as never;
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
  if (!items.length) {
    return {
      totalCost: 0,
      costPerPortion: 0,
      caloriesPerPortion: 0,
      fatPerPortion: 0,
      carbsPerPortion: 0,
      proteinPerPortion: 0,
      sodiumPerPortion: 0,
      sugarPerPortion: 0,
      macroPercentages: {
        fat: 0,
        carbs: 0,
        protein: 0,
      },
       macroDominance: "BALANCED",
       nutritionRole: "BALANCED",
       costClassification: "UNCLASSIFIED",
      nutritionScore: 100,
      alerts: [],
    };
  }

  let totalCost = 0;
  let totalCalories = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalSodium = 0;
  let totalSugar = 0;

  const detailed = items.map((item) => {
    // PRODUCTO
    if (item.itemType === "product") {
      const product = products.find(
        (p) => p.id === Number(item.productId)
      );

      if (!product) {
        return {
          cost: 0,
          itemName: "",
        };
      }

      const quantity = Number(item.quantity || 0);
      const costPerUnit = Number(product.unitCost || 0);
      const cost = costPerUnit * quantity;

      totalCost += cost;

      const calories =
        ((product.caloriesPer100g || 0) * quantity) / 100;

      const fat =
        ((product.fatPer100g || 0) * quantity) / 100;

      const carbs =
        ((product.carbsPer100g || 0) * quantity) / 100;

      const protein =
        ((product.proteinPer100g || 0) * quantity) / 100;

      const sodium =
        ((product.sodiumPer100g || 0) * quantity) / 100;

      const sugar =
        ((product.sugarPer100g || 0) * quantity) / 100;

      totalCalories += calories;
      totalFat += fat;
      totalCarbs += carbs;
      totalProtein += protein;
      totalSodium += sodium;
      totalSugar += sugar;

      return {
        cost,
        itemName: product.name,
      };
    }

    // SUB-RECETA
    if (item.itemType === "recipe") {
      const recipe = recipes.find(
        (r) => r.id === Number(item.subRecipeId)
      );

      if (!recipe) {
        return {
          cost: 0,
          itemName: "",
        };
      }

      const quantity = Number(item.quantity || 0);
      const costPerPortion =
  Number(recipe.totalCost || 0) /
  Math.max(Number(recipe.portions || 1), 1);

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

      return {
        cost,
        itemName: recipe.name,
      };
    }

    return {
      cost: 0,
      itemName: "",
    };
  });

  const safePortions = portions > 0 ? portions : 1;

  const costPerPortion = totalCost / safePortions;
  const caloriesPerPortion =
    totalCalories / safePortions;
  const fatPerPortion = totalFat / safePortions;
  const carbsPerPortion = totalCarbs / safePortions;
  const proteinPerPortion =
    totalProtein / safePortions;
  const sodiumPerPortion =
    totalSodium / safePortions;
  const sugarPerPortion =
    totalSugar / safePortions;

  const fatCalories = fatPerPortion * 9;
  const carbCalories = carbsPerPortion * 4;
  const proteinCalories = proteinPerPortion * 4;

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

  let nutritionRole = "BALANCED";
let macroDominance = "BALANCED";
let costClassification = "UNCLASSIFIED";

// clasificación funcional
if (
  macroPercentages.carbs >= 45 &&
  macroPercentages.carbs >= macroPercentages.protein
) {
  nutritionRole = "CARB_BASE";
  macroDominance =
    macroPercentages.fat > macroPercentages.carbs
      ? "FAT"
      : "CARBS";
}

else if (
  macroPercentages.protein >= 25 &&
  macroPercentages.protein >= macroPercentages.carbs
) {
  nutritionRole = "PROTEIN_BASE";
  macroDominance =
    macroPercentages.fat > macroPercentages.protein
      ? "FAT"
      : "PROTEIN";
}

else if (
  macroPercentages.fat >= 60 &&
  macroPercentages.carbs < 20 &&
  macroPercentages.protein < 20
) {
  nutritionRole = "FAT_BASE";
  macroDominance = "FAT";
}

// clasificación costo
if (nutritionRole === "CARB_BASE") {
  if (costPerPortion <= 7000) {
    costClassification = "LOW";
  } else if (costPerPortion <= 12000) {
    costClassification = "MEDIUM";
  } else {
    costClassification = "HIGH";
  }
}

else if (nutritionRole === "PROTEIN_BASE") {
  if (costPerPortion <= 12000) {
    costClassification = "MEDIUM";
  } else if (costPerPortion <= 20000) {
    costClassification = "HIGH";
  } else {
    costClassification = "PREMIUM";
  }
}

else if (nutritionRole === "FAT_BASE") {
  if (costPerPortion <= 10000) {
    costClassification = "MEDIUM";
  } else {
    costClassification = "HIGH";
  }
}

const alerts: string[] = [];

if (nutritionRole === "CARB_BASE") {
  if (caloriesPerPortion > 500) {
    alerts.push(
      "Calorías elevadas para acompañamiento carbohidrato"
    );
  }

  if (macroPercentages.fat > 30) {
    alerts.push(
      "Exceso de grasa para base carbohidrato"
    );
  }

  if (sodiumPerPortion > 700) {
    alerts.push("Sodio elevado para acompañamiento");
  }

  if (costPerPortion > 7000) {
    alerts.push("Costo alto para base carbohidrato");
  }
}

else if (nutritionRole === "PROTEIN_BASE") {
  if (macroPercentages.protein < 30) {
    alerts.push(
      "Proteína insuficiente para proteína principal"
    );
  }

  if (caloriesPerPortion > 700) {
    alerts.push("Carga calórica elevada");
  }

  if (macroPercentages.fat > 45) {
    alerts.push(
      "Exceso de grasa en proteína principal"
    );
  }

  if (sodiumPerPortion > 900) {
    alerts.push("Sodio elevado");
  }

  if (costPerPortion > 15000) {
    alerts.push("Costo premium");
  }
}

else if (nutritionRole === "FAT_BASE") {
  if (caloriesPerPortion > 600) {
    alerts.push("Densidad calórica muy alta");
  }

  if (sodiumPerPortion > 800) {
    alerts.push("Sodio elevado");
  }

  if (sugarPerPortion > 15) {
    alerts.push("Azúcar elevada");
  }
}

else {
  if (caloriesPerPortion > 650) {
    alerts.push("Carga calórica elevada");
  }

  if (sodiumPerPortion > 850) {
    alerts.push("Sodio elevado");
  }

  if (sugarPerPortion > 20) {
    alerts.push("Azúcar elevada");
  }
}

let nutritionScore = 100 - alerts.length * 8;

  if (nutritionScore < 0) {
    nutritionScore = 0;
  }

  return {
    totalCost,
    costPerPortion,
    caloriesPerPortion,
    fatPerPortion,
    carbsPerPortion,
    proteinPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    macroPercentages,
    macroDominance,
    nutritionRole,
    costClassification,
    nutritionScore,
    alerts,
  };
}, [items, products, recipes, portions]);
 
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
  
  const costStatus = getStatus(
  analytics.costPerPortion,
  LIMITS.costPerPortion
);

const caloriesStatus = getStatus(
  analytics.caloriesPerPortion,
  LIMITS.calories
);

const fatStatus = getStatus(
  analytics.fatPerPortion,
  { warning: 25, danger: 35 }
);

const sodiumStatus = getStatus(
  analytics.sodiumPerPortion,
  LIMITS.sodium
);

const sugarStatus = getStatus(
  analytics.sugarPerPortion,
  LIMITS.sugar
);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-0">
        Crear Receta
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* FORMULARIO */}
        <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-1 space-y-4
        ">
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
         <div className="flex justify-between items-center mt-4">
         <Button type="button" onClick={addItem}>
    + Ingrediente
      </Button>
   
      <Button onClick={handleSubmit}>
         Guardar Receta
      </Button>
      </div>

          {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">
  <select
    value={item.itemType}
    onChange={(e) => {
      handleItemChange(
        index,
        "itemType",
        e.target.value as "product" | "recipe"
      );

      handleItemChange(index, "productId", "");
      handleItemChange(index, "subRecipeId", "");
    }}
    className="border p-2 rounded w-1/4"
  >
    <option value="product">Ingrediente</option>
    <option value="recipe">Sub-receta</option>
  </select>

  {item.itemType === "product" ? (
    <select
      value={item.productId || ""}
      onChange={(e) =>
        handleItemChange(
          index,
          "productId",
          Number(e.target.value)
        )
      }
      className="border p-2 rounded w-2/4"
    >
      <option value="">
        Seleccionar ingrediente
      </option>

      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  ) : (
    <select
      value={item.subRecipeId || ""}
      onChange={(e) =>
        handleItemChange(
          index,
          "subRecipeId",
          Number(e.target.value)
        )
      }
      className="border p-2 rounded w-2/4"
    >
      <option value="">
        Seleccionar sub-receta
      </option>

      {recipes.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  )}

  <input
    type="number"
    className="border p-2 rounded w-1/4 text-right"
    value={item.quantity}
    onChange={(e) =>
      handleItemChange(
        index,
        "quantity",
        Number(e.target.value)
      )
    }
    placeholder={
      item.itemType === "product"
        ? "Cantidad (g/ml)"
        : "Porciones"
    }
  />
</div>
         
            
          ))}
        </div>

        {/* PANEL INTELIGENTE */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex justify-between">
            <span>Costo / porción</span>
            <span className={`${getColorClass(costStatus)} font-bold`}>
              {formatCurrency(analytics.costPerPortion)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Calorías</span>
            <span className={`${getColorClass(caloriesStatus)} font-bold`}>
              {analytics.caloriesPerPortion.toFixed(0)} kcal
            </span>
          </div>

          <div className="flex justify-between">
            <span>Proteína</span>
            <span className="text-green-300 font-bold">
              {analytics.proteinPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Carbohidratos</span>
             <span className="text-green-300 font-bold">
              {analytics.carbsPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Grasas</span>
            <span className={`${getColorClass(fatStatus)} font-bold`}>
              {analytics.fatPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Sodio</span>
            <span className={`${getColorClass(sodiumStatus)} font-bold`}>
              {analytics.sodiumPerPortion.toFixed(0)} mg
            </span>
          </div>

          <div className="flex justify-between">
            <span>Azúcar</span>
            <span className={`${getColorClass(sugarStatus)} font-bold`}>
              {analytics.sugarPerPortion.toFixed(1)} g
            </span>
          </div>

          <hr className="border-white/20" />

<div>
  <h3 className="font-semibold mb-3">
    Clasificación nutricional
  </h3>

  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Macro dominante</span>
      <span className="font-bold text-blue-300">
        {analytics.macroDominance === "CARBS"
          ? "Carbohidratos"
          : analytics.macroDominance === "PROTEIN"
          ? "Proteína"
          : analytics.macroDominance === "FAT"
          ? "Grasas"
          : "Balanceado"}
      </span>
    </div>

    <div className="flex justify-between">
      <span>Rol nutricional</span>
      <span className="font-bold text-green-300">
        {analytics.nutritionRole === "CARB_BASE"
          ? "Base de carbohidratos"
          : analytics.nutritionRole === "PROTEIN_BASE"
          ? "Proteína principal"
          : analytics.nutritionRole === "FAT_BASE"
          ? "Base grasa"
          : "Balanceado"}
      </span>
    </div>

    <div className="flex justify-between">
      <span>Clasificación costo</span>
      <span className="font-bold text-yellow-300">
        {analytics.costClassification === "LOW"
          ? "Bajo"
          : analytics.costClassification === "MEDIUM"
          ? "Medio"
          : analytics.costClassification === "HIGH"
          ? "Alto"
          : analytics.costClassification === "PREMIUM"
          ? "Premium"
          : "Sin clasificar"}
      </span>
    </div>
  </div>
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