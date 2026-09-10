"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ServiceTraceability from "@/components/sales/ServiceTraceability";
import type {
  KitchenDispatch,
  KitchenDispatchStatus,
  KitchenOrderLineState,
  KitchenOrderSummary,
  KitchenServiceStatus,
  SalesKitchenDispatchTrace,
} from "@/types/kitchen";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

type OperationalStatus = "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE";

type SalesTable = {
  id: number;
  code: string;
  area: string | null;
  capacity: number;
  active: boolean;
  operationalStatus: OperationalStatus;
  activeOrder: ({
    id: number;
    guestCount: number | null;
    openedAt: string;
    billRequestedAt: string | null;
    openedBy: { id: number; fullName: string | null };
  } & KitchenOrderSummary) | null;
};

type SalesTablesResponse = { tables: SalesTable[] };

type SalesOrderLine = KitchenOrderLineState & {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  specialInstructions: string | null;
  unitPrice: string;
  currency: string;
  taxIncluded: boolean;
  lineSubtotal: string;
};

type SalesOrderAddition = SalesOrderLine;

type SalesOrderItem = SalesOrderLine & {
  additions?: SalesOrderAddition[];
};

type SalesOrder = KitchenOrderSummary & {
  id: number;
  status: "OPEN" | "SETTLED" | "VOIDED";
  table: { id: number; code: string; area: string | null; capacity: number; active: boolean };
  guestCount: number | null;
  openedAt: string;
  billRequestedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: { id: number; fullName: string | null } | null;
  cancellationReason: string | null;
  cancellationAcknowledgedAt: string | null;
  cancellationAcknowledgedBy: { id: number; fullName: string | null } | null;
  openedBy: { id: number; fullName: string | null };
  kitchenDispatches: SalesKitchenDispatchTrace[];
  items: SalesOrderItem[];
  totals: { subtotal: string; total: string; currency: string | null };
};

type ApiError = Error & {
  status?: number;
  body?: { code?: string; activeOrderId?: number; error?: string };
};

function formatMoney(amount: string, currency: string | null): string {
  const [rawInteger, rawFraction = ""] = amount.split(".");
  const grouped = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = rawFraction.slice(0, 2);
  return `${currency ?? ""} ${grouped}${fraction && fraction !== "00" ? `,${fraction}` : ""}`.trim();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  const code = apiError.body?.code;
  const messages: Record<string, string> = {
    TABLE_NOT_FOUND: "La mesa ya no existe.",
    TABLE_OUT_OF_SERVICE: "La mesa está fuera de servicio.",
    ACTIVE_ORDER_NOT_FOUND: "La mesa no tiene un pedido activo.",
    ORDER_NOT_FOUND: "El pedido ya no existe.",
    ORDER_NOT_OPEN: "El pedido ya no está abierto.",
    ORDER_ITEM_NOT_FOUND: "La línea ya no existe.",
    MENU_ITEM_UNAVAILABLE: "El producto está agotado.",
    ORDER_CURRENCY_MISMATCH: "El producto usa una moneda diferente a la del pedido.",
    NO_PENDING_KITCHEN_ITEMS: "Todos los productos ya fueron enviados a cocina.",
    ORDER_ITEM_ALREADY_SENT_TO_KITCHEN: "Uno de los productos ya fue enviado a cocina.",
    ORDER_HAS_DELIVERED_DISPATCHES:
      "No se puede cancelar completamente un pedido que ya tuvo entregas.",
  };
  return (code && messages[code]) || apiError.message || fallback;
}

const statusLabels: Record<OperationalStatus, string> = {
  AVAILABLE: "Disponible",
  OCCUPIED: "Ocupada",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const statusClasses: Record<OperationalStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OCCUPIED: "bg-blue-100 text-blue-800",
  OUT_OF_SERVICE: "bg-gray-200 text-gray-700",
};

const kitchenStatusLabels: Record<KitchenDispatchStatus, string> = {
  NEXT: "Próximo",
  PREPARING: "En preparación",
  READY: "Listo para recoger",
};

const kitchenServiceStatusLabels: Record<KitchenServiceStatus, string> = {
  ...kitchenStatusLabels,
  DELIVERED: "Entregado",
};

function kitchenSummaryLabel(summary: KitchenOrderSummary): string | null {
  const status = summary.kitchenServiceStatus
    ? kitchenServiceStatusLabels[summary.kitchenServiceStatus]
    : null;
  const pending = summary.pendingKitchenItemCount > 0
    ? `${summary.pendingKitchenItemCount} pendiente${summary.pendingKitchenItemCount === 1 ? "" : "s"}`
    : null;
  return [status, pending].filter(Boolean).join(" · ") || null;
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionReady, setPermissionReady] = useState(false);
  const [tables, setTables] = useState<SalesTable[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [refreshingTables, setRefreshingTables] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [pageError, setPageError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [kitchenFeedback, setKitchenFeedback] = useState("");
  const [openingTableId, setOpeningTableId] = useState<number | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [guestCountDraft, setGuestCountDraft] = useState("");
  const [orderGuestCountDraft, setOrderGuestCountDraft] = useState("");
  const [mutationKey, setMutationKey] = useState("");
  const [instructionDrafts, setInstructionDrafts] = useState<Record<number, string>>({});
  const pollingRef = useRef(false);
  const handledDeepLinkRef = useRef<number | null>(null);

  const canRead = permissions.includes("sales.read");
  const canManage = permissions.includes("sales.manage");
  const canConfigureTables = permissions.includes("sales.tables.manage");

  const loadTables = useCallback(async (background = false) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    if (background) setRefreshingTables(true);
    else setLoadingTables(true);
    try {
      const response = await apiFetch<SalesTablesResponse>("/sales/tables");
      setTables(response.tables);
      setPageError("");
    } catch (error) {
      if (!background) setPageError(errorMessage(error, "No fue posible cargar las mesas."));
    } finally {
      pollingRef.current = false;
      if (background) setRefreshingTables(false);
      else setLoadingTables(false);
    }
  }, []);

  const loadOrder = useCallback(async (orderId: number) => {
    setLoadingOrder(true);
    setOrderError("");
    try {
      const canonicalOrder = await apiFetch<SalesOrder>(`/sales/orders/${orderId}`);
      setOrder(canonicalOrder);
      setSelectedTableId(canonicalOrder.table.id);
      return canonicalOrder;
    } catch (error) {
      setOrderError(errorMessage(error, "No fue posible cargar el pedido."));
      return null;
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    const currentPermissions = getUserPermissions();
    setPermissions(currentPermissions);
    setPermissionReady(true);
  }, []);

  useEffect(() => {
    if (!permissionReady || !canRead) return undefined;
    void loadTables();
    const interval = window.setInterval(() => void loadTables(true), 5000);
    const handleFocus = () => void loadTables(true);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [canRead, loadTables, permissionReady]);

  useEffect(() => {
    if (!permissionReady || !canRead || router.isReady === false) return;
    const rawOrderId = router.query?.orderId;
    if (typeof rawOrderId !== "string" || !/^[1-9]\d*$/.test(rawOrderId)) return;
    const requestedOrderId = Number(rawOrderId);
    if (!Number.isSafeInteger(requestedOrderId) || handledDeepLinkRef.current === requestedOrderId) return;
    handledDeepLinkRef.current = requestedOrderId;
    void loadOrder(requestedOrderId);
  }, [canRead, loadOrder, permissionReady, router.isReady, router.query?.orderId]);

  useEffect(() => {
    if (!order) {
      setInstructionDrafts({});
      return;
    }
    const drafts: Record<number, string> = {};
    for (const item of order.items) {
      drafts[item.id] = item.specialInstructions ?? "";
      for (const addition of item.additions ?? []) drafts[addition.id] = addition.specialInstructions ?? "";
    }
    setInstructionDrafts(drafts);
    setOrderGuestCountDraft(order.guestCount === null ? "" : String(order.guestCount));
  }, [order]);

  const areas = useMemo(() => {
    const values = new Set(tables.map(table => table.area ?? "Sin área"));
    return Array.from(values);
  }, [tables]);

  const visibleTables = useMemo(() => tables.filter(table => (
    selectedArea === "all" || (table.area ?? "Sin área") === selectedArea
  )), [selectedArea, tables]);

  const selectedTable = tables.find(table => table.id === selectedTableId) ?? null;

  async function refreshAfterMutation() {
    await loadTables(true);
  }

  async function handleOpenTable() {
    if (openingTableId === null || !canManage) return;
    const guestCount = guestCountDraft.trim() === "" ? undefined : Number(guestCountDraft);
    if (guestCount !== undefined && (!Number.isInteger(guestCount) || guestCount <= 0)) {
      setMutationError("El número de comensales debe ser un entero mayor que 0.");
      return;
    }
    setMutationKey(`open-${openingTableId}`);
    setMutationError("");
    try {
      const created = await apiFetch<SalesOrder>(`/sales/tables/${openingTableId}/orders`, {
        method: "POST",
        json: guestCount === undefined ? {} : { guestCount },
      });
      setOrder(created);
      setSelectedTableId(openingTableId);
      setOpeningTableId(null);
      setGuestCountDraft("");
      await refreshAfterMutation();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.body?.code === "TABLE_ALREADY_OCCUPIED" && apiError.body.activeOrderId) {
        setMutationError("Otro mesero abrió esta mesa. Se cargó su pedido activo.");
        setSelectedTableId(openingTableId);
        await loadOrder(apiError.body.activeOrderId);
        await refreshAfterMutation();
      } else {
        setMutationError(errorMessage(error, "No fue posible abrir la mesa."));
      }
    } finally {
      setMutationKey("");
    }
  }

  async function handleSelectTable(table: SalesTable) {
    setSelectedTableId(table.id);
    setMutationError("");
    if (table.operationalStatus === "OCCUPIED" && table.activeOrder) {
      await loadOrder(table.activeOrder.id);
    } else {
      setOrder(null);
      setOrderError("");
    }
  }

  async function applyOrderMutation(
    key: string,
    action: () => Promise<SalesOrder>,
    fallback: string,
  ) {
    if (mutationKey) return;
    setMutationKey(key);
    setMutationError("");
    try {
      setOrder(await action());
      await refreshAfterMutation();
    } catch (error) {
      setMutationError(errorMessage(error, fallback));
      await loadTables(true);
    } finally {
      setMutationKey("");
    }
  }

  function updateQuantity(item: SalesOrderLine, quantity: number) {
    if (!order || quantity <= 0 || !canManage) return;
    void applyOrderMutation(
      `quantity-${item.id}`,
      () => apiFetch<SalesOrder>(`/sales/orders/${order.id}/items/${item.id}`, {
        method: "PATCH",
        json: { quantity },
      }),
      "No fue posible actualizar la cantidad.",
    );
  }

  function saveInstructions(item: SalesOrderLine) {
    if (!order || !canManage) return;
    void applyOrderMutation(
      `instructions-${item.id}`,
      () => apiFetch<SalesOrder>(`/sales/orders/${order.id}/items/${item.id}`, {
        method: "PATCH",
        json: { specialInstructions: instructionDrafts[item.id] ?? "" },
      }),
      "No fue posible actualizar las indicaciones.",
    );
  }

  function removeItem(item: SalesOrderLine) {
    if (!order || !canManage) return;
    void applyOrderMutation(
      `delete-${item.id}`,
      () => apiFetch<SalesOrder>(`/sales/orders/${order.id}/items/${item.id}`, {
        method: "DELETE",
      }),
      "No fue posible eliminar la línea.",
    );
  }

  function requestBill() {
    if (!order || !canManage) return;
    void applyOrderMutation(
      "request-bill",
      () => apiFetch<SalesOrder>(`/sales/orders/${order.id}/request-bill`, { method: "POST", json: {} }),
      "No fue posible solicitar la cuenta.",
    );
  }

  async function sendToKitchen() {
    if (!order || !canManage || order.status !== "OPEN" || !order.hasPendingKitchenItems) return;
    if (mutationKey) return;
    setMutationKey("send-kitchen");
    setMutationError("");
    setKitchenFeedback("");
    try {
      await apiFetch<KitchenDispatch>(`/sales/orders/${order.id}/send-to-kitchen`, {
        method: "POST",
        json: {},
      });
      await loadOrder(order.id);
      await refreshAfterMutation();
      setKitchenFeedback("Pedido enviado a cocina correctamente.");
    } catch (error) {
      setMutationError(errorMessage(error, "No fue posible enviar el pedido a cocina."));
      await loadOrder(order.id);
      await refreshAfterMutation();
    } finally {
      setMutationKey("");
    }
  }

  function saveGuestCount() {
    if (!order || !canManage) return;
    const raw = orderGuestCountDraft.trim();
    const guestCount = raw === "" ? null : Number(raw);
    if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount <= 0)) {
      setMutationError("El número de comensales debe ser un entero mayor que 0 o quedar vacío.");
      return;
    }
    void applyOrderMutation(
      "guest-count",
      () => apiFetch<SalesOrder>(`/sales/orders/${order.id}/guest-count`, {
        method: "PATCH",
        json: { guestCount },
      }),
      "No fue posible actualizar el número de comensales.",
    );
  }

  async function cancelOrder() {
    if (!order || !canManage || order.status !== "OPEN" || mutationKey) return;
    const reason = cancellationReason.trim();
    if (!reason) {
      setMutationError("El motivo de cancelación es obligatorio.");
      return;
    }
    setMutationKey("cancel-order");
    setMutationError("");
    try {
      const cancelled = await apiFetch<SalesOrder>(
        `/sales/orders/${order.id}/cancel`,
        { method: "POST", json: { reason } },
      );
      setOrder(cancelled);
      setCancellationDialogOpen(false);
      setCancellationReason("");
      await refreshAfterMutation();
    } catch (error) {
      setMutationError(errorMessage(error, "No fue posible cancelar el pedido."));
    } finally {
      setMutationKey("");
    }
  }

  function renderOrderItem(item: SalesOrderItem | SalesOrderAddition, isAddition = false) {
    const additions = !isAddition && "additions" in item ? item.additions ?? [] : [];
    const lineKitchenLabel = item.kitchenDeliveredAt
      ? "Entregado"
      : item.kitchenStatus === "READY"
        ? "Listo para recoger"
        : item.kitchenStatus
          ? `Cocina: ${kitchenStatusLabels[item.kitchenStatus]}`
          : "Enviado a cocina";

    return (
      <li key={item.id} className={isAddition ? "ml-5 border-l-2 border-slate-200 pl-4" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{isAddition ? "+ " : ""}{item.name}</p>
            <p className="text-sm text-slate-600">
              {item.quantity} × {formatMoney(item.unitPrice, item.currency)}
            </p>
          </div>
          <p className="font-semibold text-slate-900">{formatMoney(item.lineSubtotal, item.currency)}</p>
        </div>
        {item.specialInstructions && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Indicaciones: {item.specialInstructions}
          </p>
        )}
        <div className="mt-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            item.kitchenDispatched
              ? "bg-blue-100 text-blue-800"
              : "bg-amber-100 text-amber-900"
          }`}>
            {item.kitchenDispatched
              ? lineKitchenLabel
              : "Pendiente de enviar"}
          </span>
        </div>
        {canManage && order?.status === "OPEN" && !item.kitchenDispatched && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              disabled={Boolean(mutationKey)}
              onClick={() => updateQuantity(item, item.quantity - 1)}
            >−</button>
            <span className="min-w-8 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              disabled={Boolean(mutationKey)}
              onClick={() => updateQuantity(item, item.quantity + 1)}
            >+</button>
            <button
              type="button"
              className="ml-auto rounded border border-red-200 px-2 py-1 text-sm text-red-700"
              disabled={Boolean(mutationKey)}
              onClick={() => removeItem(item)}
            >Eliminar</button>
          </div>
        )}
        {canManage && order?.status === "OPEN" && !item.kitchenDispatched && (
          <div className="mt-2 flex gap-2">
            <input
              aria-label={`Indicaciones para ${item.name}`}
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={instructionDrafts[item.id] ?? ""}
              maxLength={500}
              onChange={event => setInstructionDrafts(current => ({
                ...current,
                [item.id]: event.target.value,
              }))}
            />
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={Boolean(mutationKey)}
              onClick={() => saveInstructions(item)}
            >Guardar</button>
          </div>
        )}
        {!isAddition && additions.length > 0 && (
          <ul className="mt-3 space-y-3" aria-label={`Adiciones de ${item.name}`}>
            {additions.map(addition => renderOrderItem(addition, true))}
          </ul>
        )}
      </li>
    );
  }

  if (!permissionReady) {
    return <DashboardLayout><div className="p-6 text-slate-600">Cargando mesas...</div></DashboardLayout>;
  }

  if (!canRead) {
    return (
      <DashboardLayout>
        <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          No tienes permiso para consultar mesas y pedidos.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Ventas / Mesas y pedidos</p>
            <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Mesas y pedidos</h1>
            <p className="mt-2 text-slate-600">Control operativo del salón y pedidos abiertos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {refreshingTables && <span className="text-sm text-slate-500">Actualizando...</span>}
            {canConfigureTables && (
              <button
                type="button"
                className="rounded-lg border border-[#001F3F] px-4 py-2 text-sm font-semibold text-[#001F3F] hover:bg-blue-50"
                onClick={() => void router.push("/sales/tables")}
              >Configurar mesas</button>
            )}
          </div>
        </div>

        {pageError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{pageError}</div>}
        {mutationError && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">{mutationError}</div>}
        {kitchenFeedback && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{kitchenFeedback}</div>}

        <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium ${selectedArea === "all" ? "bg-[#001F3F] text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setSelectedArea("all")}
          >Todas</button>
          {areas.map(area => (
            <button
              key={area}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium ${selectedArea === area ? "bg-[#001F3F] text-white" : "bg-slate-100 text-slate-700"}`}
              onClick={() => setSelectedArea(area)}
            >{area}</button>
          ))}
        </div>

        {loadingTables ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600">Cargando mesas...</div>
        ) : tables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">No hay mesas configuradas.</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Mesas del restaurante</h2>
                  <p className="text-sm text-slate-500">Estado operativo informado por el servidor.</p>
                </div>
                <span className="text-sm text-slate-500">{visibleTables.length} mesas</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleTables.map(table => (
                  <article
                    key={table.id}
                    className={`rounded-xl border-2 p-4 ${selectedTableId === table.id ? "border-blue-500" : "border-slate-200"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Mesa {table.code}</h3>
                        <p className="text-sm text-slate-500">{table.area ?? "Sin área"} · {table.capacity} puestos</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[table.operationalStatus]}`}>
                        {statusLabels[table.operationalStatus]}
                      </span>
                    </div>
                    {table.activeOrder && (
                      <div className="mt-3 text-sm text-slate-600">
                        <p>Pedido #{table.activeOrder.id}</p>
                        <p>{table.activeOrder.guestCount ?? "Sin"} comensales</p>
                        <p>Abrió: {table.activeOrder.openedBy.fullName ?? "Usuario"}</p>
                        {table.activeOrder.billRequestedAt && <p className="font-medium text-amber-700">Cuenta solicitada</p>}
                        {kitchenSummaryLabel(table.activeOrder) && (
                          <p className="mt-2 font-semibold text-violet-700">
                            Cocina: {kitchenSummaryLabel(table.activeOrder)}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-4">
                      {table.operationalStatus === "AVAILABLE" && canManage && (
                        <button
                          type="button"
                          className="w-full rounded-lg bg-[#001F3F] px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => {
                            setOpeningTableId(table.id);
                            setGuestCountDraft("");
                            setMutationError("");
                          }}
                        >Abrir mesa</button>
                      )}
                      {table.operationalStatus === "OCCUPIED" && table.activeOrder && (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[#001F3F] px-3 py-2 text-sm font-semibold text-[#001F3F]"
                          onClick={() => void handleSelectTable(table)}
                        >Ver pedido</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {loadingOrder ? (
                <p className="text-slate-600">Cargando pedido...</p>
              ) : orderError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{orderError}</div>
              ) : order ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">Mesa {order.table.code}</p>
                      <h2 className="text-xl font-bold text-slate-900">Pedido #{order.id}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      order.status === "VOIDED"
                        ? "bg-red-100 text-red-800"
                        : order.status === "SETTLED"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-blue-100 text-blue-800"
                    }`}>
                      {order.status === "VOIDED" ? "Cancelado" : order.status === "SETTLED" ? "Cerrado" : "Abierto"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1 border-b border-slate-200 pb-4 text-sm text-slate-600">
                    <p>Área: {order.table.area ?? "Sin área"}</p>
                    <p>Mesero: {order.openedBy.fullName ?? "Usuario"}</p>
                    {canManage && order.status === "OPEN" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="order-guest-count">Comensales:</label>
                        <input
                          id="order-guest-count"
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label="Número de comensales del pedido"
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
                          value={orderGuestCountDraft}
                          onChange={event => setOrderGuestCountDraft(event.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          disabled={Boolean(mutationKey)}
                          onClick={saveGuestCount}
                        >Guardar comensales</button>
                      </div>
                    ) : (
                      <p>Comensales: {order.guestCount ?? "Sin definir"}</p>
                    )}
                    <p>Abierto: {formatDate(order.openedAt)}</p>
                    {order.billRequestedAt && <p className="font-semibold text-amber-700">Cuenta solicitada</p>}
                    {kitchenSummaryLabel(order) && (
                      <p className="font-semibold text-violet-700">
                        Cocina: {kitchenSummaryLabel(order)}
                      </p>
                    )}
                  </div>
                  {order.items.length === 0 ? (
                    <div className="py-8 text-center text-slate-600">
                      <p>Este pedido aún no tiene productos.</p>
                      {order.status === "OPEN" && <button
                        type="button"
                        className="mt-4 rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white"
                        onClick={() => void router.push(`/sales/menu?orderId=${order.id}`)}
                      >Agregar productos</button>}
                    </div>
                  ) : (
                    <ul className="my-5 space-y-5">{order.items.map(item => renderOrderItem(item))}</ul>
                  )}
                  <ServiceTraceability
                    dispatches={order.kitchenDispatches}
                    cancellation={{
                      cancelledAt: order.cancelledAt,
                      cancelledBy: order.cancelledBy,
                      cancellationReason: order.cancellationReason,
                      cancellationAcknowledgedAt: order.cancellationAcknowledgedAt,
                      cancellationAcknowledgedBy: order.cancellationAcknowledgedBy,
                    }}
                  />
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatMoney(order.totals.subtotal, order.totals.currency)}</span></div>
                    <div className="mt-1 flex justify-between text-lg font-bold text-slate-900"><span>Total</span><span>{formatMoney(order.totals.total, order.totals.currency)}</span></div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2">
                    {order.status === "OPEN" && <button
                      type="button"
                      className="rounded-lg bg-[#001F3F] px-4 py-3 font-semibold text-white"
                      onClick={() => void router.push(`/sales/menu?orderId=${order.id}`)}
                    >Agregar productos</button>}
                    {canManage && order.status === "OPEN" && (
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                        disabled={!order.hasPendingKitchenItems || Boolean(mutationKey)}
                        onClick={() => void sendToKitchen()}
                      >
                        {mutationKey === "send-kitchen"
                          ? "Enviando a cocina..."
                          : order.hasPendingKitchenItems
                            ? "Enviar a cocina"
                            : "Todo enviado a cocina"}
                      </button>
                    )}
                    {canManage && order.status === "OPEN" && !order.billRequestedAt && (
                      <button
                        type="button"
                        className="rounded-lg border border-[#001F3F] px-4 py-3 font-semibold text-[#001F3F]"
                        disabled={Boolean(mutationKey)}
                        onClick={requestBill}
                      >Pedir cuenta</button>
                    )}
                    {canManage && order.status === "OPEN" && (
                      <button
                        type="button"
                        className="rounded-lg border border-red-600 px-4 py-3 font-semibold text-red-700"
                        disabled={Boolean(mutationKey)}
                        onClick={() => {
                          setCancellationDialogOpen(true);
                          setCancellationReason("");
                          setMutationError("");
                        }}
                      >Cancelar pedido</button>
                    )}
                  </div>
                </>
              ) : selectedTable ? (
                <div className="py-10 text-center text-slate-600">
                  <h2 className="text-xl font-bold text-slate-900">Mesa {selectedTable.code}</h2>
                  <p className="mt-2">Selecciona una mesa ocupada para ver su pedido.</p>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-600">Selecciona una mesa para consultar su pedido.</div>
              )}
            </aside>
          </div>
        )}

        {openingTableId !== null && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
            <form
              role="dialog"
              aria-label="Abrir mesa"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onSubmit={event => {
                event.preventDefault();
                void handleOpenTable();
              }}
            >
              <h2 className="text-xl font-bold text-slate-900">Abrir mesa</h2>
              <p className="mt-1 text-sm text-slate-600">Número de comensales (opcional).</p>
              <input
                autoFocus
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                aria-label="Número de comensales"
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={guestCountDraft}
                onChange={event => setGuestCountDraft(event.target.value)}
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setOpeningTableId(null)}>Cancelar</button>
                <button type="submit" className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white" disabled={mutationKey === `open-${openingTableId}`}>Abrir mesa</button>
              </div>
            </form>
          </div>
        )}
        {cancellationDialogOpen && order?.status === "OPEN" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <form
              role="dialog"
              aria-label="Cancelar pedido"
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onSubmit={event => {
                event.preventDefault();
                void cancelOrder();
              }}
            >
              <h2 className="text-xl font-bold text-red-800">Cancelar pedido #{order.id}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Cocina recibirá una alerta persistente para detener la preparación.
              </p>
              <label className="mt-4 block text-sm font-semibold text-slate-800">
                Motivo de cancelación
                <textarea
                  autoFocus
                  required
                  maxLength={500}
                  rows={4}
                  value={cancellationReason}
                  onChange={event => setCancellationReason(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2"
                  disabled={mutationKey === "cancel-order"}
                  onClick={() => setCancellationDialogOpen(false)}
                >Volver</button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-800 px-4 py-2 font-bold text-white disabled:opacity-60"
                  disabled={mutationKey === "cancel-order"}
                >{mutationKey === "cancel-order" ? "Cancelando..." : "Confirmar cancelación"}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
