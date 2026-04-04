"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError } from "@/utils/toast";

export default function PriceCalculationPage() {

  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [priceList, setPriceList] = useState<any[]>([]);

  const [margin, setMargin] = useState(0.3);
  const [tax, setTax] = useState(0.19);

  const [price, setPrice] = useState<any>(null);

  // 🔥 cargar recetas
  const fetchRecipes = async () => {
    try {
      const res = await fetch("http://localhost:3001/recipes", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list);

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);
  useEffect(() => {
  if (margin && tax) {
    fetchSuggestedPrices();
  }
}, [margin, tax]);

  // 🔥 obtener costo
  const fetchCost = async () => {
    if (!selectedRecipe) return;

    try {
      const res = await fetch(
        `http://localhost:3001/costs/recipe/${selectedRecipe}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await res.json();
      setCost(data.costPerPortion);

    } catch (error) {
      console.error(error);
    }
  };

  // 🔥 calcular precio
  const handleCalculate = () => {
  if (!cost) return showError("Primero calcula el costo");

  const priceWithoutTax = cost / (1 - margin);
  const finalPrice = priceWithoutTax * (1 + tax);

  const suggested = Math.round(finalPrice / 1000) * 1000;

  setPrice({
    priceWithoutTax,
    finalPrice
  });

  setSuggestedPrice(suggested);
};
const fetchSuggestedPrices = async () => {
  try {
    const res = await fetch("http://localhost:3001/recipes", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();

    const list = Array.isArray(data)
      ? data
      : data.recipes || data.data || [];

    // 🔥 calcular precio para cada receta
    const results = await Promise.all(
      list.map(async (r: any) => {
        const resCost = await fetch(
          `http://localhost:3001/costs/recipe/${r.id}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        const costData = await resCost.json();

        const cost = costData.costPerPortion;

        const priceWithoutTax = cost / (1 - margin);
        const finalPrice = priceWithoutTax * (1 + tax);
        const suggested = Math.ceil(finalPrice / 1000) * 1000;

        return {
          name: r.name,
          cost,
          finalPrice,
          suggested
        };
      })
    );

    setPriceList(results);

  } catch (error) {
    console.error(error);
  }
};





  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Cálculo de Precio de Venta
      </h1>

      <div className="bg-gray-400/20 p-6 rounded-2xl space-y-6">

        {/* RECETA */}
        <div>
          <label>Seleccionar receta</label>
          <select
            value={selectedRecipe}
            onChange={(e) => setSelectedRecipe(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Seleccionar --</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={fetchCost}>
          Obtener costo
        </Button>

        {/* COSTO */}
        {cost && (
          <div>
            <strong>Costo por porción:</strong> ${cost.toFixed(2)}
          </div>
        )}

        {/* MARGEN */}
        <div>
          <label>Margen (ej: 0.3 = 30%)</label>
          <input
            type="number"
            step="0.1"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="border p-2 rounded w-40"
          />
        </div>

        {/* IMPUESTO */}
        <div>
          <label>Impuesto (ej: 0.19 = 19%)</label>
          <input
            type="number"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
            className="border p-2 rounded w-40"
          />
        </div>

        <Button onClick={handleCalculate}>
          Calcular precio
        </Button>

      </div>

      {/* RESULTADOS */}
      {price && (
        <div className="mt-10 bg-white p-6 rounded-xl shadow">

          <h2 className="text-xl font-semibold mb-4">
            Resultado
          </h2>

          <p>
            <strong>Precio sin impuestos:</strong> ${price.priceWithoutTax.toFixed(2)}
          </p>

          <p className="text-green-600 font-bold">
            <strong>Precio final:</strong> ${price.finalPrice.toFixed(2)}
          </p>
          {suggestedPrice && (
  <div className="mt-6 text-center">

    <p className="text-sm text-gray-500 mb-2">
      Precio de venta sugerido
    </p>

    <div className="bg-green-600 text-white text-2xl font-bold py-4 rounded-xl shadow-lg">
      ${suggestedPrice.toLocaleString()}
    </div>

  </div>
)}

        </div>
        
      )}
      {priceList.length > 0 && (
  <div className="mt-10 bg-white p-6 rounded-xl shadow">

    <h2 className="text-xl font-semibold mb-4">
      Lista de precios sugeridos
    </h2>

    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left">Producto</th>
          <th>Costo</th>
          <th>Precio final</th>
          <th>Precio sugerido</th>
        </tr>
      </thead>

      <tbody>
        {priceList.map((p, i) => (
          <tr key={i} className="border-b text-center">
            <td className="text-left">{p.name}</td>
            <td>${p.cost?.toFixed(0)}</td>
            <td>${p.finalPrice?.toFixed(0)}</td>
            <td className="font-bold text-green-600">
              ${p.suggested?.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

  </div>
)}

    </DashboardLayout>
  );
}