"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

type SalesCatalogItem = {
  id: number;
  name: string;
  description: string | null;
  kind: "STANDARD" | "ADDITION";
  available: boolean;
  includedItemsText: string | null;
  category: {
    id: number;
    name: string;
  };
  price: {
    amount: string;
    currency: string;
    taxIncluded: boolean;
    validFrom: string;
  };
};

type SalesCatalogCategory = {
  id: number;
  name: string;
  displayOrder: number;
  items: SalesCatalogItem[];
};

type SalesMenuCatalog = {
  categories: SalesCatalogCategory[];
};

function formatPrice(amount: string, currency: string): string {
  const [rawInteger, rawFraction = ""] = amount.split(".");
  const negative = rawInteger.startsWith("-");
  const integer = negative ? rawInteger.slice(1) : rawInteger;
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = rawFraction.slice(0, 2);
  const decimalPart = fraction && fraction !== "00" ? `,${fraction}` : "";

  return `${currency} ${negative ? "-" : ""}${groupedInteger}${decimalPart}`;
}

export default function SalesMenuCatalogPage() {
  const [catalog, setCatalog] = useState<SalesMenuCatalog>({ categories: [] });
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!getUserPermissions().includes("sales.read")) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const loadCatalog = async () => {
      try {
        setCatalog(await apiFetch<SalesMenuCatalog>("/sales/menu-catalog"));
      } catch (error) {
        console.error("Error cargando catálogo de ventas:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    void loadCatalog();
  }, []);

  const visibleCategories = useMemo(() => (
    selectedCategoryId === null
      ? catalog.categories
      : catalog.categories.filter(category => category.id === selectedCategoryId)
  ), [catalog.categories, selectedCategoryId]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#001F3F]">Menú y precios</h1>
          <p className="mt-2 text-gray-600">
            Consulta los productos disponibles y su precio vigente.
          </p>
        </div>

        {accessDenied ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No tienes permiso para consultar el catálogo de ventas.
          </div>
        ) : loading ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">
            Cargando catálogo...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
            No fue posible cargar el catálogo de ventas.
          </div>
        ) : catalog.categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
            No hay productos disponibles para la venta.
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por categoría">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  selectedCategoryId === null
                    ? "bg-[#001F3F] text-white"
                    : "bg-white text-[#001F3F] shadow-sm"
                }`}
              >
                Todas
              </button>
              {catalog.categories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    selectedCategoryId === category.id
                      ? "bg-[#001F3F] text-white"
                      : "bg-white text-[#001F3F] shadow-sm"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {visibleCategories.map(category => (
                <section key={category.id} aria-labelledby={`category-${category.id}`}>
                  <h2
                    id={`category-${category.id}`}
                    className="mb-4 text-2xl font-semibold text-[#001F3F]"
                  >
                    {category.name}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {category.items.map(item => (
                      <article
                        key={item.id}
                        className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-md ${
                          item.available ? "" : "opacity-70"
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">{item.name}</h3>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800">
                            {item.kind === "ADDITION" ? "Adición" : item.category.name}
                          </span>
                        </div>
                        {!item.available && (
                          <p className="mb-3 text-sm font-semibold text-amber-700">Agotado</p>
                        )}
                        {item.description && (
                          <p className="mb-5 text-sm text-gray-600">{item.description}</p>
                        )}
                        {item.includedItemsText && (
                          <p className="mb-5 text-sm text-gray-700">
                            {item.includedItemsText}
                          </p>
                        )}
                        <p className="text-2xl font-bold text-emerald-700">
                          {formatPrice(item.price.amount, item.price.currency)}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
