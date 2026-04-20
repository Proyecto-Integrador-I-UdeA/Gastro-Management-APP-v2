"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { apiFetch } from "@/lib/api";

export default function EditMenuItemPage() {

  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hasDrink, setHasDrink] = useState(false);
  const [hasDessert, setHasDessert] = useState(false);
  const [active, setActive] = useState(true);

  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  // 🔥 cargar datos
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [menuItem, productsData, recipesData] = await Promise.all([
        apiFetch(`/menu-items/${id}`),
        apiFetch("/products"),
        apiFetch("/recipes"),
      ]);
      
  console.log("📦 MENU ITEM:", menuItem);
      setName(menuItem.name);
      setDescription(menuItem.description || "");
      setHasDrink(menuItem.hasDrink);
      setHasDessert(menuItem.hasDessert);
      setActive(menuItem.active);

      setComponents(
  menuItem.components.map((c: any) => ({
    productId: c.productId || null,
    recipeId: c.recipeId || null,
    quantity: c.quantity || 1,
  }))
);

      setProducts(productsData);
      setRecipes(recipesData);

      setLoading(false);
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
    const updated = components.filter((_, i) => i !== index);
    setComponents(updated);
  };

  const handleSubmit = async () => {
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
  };

  if (loading) return <div>Cargando...</div>;
  
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Editar Plato</h1>

      <div className="bg-white p-6 rounded-xl shadow-md space-y-4">

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
            <input type="checkbox" checked={hasDrink} onChange={(e) => setHasDrink(e.target.checked)} />
            Bebida
          </label>

          <label>
            <input type="checkbox" checked={hasDessert} onChange={(e) => setHasDessert(e.target.checked)} />
            Postre
          </label>

          <label>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activo
          </label>
        </div>

        <button onClick={addComponent}>+ Agregar componente</button>

        {components.map((item, index) => (
          <div key={index} className="flex gap-2">

            <select
              value={
                item.productId
                  ? `product-${item.productId}`
                  : `recipe-${item.recipeId}`
              }
              onChange={(e) => {
                const value = e.target.value;
                const updated = [...components];

                if (value.startsWith("product-")) {
                  updated[index].productId = Number(value.replace("product-", ""));
                  updated[index].recipeId = null;
                } else {
                  updated[index].recipeId = Number(value.replace("recipe-", ""));
                  updated[index].productId = null;
                }

                setComponents(updated);
              }}
            >
              <option value="">Seleccionar</option>

              {products.map((p) => (
                <option key={`product-${p.id}`} value={`product-${p.id}`}>
                  🧂 {p.name}
                </option>
              ))}

              {recipes.map((r) => (
                <option key={`recipe-${r.id}`} value={`recipe-${r.id}`}>
                  🍳 {r.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={item.quantity}
              onChange={(e) => {
                const updated = [...components];
                updated[index].quantity = Number(e.target.value);
                setComponents(updated);
              }}
            />

            <button onClick={() => removeComponent(index)}>❌</button>
          </div>
        ))}

        <Button onClick={handleSubmit}>
          Guardar cambios
        </Button>

      </div>
    </DashboardLayout>
  );
}