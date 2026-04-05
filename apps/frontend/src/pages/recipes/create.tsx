"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";

export default function CreateRecipePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [portions, setPortions] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // 🔥 cargar productos (solo ingredientes)
  const fetchProducts = async () => {
    const res = await fetch("http://localhost:3001/products", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];

    setProducts(list.filter((p: any) => p.isIngredient));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 🔹 agregar fila ingrediente
  const addItem = () => {
    setItems([...items, { productId: "", quantity: 0 }]);
  };

  // 🔹 actualizar fila
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // 🔥 enviar
  const handleSubmit = async () => {
    try {
      await fetch("http://localhost:3001/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
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

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Crear Receta
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)] space-y-6">

        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Nombre de la receta
          </label>
          <input
            className="w-full border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* PORCIONES */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Porciones
          </label>
          <input
            type="number"
            className="w-full border p-2 rounded"
            value={portions}
            onChange={(e) => setPortions(Number(e.target.value))}
          />
        </div>

        {/* INGREDIENTES */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Ingredientes
          </h3>

          <button
            onClick={addItem}
            className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            + Agregar ingrediente
          </button>

          {items.map((item, index) => (
            <div key={index} className="flex gap-2 mb-2">

              <select
                className="border p-2 rounded w-1/2"
                onChange={(e) =>
                  handleItemChange(index, "productId", Number(e.target.value))
                }
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
                placeholder="Cantidad"
                className="border p-2 rounded w-1/2"
                onChange={(e) =>
                  handleItemChange(index, "quantity", Number(e.target.value))
                }
              />
            </div>
          ))}
        </div>

        {/* BOTÓN */}
        <Button onClick={handleSubmit}>
          Guardar Receta
        </Button>

      </div>
    </DashboardLayout>
  );
}