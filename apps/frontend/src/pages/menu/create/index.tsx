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

  const detailed: any[] = [];
  let proteinComponents = 0;
let carbComponents = 0;
let vegetableComponents = 0;
let fatComponents = 0;

  components.forEach((item) => {
    const quantity = Number(item.quantity || 1);

    // INGREDIENTE DIRECTO
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

  const quantity = Number(item.quantity || 0);

  const factor = quantity / 100;

  const cost =
    Number(product.costPerUnit || 0) * quantity;

  const calories =
    Number(product.caloriesPer100g || 0) * factor;

  const fat =
    Number(product.fatPer100g || 0) * factor;

  const carbs =
    Number(product.carbsPer100g || 0) * factor;

  const protein =
    Number(product.proteinPer100g || 0) * factor;

  const sodium =
    Number(product.sodiumPer100g || 0) * factor;

  const sugar =
    Number(product.sugarPer100g || 0) * factor;

  totalCost += cost;
  totalCalories += calories;
  totalFat += fat;
  totalCarbs += carbs;
  totalProtein += protein;
  totalSodium += sodium;
  totalSugar += sugar;

  detailed.push({
    name: product.name,
    cost,
  });
}

    // RECETA
    if (item.recipeId) {
    
      const recipe = recipes.find(
        (r) => r.id === Number(item.recipeId)
      );
      console.log(
  "RECIPE ROLE:",
  recipe.name,
  recipe.nutritionRole
);
      
      if (!recipe) return;
      if (recipe.nutritionRole === "PROTEIN_BASE") {
  proteinComponents++;
}

else if (recipe.nutritionRole === "CARB_BASE") {
  carbComponents++;
}

else if (recipe.nutritionRole === "FAT_BASE") {
  fatComponents++;
}

else if (recipe.nutritionRole === "VEGETABLE_BASE") {
  vegetableComponents++;
}

     const recipePortions =
     Number(recipe.portions || 1);

    const costPerPortion =
    recipePortions > 0
    ? Number(recipe.totalCost || 0) / recipePortions
    : 0;

const cost = costPerPortion * quantity;
     

      const calories =
        Number(recipe.caloriesPerPortion || 0) * quantity;

      const fat =
        Number(recipe.fatPerPortion || 0) * quantity;

      const carbs =
        Number(recipe.carbsPerPortion || 0) * quantity;

      const protein =
        Number(recipe.proteinPerPortion || 0) * quantity;

      const sodium =
        Number(recipe.sodiumPerPortion || 0) * quantity;

      const sugar =
        Number(recipe.sugarPerPortion || 0) * quantity;

      totalCost += cost;
      totalCalories += calories;
      totalFat += fat;
      totalCarbs += carbs;
      totalProtein += protein;
      totalSodium += sodium;
      totalSugar += sugar;

      detailed.push({
        name: recipe.name,
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
  console.log("STRUCTURE:", {
  proteinComponents,
  carbComponents,
  vegetableComponents,
  fatComponents,
});
  const alerts: string[] = [];

if (proteinComponents === 0 && components.length > 0) {
  alerts.push("Falta proteína principal");
}

if (carbComponents >= 2 && proteinComponents === 0) {
  alerts.push("Exceso de componentes carbohidrato");
}

if (vegetableComponents === 0 && components.length >= 3) {
  alerts.push("Sin componente vegetal");
}

if (totalCalories > 1000) {
  alerts.push("Carga calórica elevada");
}

if (totalSodium > 900) {
  alerts.push("Carga alta de sodio");
}

if (macroPercentages.carbs > 65) {
  alerts.push("Exceso de carbohidratos");
}

if (macroPercentages.fat > 55) {
  alerts.push("Exceso de grasas");
}

if (totalCost > 30000) {
  alerts.push("Costo elevado para plato");
}

let nutritionScore = 100 - alerts.length * 8;

  if (nutritionScore < 0) {
    nutritionScore = 0;
  }

  return {
    totalCost,
    totalCalories,
    totalFat,
    totalCarbs,
    totalProtein,
    totalSodium,
    totalSugar,
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

        totalCost: analytics.totalCost,
        caloriesPerPortion: analytics.totalCalories,
        proteinPerPortion: analytics.totalProtein,
        carbsPerPortion: analytics.totalCarbs,
        fatPerPortion: analytics.totalFat,
        sodiumPerPortion: analytics.totalSodium,
        sugarPerPortion: analytics.totalSugar,
        nutritionScore: analytics.nutritionScore,
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
 <div className="flex justify-between items-center mb-4">
  <Button
    type="button"
    onClick={addComponent}
  >
    + Agregar componente
  </Button>

  <Button onClick={handleSubmit}>
    Guardar Plato
  </Button>
</div> 
  {components.map((item, index) => {
    const selectedProduct = products.find(
      (p) => p.id === Number(item.productId)
    );

    const selectedRecipe = recipes.find(
      (r) => r.id === Number(item.recipeId)
    );

    return (
      <div
        key={index}
        className="mb-4 border rounded-xl p-4 bg-gray-50"
      >
        <div className="flex gap-2 items-center">
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
              console.log("UPDATED COMPONENT:", updated[index]);
              setComponents(updated);
            }}
          >
            <option value="">
              Seleccionar componente
            </option>

            {products.map((p) => (
              <option
                key={`product-${p.id}`}
                value={`product-${p.id}`}
              >
                🧂 {p.name}
              </option>
            ))}

            {recipes.map((r) => (
              <option
                key={`recipe-${r.id}`}
                value={`recipe-${r.id}`}
              >
                🍳 {r.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            className="border p-2 rounded w-1/4 text-right"
            value={item.quantity}
            onChange={(e) =>
              handleComponentChange(
                index,
                "quantity",
                Number(e.target.value)
              )
            }
          />

          <button
            type="button"
            onClick={() => {
              const updated = components.filter(
                (_: any, i: number) => i !== index
              );
              setComponents(updated);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        {selectedProduct && (
          <p className="text-xs text-gray-500 mt-2">
            Ingrediente directo · unidad:{" "}
            {selectedProduct.unitOfMeasure}
          </p>
        )}

        {selectedRecipe && (
          <p className="text-xs text-gray-500 mt-2">
            Receta preparada · porciones base:{" "}
            {selectedRecipe.portions}
          </p>
        )}
      </div>
    );
  })}
</div>
          
        </div>

 {/* PANEL INTELIGENTE */}
<div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">
  <div className="flex justify-between">
    <span>Costo del plato</span>
    <span className="font-bold text-green-300">
      {formatCurrency(analytics.totalCost)}
    </span>
  </div>

  <div className="flex justify-between">
    <span>Calorías</span>
    <span className="font-bold">
      {analytics.totalCalories.toFixed(0)} kcal
    </span>
  </div>

  <div className="flex justify-between">
    <span>Proteína</span>
    <span className="font-bold text-green-300">
      {analytics.totalProtein.toFixed(1)} g
    </span>
  </div>

  <div className="flex justify-between">
    <span>Carbohidratos</span>
    <span className="font-bold text-blue-300">
      {analytics.totalCarbs.toFixed(1)} g
    </span>
  </div>

  <div className="flex justify-between">
    <span>Grasas</span>
    <span className="font-bold">
      {analytics.totalFat.toFixed(1)} g
    </span>
  </div>

  <div className="flex justify-between">
    <span>Sodio</span>
    <span className="font-bold">
      {analytics.totalSodium.toFixed(0)} mg
    </span>
  </div>

  <div className="flex justify-between">
    <span>Azúcar</span>
    <span className="font-bold">
      {analytics.totalSugar.toFixed(1)} g
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
  );
}