"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { showError, showSuccess } from "@/utils/toast";

type MenuCategory = {
  id: number;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
};

type MenuCategoryManagerProps = {
  canManage: boolean;
};

function sortCategories(categories: MenuCategory[]) {
  return [...categories].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
}

export default function MenuCategoryManager({ canManage }: MenuCategoryManagerProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDisplayOrder, setEditDisplayOrder] = useState("0");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await apiFetch("/menu-categories?includeInactive=true");
        setCategories(sortCategories(Array.isArray(data) ? data : []));
      } catch (error) {
        console.error("Error cargando categorías de menú:", error);
      }
    };

    void fetchCategories();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !name.trim()) return;

    setSubmitting(true);
    try {
      const created = await apiFetch("/menu-categories", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          displayOrder: Number(displayOrder) || 0,
          active: true,
        }),
      });

      setCategories((current) =>
        sortCategories([...current, created as MenuCategory]),
      );
      setName("");
      setDescription("");
      setDisplayOrder("0");
      showSuccess("Categoría creada correctamente");
    } catch (error) {
      console.error("Error creando categoría de menú:", error);
      showError("No fue posible crear la categoría");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (category: MenuCategory) => {
    if (!canManage) return;

    try {
      const updated = await apiFetch(`/menu-categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !category.active }),
      });

      setCategories((current) =>
        sortCategories(
          current.map((item) =>
            item.id === category.id ? (updated as MenuCategory) : item,
          ),
        ),
      );
      showSuccess(
        category.active ? "Categoría desactivada" : "Categoría activada",
      );
    } catch (error) {
      console.error("Error actualizando categoría de menú:", error);
      showError("No fue posible actualizar la categoría");
    }
  };

  const startEditing = (category: MenuCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description || "");
    setEditDisplayOrder(String(category.displayOrder));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditDisplayOrder("0");
  };

  const handleEdit = async (event: FormEvent, category: MenuCategory) => {
    event.preventDefault();
    if (!canManage) return;

    const parsedDisplayOrder = Number(editDisplayOrder);
    if (
      !editName.trim() ||
      !Number.isInteger(parsedDisplayOrder) ||
      parsedDisplayOrder < 0
    ) {
      showError("Ingresa un nombre y un orden entero mayor o igual a 0");
      return;
    }

    setEditSubmitting(true);
    try {
      const updated = await apiFetch(`/menu-categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          displayOrder: parsedDisplayOrder,
        }),
      });

      setCategories((current) =>
        sortCategories(
          current.map((item) =>
            item.id === category.id ? (updated as MenuCategory) : item,
          ),
        ),
      );
      cancelEditing();
      showSuccess("Categoría actualizada correctamente");
    } catch (error) {
      console.error("Error editando categoría de menú:", error);
      showError("No fue posible editar la categoría");
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#001F3F]">Categorías del menú</h2>
        <p className="mt-1 text-sm text-slate-600">
          Organiza los platos que estarán disponibles en el catálogo de ventas.
        </p>
      </div>

      {canManage && (
        <form
          className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr_120px_auto] md:items-end"
          onSubmit={handleCreate}
        >
          <label className="text-sm font-medium text-slate-700">
            Nombre
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Descripción
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Orden
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear categoría"}
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-slate-500">No hay categorías registradas.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.id}
              className={`rounded-xl border p-4 ${
                category.active
                  ? "border-blue-100 bg-blue-50/60"
                  : "border-slate-200 bg-slate-100 text-slate-500"
              }`}
            >
              {editingId === category.id ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => void handleEdit(event, category)}
                >
                  <label className="block text-sm font-medium text-slate-700">
                    Nombre
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Descripción
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Orden
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                      value={editDisplayOrder}
                      onChange={(event) => setEditDisplayOrder(event.target.value)}
                      required
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="rounded-lg bg-[#001F3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {editSubmitting ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={cancelEditing}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{category.name}</h3>
                      {category.description && (
                        <p className="mt-1 text-sm">{category.description}</p>
                      )}
                      <p className="mt-2 text-xs">Orden: {category.displayOrder}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium">
                      {category.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  {canManage && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[#001F3F] bg-white px-3 py-1.5 text-xs font-semibold text-[#001F3F] hover:bg-blue-50"
                        onClick={() => startEditing(category)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                          category.active
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                        onClick={() => void handleToggle(category)}
                      >
                        {category.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  )}
                </>
              )}

            </article>
          ))}
        </div>
      )}
    </section>
  );
}
