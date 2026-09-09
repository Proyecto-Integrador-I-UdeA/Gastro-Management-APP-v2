"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import type {
  KitchenDispatch,
  KitchenDispatchStatus,
  KitchenCancellationAlert,
  KitchenQueueResponse,
} from "@/types/kitchen";
import { apiFetch } from "@/utils/apiFetch";
import { getKitchenTimer } from "@/utils/kitchenTimer";
import { getUserPermissions } from "@/utils/permissions";

type ApiError = Error & {
  body?: { code?: string };
};

const columns: Array<{
  status: KitchenDispatchStatus;
  title: string;
  accent: string;
  surface: string;
}> = [
  {
    status: "NEXT",
    title: "Próximo",
    accent: "border-blue-500",
    surface: "bg-blue-50/70",
  },
  {
    status: "PREPARING",
    title: "En preparación",
    accent: "border-violet-500",
    surface: "bg-violet-50/70",
  },
  {
    status: "READY",
    title: "Listo",
    accent: "border-emerald-500",
    surface: "bg-emerald-50/70",
  },
];

const statusLabels: Record<KitchenDispatchStatus, string> = {
  NEXT: "Próximo",
  PREPARING: "En preparación",
  READY: "Listo",
};

function kitchenErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  const messages: Record<string, string> = {
    KITCHEN_DISPATCH_NOT_FOUND: "El pedido ya no está disponible en la cola.",
    INVALID_KITCHEN_STATUS_TRANSITION:
      "El estado cambió en otra pantalla. La cola se actualizará automáticamente.",
    ORDER_CANCELLED: "El pedido fue cancelado. Confirma la alerta de cancelación.",
    KITCHEN_CANCELLATION_NOT_FOUND:
      "La cancelación ya fue confirmada en otra pantalla.",
  };
  return (apiError.body?.code && messages[apiError.body.code])
    || apiError.message
    || fallback;
}

function formatDispatchTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function KitchenPage() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionReady, setPermissionReady] = useState(false);
  const [dispatches, setDispatches] = useState<KitchenDispatch[]>([]);
  const [cancellations, setCancellations] = useState<KitchenCancellationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [backgroundError, setBackgroundError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [acknowledgingOrderId, setAcknowledgingOrderId] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const requestInFlight = useRef(false);
  const queueRevisionRef = useRef(0);

  const canRead = permissions.includes("kitchen.read");
  const canManage = permissions.includes("kitchen.manage");

  const loadQueue = useCallback(async (background = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (!background) setLoading(true);
    const requestRevision = queueRevisionRef.current;
    try {
      const response = await apiFetch<KitchenQueueResponse>("/kitchen/dispatches");
      if (requestRevision !== queueRevisionRef.current) return;
      setDispatches(response.dispatches.filter(dispatch => dispatch.deliveredAt === null));
      setCancellations(response.cancellations ?? []);
      setPageError("");
      setBackgroundError("");
    } catch (error) {
      const message = kitchenErrorMessage(error, "No fue posible cargar la cola de cocina.");
      if (background) setBackgroundError(message);
      else setPageError(message);
    } finally {
      requestInFlight.current = false;
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPermissions(getUserPermissions());
    setPermissionReady(true);
  }, []);

  useEffect(() => {
    if (!permissionReady || !canRead) return undefined;
    void loadQueue();
    const pollingInterval = window.setInterval(() => void loadQueue(true), 10_000);
    return () => window.clearInterval(pollingInterval);
  }, [canRead, loadQueue, permissionReady]);

  useEffect(() => {
    if (!dispatches.some(dispatch => dispatch.status !== "READY")) return undefined;
    const timerInterval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timerInterval);
  }, [dispatches]);

  async function acknowledgeCancellation(cancellation: KitchenCancellationAlert) {
    if (!canManage || acknowledgingOrderId !== null) return;
    setAcknowledgingOrderId(cancellation.orderId);
    setBackgroundError("");
    try {
      await apiFetch(
        `/kitchen/cancellations/${cancellation.orderId}/acknowledge`,
        { method: "POST", json: {} },
      );
      queueRevisionRef.current += 1;
      setCancellations(current => current.filter(
        item => item.orderId !== cancellation.orderId,
      ));
    } catch (error) {
      setBackgroundError(kitchenErrorMessage(
        error,
        "No fue posible confirmar la cancelación.",
      ));
      void loadQueue(true);
    } finally {
      setAcknowledgingOrderId(null);
    }
  }

  async function advanceDispatch(dispatch: KitchenDispatch) {
    if (!canManage || updatingId !== null || dispatch.status === "READY") return;
    const nextStatus: KitchenDispatchStatus = dispatch.status === "NEXT"
      ? "PREPARING"
      : "READY";
    setUpdatingId(dispatch.id);
    setBackgroundError("");
    try {
      const updated = await apiFetch<KitchenDispatch>(
        `/kitchen/dispatches/${dispatch.id}/status`,
        { method: "PATCH", json: { status: nextStatus } },
      );
      queueRevisionRef.current += 1;
      setDispatches(current => current.map(item => (
        item.id === updated.id ? updated : item
      )));
    } catch (error) {
      setBackgroundError(kitchenErrorMessage(
        error,
        "No fue posible actualizar el estado del pedido.",
      ));
    } finally {
      setUpdatingId(null);
    }
  }

  function renderTicket(dispatch: KitchenDispatch) {
    const timer = dispatch.status === "READY"
      ? null
      : getKitchenTimer(
          dispatch.targetReadyAt,
          dispatch.warningThresholdMinutes,
          nowMs,
        );
    const timerClass = timer?.state === "overdue"
      ? "bg-red-100 text-red-800"
      : timer?.state === "warning"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
    const readyLabel = dispatch.readyAt
      ? `Listo desde ${formatDispatchTime(dispatch.readyAt)}`
      : "Listo";

    return (
      <article
        key={dispatch.id}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        aria-label={`Ticket de cocina ${dispatch.dispatchNumber}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Mesa {dispatch.table.code}
            </h3>
            <p className="text-xs text-slate-500">
              Pedido #{dispatch.orderNumber} · Ticket #{dispatch.dispatchNumber}
            </p>
            {dispatch.table.area && (
              <p className="mt-1 text-xs text-slate-500">{dispatch.table.area}</p>
            )}
          </div>
          <div className="text-right">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {statusLabels[dispatch.status]}
            </span>
            {timer ? (
              <span
                className={`mt-1 inline-block rounded-full px-3 py-1 font-mono text-sm font-bold ${timerClass}`}
                data-timer-state={timer.state}
                aria-label={`Tiempo del ticket: ${timer.label}`}
              >
                {timer.label}
              </span>
            ) : (
              <span
                className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800"
                aria-label={`Finalización del ticket: ${readyLabel}`}
              >
                {readyLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 border-y border-slate-100 py-1.5 text-xs text-slate-500">
          <p>Enviado: {formatDispatchTime(dispatch.dispatchedAt)}</p>
          <p>Mesero: {dispatch.dispatchedBy.fullName ?? "Usuario"}</p>
        </div>

        <ul className="mt-2 space-y-2">
          {dispatch.items.map(item => (
            <li key={item.id}>
              <p className="font-semibold text-slate-900">
                {item.quantity} × {item.name}
              </p>
              {item.specialInstructions && (
                <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-sm font-medium text-amber-900">
                  Indicaciones: {item.specialInstructions}
                </p>
              )}
              {item.additions.length > 0 && (
                <ul className="mt-2 space-y-1 border-l-2 border-blue-200 pl-3" aria-label={`Adiciones de ${item.name}`}>
                  {item.additions.map(addition => (
                    <li key={addition.id} className="text-sm text-slate-700">
                      <p>+ {addition.name} ×{addition.quantity}</p>
                      {addition.specialInstructions && (
                        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                          Indicaciones: {addition.specialInstructions}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {canManage && dispatch.status !== "READY" && (
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            disabled={updatingId !== null}
            onClick={() => void advanceDispatch(dispatch)}
          >
            {updatingId === dispatch.id
              ? "Actualizando..."
              : dispatch.status === "NEXT"
                ? "Iniciar preparación"
                : "Marcar como listo"}
          </button>
        )}
      </article>
    );
  }

  if (!permissionReady) {
    return <DashboardLayout><div className="p-6 text-slate-600">Cargando cocina...</div></DashboardLayout>;
  }

  if (!canRead) {
    return (
      <DashboardLayout>
        <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          No tienes permiso para consultar la cola de cocina.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <header className="mb-6">
          <p className="text-sm font-medium text-slate-500">Operación / Cocina</p>
          <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Cocina</h1>
          <p className="mt-2 text-slate-600">
            Pedidos activos organizados por avance de preparación.
          </p>
        </header>

        {backgroundError && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {backgroundError}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600">
            Cargando cola de cocina...
          </div>
        ) : pageError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p>{pageError}</p>
            <button
              type="button"
              className="mt-3 font-semibold underline"
              onClick={() => void loadQueue()}
            >
              Reintentar
            </button>
          </div>
        ) : dispatches.length === 0 && cancellations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
            No hay pedidos pendientes en cocina.
          </div>
        ) : (
          <div>
            {cancellations.length > 0 && (
              <section aria-label="Cancelaciones pendientes" className="mb-5 space-y-3">
                {cancellations.map(cancellation => (
                  <article
                    key={cancellation.orderId}
                    role="alert"
                    aria-label={`Pedido cancelado de mesa ${cancellation.table.code}`}
                    className="rounded-2xl border-4 border-red-700 bg-red-50 p-5 text-red-950 shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest">⚠ Pedido cancelado</p>
                        <h2 className="mt-1 text-3xl font-black">Mesa {cancellation.table.code}</h2>
                        <p className="mt-1 text-lg font-extrabold uppercase">Detener preparación</p>
                        <p className="mt-3 font-semibold">Motivo:</p>
                        <p className="whitespace-pre-wrap">{cancellation.cancellationReason}</p>
                        <p className="mt-2 text-sm">
                          Pedido #{cancellation.orderNumber} · {cancellation.affectedDispatches.length} ticket(s) afectado(s)
                        </p>
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          className="rounded-xl bg-red-800 px-5 py-3 font-black text-white disabled:opacity-60"
                          disabled={acknowledgingOrderId !== null}
                          onClick={() => void acknowledgeCancellation(cancellation)}
                        >
                          {acknowledgingOrderId === cancellation.orderId
                            ? "Confirmando..."
                            : "Confirmar cancelación"}
                        </button>
                      ) : (
                        <p className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold">
                          Se requiere kitchen.manage para confirmar.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            )}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {columns.map(column => {
              const tickets = dispatches.filter(dispatch => dispatch.status === column.status);
              return (
                <section
                  key={column.status}
                  className={`flex min-h-48 max-h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 ${column.surface}`}
                  aria-labelledby={`kitchen-${column.status.toLowerCase()}`}
                >
                  <div className={`sticky top-0 z-10 flex items-center justify-between border-t-4 bg-inherit px-4 py-3 ${column.accent}`}>
                    <h2 id={`kitchen-${column.status.toLowerCase()}`} className="text-lg font-bold text-slate-900">
                      {column.title}
                    </h2>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {tickets.length}
                    </span>
                  </div>
                  {tickets.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-500">
                      Sin tickets
                    </p>
                  ) : (
                    <div className="space-y-3 overflow-y-auto px-3 pb-3">{tickets.map(renderTicket)}</div>
                  )}
                </section>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
