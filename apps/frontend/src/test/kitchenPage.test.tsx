import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenPage from "@/pages/kitchen";
import type { KitchenDispatch } from "@/types/kitchen";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("@/utils/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function dispatch(
  id: number,
  status: KitchenDispatch["status"],
  targetOffsetMinutes: number,
): KitchenDispatch {
  const now = Date.now();
  return {
    id,
    dispatchNumber: id,
    orderId: 20 + id,
    orderNumber: 20 + id,
    orderOpenedAt: new Date(now - 20 * 60_000).toISOString(),
    table: { id, code: `M-${id}`, area: "Salón principal" },
    status,
    dispatchedBy: { id: 7, fullName: "Laura" },
    dispatchedAt: new Date(now - 2 * 60_000).toISOString(),
    prepTimeMinutesSnapshot: 15,
    warningThresholdMinutes: 5,
    targetReadyAt: new Date(now + targetOffsetMinutes * 60_000).toISOString(),
    startedAt: status === "NEXT" ? null : new Date(now - 60_000).toISOString(),
    readyAt: status === "READY" ? new Date(now).toISOString() : null,
    items: [{
      id: id * 10,
      salesOrderItemId: id * 100,
      name: "Hamburguesa especial",
      quantity: 2,
      specialInstructions: "Sin cebolla",
      additions: [{
        id: id * 10 + 1,
        salesOrderItemId: id * 100 + 1,
        name: "Queso adicional",
        quantity: 2,
        specialInstructions: "Bien fundido",
      }],
    }],
  };
}

let queue: KitchenDispatch[];

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.getUserPermissions.mockReturnValue(["kitchen.read", "kitchen.manage"]);
  queue = [
    dispatch(1, "NEXT", 10),
    dispatch(2, "PREPARING", 5),
    dispatch(3, "READY", -2),
  ];
  mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
    if (path === "/kitchen/dispatches" && !options?.method) {
      return Promise.resolve({ dispatches: queue });
    }
    const match = path.match(/^\/kitchen\/dispatches\/(\d+)\/status$/);
    if (match && options?.method === "PATCH") {
      const id = Number(match[1]);
      const status = (options.json as { status: KitchenDispatch["status"] }).status;
      const updated = { ...queue.find(item => item.id === id)!, status };
      queue = queue.map(item => item.id === id ? updated : item);
      return Promise.resolve(updated);
    }
    return Promise.reject(new Error("Ruta inesperada"));
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pantalla operativa de Cocina", () => {
  it("protege la ruta con kitchen.read", async () => {
    mocks.getUserPermissions.mockReturnValue([]);
    render(<KitchenPage />);

    expect(await screen.findByText("No tienes permiso para consultar la cola de cocina."))
      .toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("agrupa tickets y conserva jerarquía, instrucciones y acciones válidas", async () => {
    render(<KitchenPage />);

    expect(await screen.findByRole("heading", { name: "Próximo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "En preparación" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Listo" })).toBeInTheDocument();
    expect(screen.getAllByText("2 × Hamburguesa especial")).toHaveLength(3);
    expect(screen.getAllByText("+ Queso adicional ×2")).toHaveLength(3);
    expect(screen.getAllByText("Indicaciones: Sin cebolla")).toHaveLength(3);
    expect(screen.getAllByText("Indicaciones: Bien fundido")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Iniciar preparación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como listo" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Ticket de cocina 3"))
      .queryByRole("button")).not.toBeInTheDocument();
  });

  it("muestra SLA solo en NEXT y PREPARING, y readyAt al completar", async () => {
    const readyAt = "2026-09-09T17:17:00.000Z";
    queue = queue.map(item => item.status === "READY"
      ? { ...item, readyAt }
      : item);
    render(<KitchenPage />);

    const nextTicket = await screen.findByLabelText("Ticket de cocina 1");
    const preparingTicket = screen.getByLabelText("Ticket de cocina 2");
    const readyTicket = screen.getByLabelText("Ticket de cocina 3");
    const formattedReadyAt = new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(readyAt));

    expect(within(nextTicket).getByLabelText(/Tiempo del ticket:/)).toBeInTheDocument();
    expect(within(preparingTicket).getByLabelText(/Tiempo del ticket:/)).toBeInTheDocument();
    expect(within(readyTicket).queryByLabelText(/Tiempo del ticket:/)).not.toBeInTheDocument();
    expect(within(readyTicket).queryByText(/Retraso/)).not.toBeInTheDocument();
    expect(within(readyTicket).getByText(`Listo desde ${formattedReadyAt}`))
      .toBeInTheDocument();
  });

  it("envía la transición correcta y mueve el ticket inmediatamente", async () => {
    const user = userEvent.setup();
    render(<KitchenPage />);
    await user.click(await screen.findByRole("button", { name: "Iniciar preparación" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/kitchen/dispatches/1/status",
      { method: "PATCH", json: { status: "PREPARING" } },
    ));
    expect(within(screen.getByRole("region", { name: "Próximo" }))
      .queryByLabelText("Ticket de cocina 1")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "En preparación" }))
      .getByLabelText("Ticket de cocina 1")).toBeInTheDocument();
  });

  it("reemplaza inmediatamente el contador por readyAt al pasar a READY", async () => {
    const readyAt = "2026-09-09T17:17:00.000Z";
    queue = [dispatch(2, "PREPARING", 5)];
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
      if (path === "/kitchen/dispatches" && !options?.method) {
        return Promise.resolve({ dispatches: queue });
      }
      if (path === "/kitchen/dispatches/2/status" && options?.method === "PATCH") {
        const updated = { ...queue[0], status: "READY" as const, readyAt };
        queue = [updated];
        return Promise.resolve(updated);
      }
      return Promise.reject(new Error("Ruta inesperada"));
    });
    const user = userEvent.setup();
    render(<KitchenPage />);

    const preparingTicket = await screen.findByLabelText("Ticket de cocina 2");
    expect(within(preparingTicket).getByLabelText(/Tiempo del ticket:/)).toBeInTheDocument();
    await user.click(within(preparingTicket).getByRole("button", { name: "Marcar como listo" }));

    const readyTicket = await screen.findByLabelText("Ticket de cocina 2");
    const formattedReadyAt = new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(readyAt));
    expect(within(readyTicket).queryByLabelText(/Tiempo del ticket:/)).not.toBeInTheDocument();
    expect(within(readyTicket).queryByText(/Retraso/)).not.toBeInTheDocument();
    expect(within(readyTicket).getByText(`Listo desde ${formattedReadyAt}`))
      .toBeInTheDocument();
  });

  it("mantiene la cola en modo lectura sin exponer mutaciones", async () => {
    mocks.getUserPermissions.mockReturnValue(["kitchen.read"]);
    render(<KitchenPage />);

    expect(await screen.findByLabelText("Ticket de cocina 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar preparación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como listo" })).not.toBeInTheDocument();
  });

  it("muestra el estado vacío intencional", async () => {
    queue = [];
    render(<KitchenPage />);
    expect(await screen.findByText("No hay pedidos pendientes en cocina."))
      .toBeInTheDocument();
  });

  it("presenta errores controlados sin payload técnico", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"));
    render(<KitchenPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servicio temporalmente no disponible",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("actualiza la cola cada diez segundos sin recargar la página", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<KitchenPage />);
    await act(async () => Promise.resolve());
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    unmount();
    act(() => vi.advanceTimersByTime(10_000));
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });

  it("no permite que un GET de polling antiguo revierta una transición confirmada", async () => {
    vi.useFakeTimers();
    let resolveStale!: (value: { dispatches: KitchenDispatch[] }) => void;
    const staleResponse = new Promise<{ dispatches: KitchenDispatch[] }>(resolve => {
      resolveStale = resolve;
    });
    let getCount = 0;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit & { json?: unknown }) => {
      if (path === "/kitchen/dispatches" && !options?.method) {
        getCount += 1;
        return getCount === 1
          ? Promise.resolve({ dispatches: queue })
          : staleResponse;
      }
      if (path === "/kitchen/dispatches/1/status" && options?.method === "PATCH") {
        return Promise.resolve({ ...queue[0], status: "PREPARING" });
      }
      return Promise.reject(new Error("Ruta inesperada"));
    });

    render(<KitchenPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(getCount).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar preparación" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    resolveStale({ dispatches: queue });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(within(screen.getByRole("region", { name: "En preparación" }))
      .getByLabelText("Ticket de cocina 1")).toBeInTheDocument();
  });
});
