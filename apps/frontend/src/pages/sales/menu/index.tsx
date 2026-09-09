"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import MenuItemThumbnail from "@/components/menu/MenuItemThumbnail";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";
import { searchSalesCatalogItems } from "@/utils/salesCatalogSearch";

type SalesCatalogItem = {
  id: number;
  name: string;
  description: string | null;
  kind: "STANDARD" | "ADDITION";
  available: boolean;
  includedItemsText: string | null;
  image: { url: string; width: number | null; height: number | null } | null;
  category: { id: number; name: string };
  price: { amount: string; currency: string; taxIncluded: boolean; validFrom: string };
};

type SalesCatalogCategory = {
  id: number;
  name: string;
  displayOrder: number;
  items: SalesCatalogItem[];
};

type SalesMenuCatalog = { categories: SalesCatalogCategory[] };

type SalesOrderItem = {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  specialInstructions: string | null;
  unitPrice: string;
  currency: string;
  taxIncluded: boolean;
  lineSubtotal: string;
  additions: SalesOrderItem[];
};

type SalesOrder = {
  id: number;
  status: "OPEN" | "SETTLED" | "VOIDED";
  table: { id: number; code: string; area: string | null; capacity: number; active: boolean };
  guestCount: number | null;
  openedAt: string;
  billRequestedAt: string | null;
  openedBy: { id: number; fullName: string | null };
  items: SalesOrderItem[];
  totals: { subtotal: string; total: string; currency: string | null };
};

type ApiError = Error & {
  status?: number;
  body?: { code?: string; error?: string };
};

function formatPrice(amount: string, currency: string | null): string {
  const [rawInteger, rawFraction = ""] = amount.split(".");
  const negative = rawInteger.startsWith("-");
  const integer = negative ? rawInteger.slice(1) : rawInteger;
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = rawFraction.slice(0, 2);
  const decimalPart = fraction && fraction !== "00" ? `,${fraction}` : "";
  return `${currency ?? ""} ${negative ? "-" : ""}${groupedInteger}${decimalPart}`.trim();
}

function parseOrderId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function apiErrorCode(error: unknown): string | undefined {
  return (error as ApiError).body?.code;
}

function friendlyOrderError(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  const messages: Record<string, string> = {
    ORDER_NOT_FOUND: "El pedido solicitado no existe.",
    ORDER_NOT_OPEN: "El pedido ya no está abierto y no admite nuevos productos.",
    MENU_ITEM_NOT_FOUND: "El producto ya no existe.",
    MENU_ITEM_UNAVAILABLE: "El producto acaba de agotarse. Actualizamos el menú.",
    MENU_ITEM_NOT_SALEABLE: "El producto ya no está habilitado para la venta.",
    MENU_ITEM_PRICE_NOT_FOUND: "El producto no tiene un precio vigente.",
    ADDITION_KIND_REQUIRED: "Una selección dejó de ser una adición válida.",
    ORDER_CURRENCY_MISMATCH: "El producto usa una moneda diferente a la del pedido.",
  };
  const code = apiError.body?.code;
  return (code && messages[code]) || fallback;
}

function quantityValue(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) ? quantity : null;
}

export default function SalesMenuCatalogPage() {
  const router = useRouter();
  const rawOrderId = router.query?.orderId;
  const contextualMode = rawOrderId !== undefined;
  const orderId = parseOrderId(rawOrderId);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionReady, setPermissionReady] = useState(false);
  const [catalog, setCatalog] = useState<SalesMenuCatalog>({ categories: [] });
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [contextError, setContextError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [selectedItem, setSelectedItem] = useState<SalesCatalogItem | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [selectedAdditionIds, setSelectedAdditionIds] = useState<Set<number>>(new Set());
  const [additionSearch, setAdditionSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const canRead = permissions.includes("sales.read");
  const canManage = permissions.includes("sales.manage");

  const loadCatalog = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      setCatalog(await apiFetch<SalesMenuCatalog>("/sales/menu-catalog"));
      setLoadError("");
    } catch (error) {
      console.error("Error cargando catálogo de ventas:", error);
      if (!background) setLoadError("No fue posible cargar el catálogo de ventas.");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const loadOrder = useCallback(async (id: number, background = false) => {
    if (!background) setOrderLoading(true);
    try {
      const canonicalOrder = await apiFetch<SalesOrder>(`/sales/orders/${id}`);
      setOrder(canonicalOrder);
      setContextError(canonicalOrder.status === "OPEN"
        ? ""
        : "El pedido ya no está abierto y no admite nuevos productos.");
      return canonicalOrder;
    } catch (error) {
      const code = apiErrorCode(error);
      setContextError(friendlyOrderError(error, "No fue posible cargar el pedido."));
      if (code === "ORDER_NOT_FOUND") setOrder(null);
      return null;
    } finally {
      if (!background) setOrderLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentPermissions = getUserPermissions();
    setPermissions(currentPermissions);
    setPermissionReady(true);
  }, []);

  useEffect(() => {
    if (!permissionReady || router.isReady === false) return;
    if (!canRead) {
      setLoading(false);
      return;
    }

    void loadCatalog();
    if (contextualMode) {
      if (orderId === null) setContextError("El identificador del pedido no es válido.");
      else void loadOrder(orderId);
    }
  }, [canRead, contextualMode, loadCatalog, loadOrder, orderId, permissionReady, router.isReady]);

  useEffect(() => {
    if (!canRead || !contextualMode || orderId === null) return undefined;
    const revalidate = () => {
      void loadOrder(orderId, true);
      void loadCatalog(true);
    };
    window.addEventListener("focus", revalidate);
    return () => window.removeEventListener("focus", revalidate);
  }, [canRead, contextualMode, loadCatalog, loadOrder, orderId]);

  const allItems = useMemo(
    () => catalog.categories.flatMap(category => category.items),
    [catalog.categories],
  );

  const additions = useMemo(() => searchSalesCatalogItems(
    allItems.filter(item => item.kind === "ADDITION"),
    additionSearch,
  ), [additionSearch, allItems]);

  const contextualItems = useMemo(() => searchSalesCatalogItems(
    allItems.filter(item => (
      item.kind === "STANDARD"
      && (selectedCategoryId === null || item.category.id === selectedCategoryId)
    )),
    search,
  ), [allItems, search, selectedCategoryId]);

  const visibleCategories = useMemo(() => (
    selectedCategoryId === null
      ? catalog.categories
      : catalog.categories.filter(category => category.id === selectedCategoryId)
  ), [catalog.categories, selectedCategoryId]);

  const availableCategories = useMemo(() => catalog.categories.filter(category => (
    !contextualMode || category.items.some(item => item.kind === "STANDARD")
  )), [catalog.categories, contextualMode]);

  const parsedQuantity = quantityValue(quantityDraft);
  const instructionsTooLong = instructions.length > 500;
  const orderAcceptsItems = order?.status === "OPEN";

  function resetConfigurator() {
    setSelectedItem(null);
    setQuantityDraft("1");
    setInstructions("");
    setSelectedAdditionIds(new Set());
    setAdditionSearch("");
    setActionError("");
  }

  function openConfigurator(item: SalesCatalogItem) {
    if (!canManage || !orderAcceptsItems || !item.available || item.kind !== "STANDARD") return;
    setFeedback("");
    resetConfigurator();
    setSelectedItem(item);
  }

  function toggleAddition(id: number) {
    setSelectedAdditionIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitItem(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !selectedItem || orderId === null || !orderAcceptsItems || !canManage) return;

    if (parsedQuantity === null) {
      setActionError("La cantidad debe ser un entero mayor que 0.");
      return;
    }
    if (instructionsTooLong) {
      setActionError("Las indicaciones no pueden superar 500 caracteres.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setActionError("");
    setFeedback("");
    const trimmedInstructions = instructions.trim();
    try {
      const canonicalOrder = await apiFetch<SalesOrder>(`/sales/orders/${orderId}/items`, {
        method: "POST",
        json: {
          menuItemId: selectedItem.id,
          quantity: parsedQuantity,
          ...(trimmedInstructions ? { specialInstructions: trimmedInstructions } : {}),
          ...(selectedAdditionIds.size > 0 ? {
            additions: Array.from(selectedAdditionIds).map(menuItemId => ({ menuItemId })),
          } : {}),
        },
      });
      setOrder(canonicalOrder);
      setContextError(canonicalOrder.status === "OPEN" ? "" : "El pedido ya no está abierto y no admite nuevos productos.");
      setFeedback(`${selectedItem.name} agregado. Total actual: ${formatPrice(canonicalOrder.totals.total, canonicalOrder.totals.currency)}.`);
      resetConfigurator();
      await loadCatalog(true);
    } catch (error) {
      const code = apiErrorCode(error);
      const message = friendlyOrderError(error, "No fue posible agregar el producto.");
      if (code === "MENU_ITEM_UNAVAILABLE") {
        resetConfigurator();
        setFeedback(message);
        await loadCatalog(true);
      } else if (code === "ORDER_NOT_OPEN") {
        resetConfigurator();
        setContextError(message);
        await loadOrder(orderId, true);
      } else if (code === "ORDER_NOT_FOUND") {
        resetConfigurator();
        setOrder(null);
        setContextError(message);
      } else {
        setActionError(message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function returnToOrder() {
    void router.push(orderId === null ? "/sales/orders" : `/sales/orders?orderId=${orderId}`);
  }

  function renderCard(item: SalesCatalogItem, contextual: boolean) {
    const addDisabled = !item.available || !canManage || !orderAcceptsItems;
    return (
      <article key={item.id} className={`flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-md ${item.available ? "" : "opacity-70"}`}>
        <MenuItemThumbnail itemName={item.name} image={item.image} size="sales" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold text-gray-900">{item.name}</h3>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800">{item.kind === "ADDITION" ? "Adición" : item.category.name}</span>
        </div>
        <p className={`mb-3 inline-flex self-start rounded-full px-3 py-1 text-sm font-semibold ${item.available ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {item.available ? "Disponible" : "Agotado"}
        </p>
        {item.description && <p className="mb-3 text-sm text-gray-600">{item.description}</p>}
        {item.includedItemsText && <p className="mb-3 text-sm text-gray-700">{item.includedItemsText}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <p className="text-2xl font-bold text-emerald-700">{formatPrice(item.price.amount, item.price.currency)}</p>
          {contextual && (
            <button type="button" disabled={addDisabled} className="rounded-full bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" onClick={() => openConfigurator(item)}>
              {!item.available ? "Agotado" : !canManage ? "Solo lectura" : !orderAcceptsItems ? "Pedido cerrado" : "Agregar"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#001F3F]">{contextualMode ? "Registrar pedido" : "Menú y precios"}</h1>
            <p className="mt-2 text-gray-600">{contextualMode ? "Selecciona productos del menú para el pedido activo." : "Consulta los productos disponibles y su precio vigente."}</p>
          </div>
          {contextualMode && <button type="button" className="rounded-lg border border-[#001F3F] px-4 py-2 text-sm font-semibold text-[#001F3F]" onClick={returnToOrder}>Volver al pedido</button>}
        </div>

        {!permissionReady || loading ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">Cargando catálogo...</div>
        ) : !canRead ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No tienes permiso para consultar el catálogo de ventas.</div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{loadError}</div>
        ) : catalog.categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">No hay productos disponibles para la venta.</div>
        ) : (
          <>
            {contextualMode && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Contexto del pedido">
                {orderLoading ? <p className="text-slate-600">Cargando pedido...</p> : contextError && !order ? (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                    <p>{contextError}</p>
                    <button type="button" className="mt-3 font-semibold underline" onClick={() => void router.push("/sales/orders")}>Volver a Mesas y pedidos</button>
                  </div>
                ) : order ? (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">Mesa {order.table.code} · Pedido #{order.id}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === "OPEN" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"}`}>{order.status === "OPEN" ? "Abierto" : "Cerrado"}</span>
                        {order.billRequestedAt && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Cuenta solicitada</span>}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{order.guestCount === null ? "Comensales sin definir" : `${order.guestCount} comensales`} · {order.items.length} líneas principales</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total actual</p>
                      <p className="text-2xl font-bold text-[#001F3F]">{formatPrice(order.totals.total, order.totals.currency)}</p>
                    </div>
                  </div>
                ) : null}
                {contextError && order && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{contextError}</p>}
              </section>
            )}

            {feedback && <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{feedback}</div>}
            {contextualMode && order && (
              <label className="mb-5 block">
                <span className="sr-only">Buscar en el menú</span>
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar plato, bebida o categoría..." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm" />
              </label>
            )}

            <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por categoría">
              <button type="button" onClick={() => setSelectedCategoryId(null)} className={`rounded-full px-4 py-2 text-sm font-medium ${selectedCategoryId === null ? "bg-[#001F3F] text-white" : "bg-white text-[#001F3F] shadow-sm"}`}>Todas</button>
              {availableCategories.map(category => <button key={category.id} type="button" onClick={() => setSelectedCategoryId(category.id)} className={`rounded-full px-4 py-2 text-sm font-medium ${selectedCategoryId === category.id ? "bg-[#001F3F] text-white" : "bg-white text-[#001F3F] shadow-sm"}`}>{category.name}</button>)}
            </div>

            {contextualMode ? (
              contextualItems.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No se encontraron productos.</div> : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{contextualItems.map(item => renderCard(item, true))}</div>
              )
            ) : (
              <div className="space-y-8">
                {visibleCategories.map(category => (
                  <section key={category.id} aria-labelledby={`category-${category.id}`}>
                    <h2 id={`category-${category.id}`} className="mb-4 text-2xl font-semibold text-[#001F3F]">{category.name}</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{category.items.map(item => renderCard(item, false))}</div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/50 p-4">
          <form role="dialog" aria-label={`Configurar ${selectedItem.name}`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onSubmit={submitItem}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{selectedItem.category.name}</p>
                <h2 className="text-2xl font-bold text-slate-900">{selectedItem.name}</h2>
                <p className="mt-1 text-xl font-bold text-emerald-700">{formatPrice(selectedItem.price.amount, selectedItem.price.currency)}</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-2" onClick={resetConfigurator}>Cerrar</button>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
              <MenuItemThumbnail itemName={selectedItem.name} image={selectedItem.image} size="sales" />
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">Cantidad
                  <input aria-label="Cantidad" type="number" min="1" step="1" inputMode="numeric" value={quantityDraft} onChange={event => setQuantityDraft(event.target.value)} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                {quantityDraft !== "" && parsedQuantity === null && <p className="text-sm text-red-700">La cantidad debe ser un entero mayor que 0.</p>}
                <label className="block text-sm font-semibold text-slate-700">Indicaciones especiales
                  <textarea aria-label="Indicaciones especiales" value={instructions} onChange={event => setInstructions(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Ej. Sin cebolla, salsa aparte" />
                </label>
                <p className={`text-xs ${instructionsTooLong ? "text-red-700" : "text-slate-500"}`}>{instructions.length}/500 caracteres</p>
              </div>
            </div>

            <section className="mt-6 border-t border-slate-200 pt-5" aria-labelledby="additions-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="additions-title" className="text-lg font-bold text-slate-900">Adiciones</h3>
                  <p className="text-sm text-slate-600">Las adiciones seleccionadas usan la misma cantidad del producto.</p>
                </div>
                {allItems.some(item => item.kind === "ADDITION") && <input aria-label="Buscar adiciones" type="search" value={additionSearch} onChange={event => setAdditionSearch(event.target.value)} placeholder="Buscar adición" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />}
              </div>
              {additions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No hay adiciones para mostrar.</p> : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {additions.map(addition => (
                    <label key={addition.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${addition.available ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                      <span className="flex items-center gap-3">
                        <input type="checkbox" aria-label={`Seleccionar ${addition.name}`} checked={selectedAdditionIds.has(addition.id)} disabled={!addition.available} onChange={() => toggleAddition(addition.id)} />
                        <span><span className="block font-semibold text-slate-900">{addition.name}</span><span className="text-xs text-slate-500">{addition.available ? "Disponible" : "Agotado"}</span></span>
                      </span>
                      <span className="font-semibold text-emerald-700">{formatPrice(addition.price.amount, addition.price.currency)}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {actionError && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-lg border border-slate-300 px-4 py-2" onClick={resetConfigurator}>Cancelar</button>
              <button type="submit" disabled={submitting || parsedQuantity === null || instructionsTooLong} className="rounded-lg bg-[#001F3F] px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Agregando..." : "Agregar al pedido"}</button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
