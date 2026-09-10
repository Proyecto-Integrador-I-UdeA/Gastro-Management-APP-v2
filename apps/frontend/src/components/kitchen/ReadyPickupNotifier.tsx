"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import type {
  ReadyKitchenPickup,
  ReadyKitchenPickupsResponse,
} from "@/types/kitchen";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

const ANNOUNCED_EVENTS_KEY = "gma:kitchen-ready-announced";
const ALERT_RETRY_MS = 30_000;
const MAX_ALERT_ATTEMPTS = 3;

type AlertSequence = {
  startedAt: number;
  attempts: number;
};

function pickupEventKey(pickup: ReadyKitchenPickup): string {
  return `${pickup.dispatchId}:${pickup.readyAt}`;
}

function readAnnouncedEvents(): Set<string> {
  try {
    const raw = sessionStorage.getItem(ANNOUNCED_EVENTS_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function rememberAnnouncedEvents(events: Set<string>) {
  try {
    sessionStorage.setItem(ANNOUNCED_EVENTS_KEY, JSON.stringify(Array.from(events)));
  } catch {
    // La notificación visual continúa aunque el almacenamiento esté bloqueado.
  }
}

function formatReadyAt(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isRelevantPickup(pickup: ReadyKitchenPickup): boolean {
  return pickup.status === "READY"
    && pickup.deliveredAt === null
    && !pickup.cancelled;
}

function tryAnnouncePickup(pickup: ReadyKitchenPickup) {
  if (
    !("speechSynthesis" in window)
    || typeof SpeechSynthesisUtterance === "undefined"
  ) return;

  try {
    const message = new SpeechSynthesisUtterance(
      `El pedido de la mesa ${pickup.table.code} está listo para recoger.`,
    );
    message.lang = "es-CO";
    window.speechSynthesis.speak(message);
  } catch {
    // El aviso visual permanece disponible si el navegador bloquea la voz.
  }
}

export default function ReadyPickupNotifier() {
  const router = useRouter();
  const [pickups, setPickups] = useState<ReadyKitchenPickup[]>([]);
  const [error, setError] = useState("");
  const [deliveringId, setDeliveringId] = useState<number | null>(null);
  const requestInFlight = useRef(false);
  const mountedRef = useRef(false);
  const announcedEventsRef = useRef<Set<string>>(new Set());
  const alertSequencesRef = useRef<Map<string, AlertSequence>>(new Map());
  const permissions = getUserPermissions();
  const active = router.pathname.startsWith("/sales")
    && permissions.includes("sales.read");
  const canDeliver = permissions.includes("sales.manage");

  const announceReadyPickups = useCallback((nextPickups: ReadyKitchenPickup[]) => {
    const relevantPickups = nextPickups.filter(isRelevantPickup);
    const relevantKeys = new Set(relevantPickups.map(pickupEventKey));
    alertSequencesRef.current.forEach((_sequence, key) => {
      if (!relevantKeys.has(key)) alertSequencesRef.current.delete(key);
    });

    const announced = announcedEventsRef.current;
    const now = Date.now();
    let changedStoredEvents = false;

    for (const pickup of relevantPickups) {
      const key = pickupEventKey(pickup);
      let sequence = alertSequencesRef.current.get(key);

      if (!sequence) {
        if (announced.has(key)) continue;
        sequence = { startedAt: now, attempts: 0 };
        alertSequencesRef.current.set(key, sequence);
        announced.add(key);
        changedStoredEvents = true;
      }

      const nextAttemptAt = sequence.startedAt + sequence.attempts * ALERT_RETRY_MS;
      if (sequence.attempts >= MAX_ALERT_ATTEMPTS || now < nextAttemptAt) continue;

      tryAnnouncePickup(pickup);
      sequence.attempts += 1;
    }

    if (changedStoredEvents) rememberAnnouncedEvents(announced);
  }, []);

  const loadPickups = useCallback(async () => {
    if (!active || requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      const response = await apiFetch<ReadyKitchenPickupsResponse>(
        "/sales/kitchen-ready-pickups",
      );
      if (!mountedRef.current) return;
      setPickups(response.pickups);
      announceReadyPickups(response.pickups);
      setError("");
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError(requestError instanceof Error
        ? requestError.message
        : "No fue posible actualizar los pedidos listos.");
    } finally {
      requestInFlight.current = false;
    }
  }, [active, announceReadyPickups]);

  useEffect(() => {
    mountedRef.current = true;
    announcedEventsRef.current = readAnnouncedEvents();
    return () => {
      mountedRef.current = false;
      alertSequencesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setPickups([]);
      return undefined;
    }
    void loadPickups();
    const interval = window.setInterval(() => void loadPickups(), 10_000);
    return () => window.clearInterval(interval);
  }, [active, loadPickups]);

  async function deliver(pickup: ReadyKitchenPickup) {
    if (deliveringId !== null) return;
    setDeliveringId(pickup.dispatchId);
    setError("");
    try {
      await apiFetch(
        `/sales/orders/${pickup.salesOrderId}/kitchen-dispatches/${pickup.dispatchId}/deliver`,
        { method: "POST", json: {} },
      );
      alertSequencesRef.current.delete(pickupEventKey(pickup));
      setPickups(current => current.filter(
        item => item.dispatchId !== pickup.dispatchId,
      ));
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "No fue posible confirmar la entrega.");
      await loadPickups();
    } finally {
      setDeliveringId(null);
    }
  }

  if (!active) return null;

  return (
    <aside
      aria-label="Pedidos listos para recoger"
      className="fixed right-4 top-20 z-40 w-[min(24rem,calc(100vw-2rem))] space-y-3"
    >
      {error && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg">
          {error}
        </div>
      )}
      {pickups.map(pickup => (
        <article
          key={pickupEventKey(pickup)}
          role="status"
          className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-emerald-950 shadow-xl"
          aria-label={`Pedido listo de mesa ${pickup.table.code}`}
        >
          <p className="text-xs font-black uppercase tracking-wider">
            Pedido listo para recoger
          </p>
          <h2 className="mt-1 text-xl font-black">Mesa {pickup.table.code}</h2>
          <p className="text-sm">
            Pedido #{pickup.orderNumber} · Listo desde {formatReadyAt(pickup.readyAt)}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-emerald-700 bg-white px-3 py-2 text-sm font-bold text-emerald-900"
              onClick={() => void router.push(`/sales/orders?orderId=${pickup.salesOrderId}`)}
            >
              Ver pedido
            </button>
            {canDeliver && (
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                disabled={deliveringId !== null}
                onClick={() => void deliver(pickup)}
              >
                {deliveringId === pickup.dispatchId
                  ? "Confirmando..."
                  : "Marcar como entregado"}
              </button>
            )}
          </div>
        </article>
      ))}
    </aside>
  );
}
