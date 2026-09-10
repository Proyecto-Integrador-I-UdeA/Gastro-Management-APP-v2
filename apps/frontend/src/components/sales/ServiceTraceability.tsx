import { useState } from "react";
import type {
  KitchenDispatchStatus,
  LifecycleActor,
  SalesKitchenDispatchTrace,
} from "@/types/kitchen";

type CancellationTrace = {
  cancelledAt: string | null;
  cancelledBy: LifecycleActor | null;
  cancellationReason: string | null;
  cancellationAcknowledgedAt: string | null;
  cancellationAcknowledgedBy: LifecycleActor | null;
};

type ServiceTraceabilityProps = {
  dispatches: SalesKitchenDispatchTrace[];
  cancellation: CancellationTrace;
};

const statusLabels: Record<KitchenDispatchStatus, string> = {
  NEXT: "Próximo",
  PREPARING: "En preparación",
  READY: "Listo para recoger",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Pendiente";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatDurationBetween(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  const totalSeconds = Math.floor((endMs - startMs) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours > 0 ? `${hours} h` : null,
    minutes > 0 || hours > 0 ? `${minutes} min` : null,
    `${seconds} s`,
  ].filter(Boolean).join(" ");
}

function actorName(actor: LifecycleActor | null): string {
  return actor?.fullName?.trim() || "Actor histórico no disponible";
}

function TraceEvent({
  label,
  timestamp,
  actor,
  cancelled = false,
}: {
  label: string;
  timestamp: string | null;
  actor?: LifecycleActor | null;
  cancelled?: boolean;
}) {
  const completed = timestamp !== null;
  return (
    <li className="relative grid gap-1 pl-5 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${
          cancelled
            ? "bg-red-600"
            : completed ? "bg-emerald-600" : "bg-slate-300"
        }`}
      />
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="min-w-0">
        <p className="break-words text-sm text-slate-600">{formatTimestamp(timestamp)}</p>
        {completed && actor !== undefined && (
          <p className="mt-0.5 break-words text-xs text-slate-500">{actorName(actor)}</p>
        )}
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}

export default function ServiceTraceability({
  dispatches,
  cancellation,
}: ServiceTraceabilityProps) {
  const cancelled = Boolean(cancellation.cancelledAt);
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className="mt-5 border-t border-slate-200 pt-5"
    >
      <button
        type="button"
        aria-controls="service-traceability-panel"
        aria-expanded={expanded}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#001F3F] transition-colors hover:bg-slate-50"
        onClick={() => setExpanded(current => !current)}
      >
        {expanded ? "Ocultar trazabilidad" : "Ver trazabilidad"}
      </button>

      {expanded && (
        <div id="service-traceability-panel" className="mt-4">
          <h2 className="text-lg font-bold text-slate-900">
            Trazabilidad del servicio
          </h2>

      {cancelled && (
        <article
          aria-label="Trazabilidad de cancelación"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
        >
          <h3 className="font-bold uppercase tracking-wide">Pedido cancelado</h3>
          <dl className="mt-2 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Cancelado</dt>
              <dd>{formatTimestamp(cancellation.cancelledAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Por</dt>
              <dd>{actorName(cancellation.cancelledBy)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Motivo</dt>
              <dd className="whitespace-pre-wrap">{cancellation.cancellationReason ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Cocina confirmó</dt>
              <dd>{formatTimestamp(cancellation.cancellationAcknowledgedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Confirmado por</dt>
              <dd>{cancellation.cancellationAcknowledgedAt
                ? actorName(cancellation.cancellationAcknowledgedBy)
                : "Pendiente"}</dd>
            </div>
          </dl>
        </article>
      )}

      {dispatches.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          La orden todavía no tiene envíos a cocina.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {dispatches.map(dispatch => {
            const displayStatus = dispatch.deliveredAt
              ? "Entregado"
              : cancelled ? "Cancelado" : statusLabels[dispatch.status];
            return (
              <article
                key={dispatch.id}
                aria-label={`Trazabilidad del ticket ${dispatch.dispatchNumber}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-900">
                    Ticket #{dispatch.dispatchNumber}
                  </h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    dispatch.deliveredAt
                      ? "bg-emerald-100 text-emerald-800"
                      : cancelled
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                  }`}>
                    {displayStatus}
                  </span>
                </div>

                <ol className="mt-3 space-y-4 border-l border-slate-200 pl-3">
                  <TraceEvent
                    label="Enviado a cocina"
                    timestamp={dispatch.dispatchedAt}
                    actor={dispatch.dispatchedBy}
                  />
                  <TraceEvent
                    label="Inicio preparación"
                    timestamp={dispatch.startedAt}
                    actor={dispatch.startedBy}
                  />
                  <TraceEvent
                    label="Listo para recoger"
                    timestamp={dispatch.readyAt}
                    actor={dispatch.readyBy}
                  />
                  <TraceEvent
                    label="Entregado"
                    timestamp={dispatch.deliveredAt}
                    actor={dispatch.deliveredBy}
                  />
                  {cancelled && !dispatch.deliveredAt && (
                    <TraceEvent
                      label="Cancelación del pedido"
                      timestamp={cancellation.cancelledAt}
                      actor={cancellation.cancelledBy}
                      cancelled
                    />
                  )}
                </ol>

                <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs">
                  <Metric
                    label="Tiempo hasta iniciar"
                    value={formatDurationBetween(dispatch.dispatchedAt, dispatch.startedAt)}
                  />
                  <Metric
                    label="Preparación"
                    value={formatDurationBetween(dispatch.startedAt, dispatch.readyAt)}
                  />
                  <Metric
                    label="Total en cocina"
                    value={formatDurationBetween(dispatch.dispatchedAt, dispatch.readyAt)}
                  />
                  <Metric
                    label="Espera para entrega"
                    value={formatDurationBetween(dispatch.readyAt, dispatch.deliveredAt)}
                  />
                  <Metric
                    label="Total hasta entrega"
                    value={formatDurationBetween(dispatch.dispatchedAt, dispatch.deliveredAt)}
                  />
                </dl>
              </article>
            );
          })}
        </div>
      )}
        </div>
      )}
    </section>
  );
}
