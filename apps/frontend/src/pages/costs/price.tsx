"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function PriceCalculationPage() {

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [priceList, setPriceList] = useState<any[]>([]);

  const [margin, setMargin] = useState(0.4);
  const [tax, setTax] = useState(0.22);

  const [price, setPrice] = useState<any>(null);


  // 🔥 cargar platos
  const fetchMenuItems = async () => {
    try {
      const data = await apiFetch("/menu-items");

      const list = Array.isArray(data)
        ? data
        : data.data || [];

      setMenuItems(list.filter((m: any) => m.active));

    } catch (error) {
      console.error(error);
    }
  };


  useEffect(() => {
    fetchMenuItems();
  }, []);


  useEffect(() => {
    if (margin && tax) {
      fetchSuggestedPrices();
    }
  }, [margin, tax]);


  // 🔥 obtener costo (PLATO)
  const fetchCost = async () => {
    if (!selectedItem) return;

    try {
      const data = await apiFetch(`/costs/menu-item/${selectedItem}`, {
        method: "GET",
      });

      setCost(data.totalCost);

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


  // 🔥 LISTA DE PRECIOS (PLATOS)
  const fetchSuggestedPrices = async () => {
    try {
      const data = await apiFetch("/menu-items");

      const list = Array.isArray(data)
        ? data
        : data.data || [];

      const results = await Promise.all(
        list
          .filter((m: any) => m.active)
          .map(async (m: any) => {

            const costData = await apiFetch(`/costs/menu-item/${m.id}`);

            const cost = costData.totalCost;

            const priceWithoutTax = cost / (1 - margin);
            const finalPrice = priceWithoutTax * (1 + tax);
            const suggested = Math.ceil(finalPrice / 1000) * 1000;

            return {
              name: m.name,
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
          <label>Seleccionar plato</label>
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Seleccionar --</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={fetchCost}>
          Obtener costo
        </Button>

        {cost && (
          <div>
            <strong>Costo del plato:</strong> ${cost.toFixed(2)}
          </div>
        )}

        <div>
          <label>Margen (ej: 0.4 = 40%)</label>
          <input
            type="number"
            step="0.1"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="border p-2 rounded w-40"
          />
        </div>

        <div>
          <label>Impuesto (ej: 0.22 = 22%)</label>
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
                <th className="text-left">Plato</th>
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