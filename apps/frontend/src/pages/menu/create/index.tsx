"use client";

import { useEffect, useState } from "react";
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

  // 🔥 cargar productos y recetas
  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsData = await apiFetch("/products");
        const recipesData = await apiFetch("/recipes");

        setProducts(Array.isArray(productsData) ? productsData : []);
        setRecipes(Array.isArray(recipesData) ? recipesData : []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, []);

  // 🔹 agregar componente
  const addComponent = () => {
    setComponents([
      ...components,
      { productId: null, recipeId: null, quantity: 1 },
    ]);
  };

  // 🔹 actualizar componente
  const handleComponentChange = (index: number, field: string, value: any) => {
    const updated = [...components];
    updated[index][field] = value;
    setComponents(updated);
  };

  // 🔥 enviar
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

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)] space-y-4">

        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Nombre del plato
          </label>
          <input
            className="w-full border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* DESCRIPCIÓN */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Descripción (acompañantes)
          </label>
          <input
            className="w-full border p-2 rounded"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* OPCIONES */}
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

              {/* 🔥 SELECT MIXTO */}
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

                {/* PRODUCTOS */}
                {products.map((p) => (
                  <option key={`product-${p.id}`} value={`product-${p.id}`}>
                    🧂 {p.name}
                  </option>
                ))}

                {/* RECETAS */}
                {recipes.map((r) => (
                  <option key={`recipe-${r.id}`} value={`recipe-${r.id}`}>
                    🍳 {r.name}
                  </option>
                ))}
              </select>

              {/* CANTIDAD */}
              <input
                type="number"
                className="border p-2 rounded w-1/2"
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
    </DashboardLayout>
  );
}