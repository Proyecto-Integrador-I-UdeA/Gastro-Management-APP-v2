"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError } from "@/utils/toast";
import { apiFetch } from "@/lib/api"; // 🔥 IMPORTANTE

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
      const data = await apiFetch("/recipes");

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
      const data = await apiFetch(`/costs/recipe/${selectedRecipe}`, {
        method: "POST",
      });

      setCost(data.costPerPortion);

    } catch (error) {
      console.error(error);
    }
  };

  // 🔥 CALCULO
  const handleCalculate = () => {
    if (!cost) return showError("Primero calcula el costo");

    if (margin >= 1) {
      return showError("El margen no puede ser mayor o igual a 100%");
    }

    const priceWithoutTax = cost / (1 - margin);
    const taxValue = priceWithoutTax * tax;
    const finalPrice = priceWithoutTax + taxValue;
    const utility = priceWithoutTax - cost;

    const suggested = Math.ceil(finalPrice / 1000) * 1000;

    setPrice({
      priceWithoutTax,
      finalPrice,
      utility,
      taxValue,
      cost
    });

    setSuggestedPrice(suggested);
  };

  const fetchSuggestedPrices = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      const results = await Promise.all(
        list.map(async (r: any) => {

          const costData = await apiFetch(`/costs/recipe/${r.id}`, {
            method: "POST",
          });

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

        {cost && (
          <div>
            <strong>Costo por porción:</strong> ${cost.toFixed(2)}
          </div>
        )}

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

          <div className="mt-6 border-t pt-4 space-y-2">

            <h3 className="font-semibold text-gray-700">
              Desglose del precio
            </h3>

            <p>
              <strong>Costo:</strong> ${price.cost.toFixed(2)}
            </p>

            <p className="text-blue-600">
              <strong>Utilidad (negocio):</strong> ${price.utility.toFixed(2)}
            </p>

            <p className="text-orange-600">
              <strong>Impuestos:</strong> ${price.taxValue.toFixed(2)}
            </p>

            <p className="text-green-700 font-bold">
              <strong>Total validado:</strong>{" "}
              ${(price.cost + price.utility + price.taxValue).toFixed(2)}
            </p>

          </div>

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
                <th>Precio sin impuesto</th>
                <th>Precio final</th>
                <th>Precio sugerido</th>
              </tr>
            </thead>

            <tbody>
              {priceList.map((p, i) => (
                <tr key={i} className="border-b text-center">
                  <td className="text-left">{p.name}</td>
                  <td>${p.cost?.toFixed(0)}</td>
                  <td>${(p.cost / (1 - margin)).toFixed(0)}</td>
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