import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadyPickupNotifier from "@/components/kitchen/ReadyPickupNotifier";
import type { ReadyKitchenPickup } from "@/types/kitchen";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
  router: { pathname: "/sales/orders" },
  speak: vi.fn(),
}));

vi.mock("@/utils/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ ...mocks.router, push: mocks.push }),
}));

class SpeechMessage {
  text: string;
  lang = "";

  constructor(text: string) {
    this.text = text;
  }
}

const pickup: ReadyKitchenPickup = {
  dispatchId: 25,
  salesOrderId: 123,
  orderNumber: 123,
  table: { id: 3, code: "3", area: "Salón" },
  status: "READY",
  readyAt: "2026-09-09T17:17:00.000Z",
  deliveredAt: null,
  cancelled: false,
};

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.router.pathname = "/sales/orders";
  mocks.getUserPermissions.mockReturnValue(["sales.read", "sales.manage"]);
  mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
    if (path === "/sales/kitchen-ready-pickups" && !options?.method) {
      return Promise.resolve({ pickups: [pickup] });
    }
    if (
      path === "/sales/orders/123/kitchen-dispatches/25/deliver"
      && options?.method === "POST"
    ) {
      return Promise.resolve({ dispatchId: 25, deliveredAt: new Date().toISOString() });
    }
    return Promise.reject(new Error("Ruta inesperada"));
  });
  vi.stubGlobal("SpeechSynthesisUtterance", SpeechMessage);
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { speak: mocks.speak },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("notificador global de pedidos listos", () => {
  it("muestra el aviso visual en Ventas sin requerir kitchen.read", async () => {
    mocks.getUserPermissions.mockReturnValue(["sales.read"]);
    render(<ReadyPickupNotifier />);

    const notice = await screen.findByLabelText("Pedido listo de mesa 3");
    expect(notice).toHaveTextContent("Pedido listo para recoger");
    expect(notice).toHaveTextContent("Mesa 3");
    expect(notice).toHaveTextContent("Pedido #123");
    expect(mocks.speak).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Marcar como entregado" }))
      .not.toBeInTheDocument();
  });

  it("no activa el sondeo fuera de Ventas ni sin sales.read", async () => {
    mocks.router.pathname = "/kitchen";
    const first = render(<ReadyPickupNotifier />);
    await act(async () => Promise.resolve());
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    first.unmount();

    mocks.router.pathname = "/sales";
    mocks.getUserPermissions.mockReturnValue([]);
    render(<ReadyPickupNotifier />);
    await act(async () => Promise.resolve());
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("habla una sola vez por dispatchId + readyAt e incluye la mesa", async () => {
    vi.useFakeTimers();
    render(<ReadyPickupNotifier />);
    await act(async () => Promise.resolve());

    const soundButton = screen.getByRole("button", {
      name: "Activar alertas sonoras",
    });
    fireEvent.click(soundButton);
    await act(async () => Promise.resolve());
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    const firstMessage = mocks.speak.mock.calls[0][0] as SpeechMessage;
    expect(firstMessage.text).toBe("El pedido de la mesa 3 está listo para recoger.");
    expect(firstMessage.lang).toBe("es-CO");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(mocks.speak).toHaveBeenCalledTimes(1);
  });

  it("no suprime un nuevo READY del mismo dispatch con otro readyAt", async () => {
    sessionStorage.setItem(
      "gma:kitchen-ready-sound-enabled",
      "true",
    );
    sessionStorage.setItem(
      "gma:kitchen-ready-announced",
      JSON.stringify([`${pickup.dispatchId}:${pickup.readyAt}`]),
    );
    const newer = { ...pickup, readyAt: "2026-09-09T17:20:00.000Z" };
    mocks.apiFetch.mockResolvedValue({ pickups: [newer] });
    render(<ReadyPickupNotifier />);

    await waitFor(() => expect(mocks.speak).toHaveBeenCalledTimes(1));
  });

  it("no anuncia desde una instancia desmontada durante navegación", async () => {
    sessionStorage.setItem("gma:kitchen-ready-sound-enabled", "true");
    let resolveFirst: ((value: { pickups: ReadyKitchenPickup[] }) => void) | undefined;
    mocks.apiFetch.mockImplementationOnce(() => new Promise(resolve => {
      resolveFirst = resolve;
    }));

    const first = render(<ReadyPickupNotifier />);
    await act(async () => Promise.resolve());
    first.unmount();

    mocks.apiFetch.mockResolvedValue({ pickups: [pickup] });
    render(<ReadyPickupNotifier />);
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveFirst?.({ pickups: [pickup] });
      await Promise.resolve();
    });
    expect(mocks.speak).toHaveBeenCalledTimes(1);
  });

  it("confirma la entrega con el id correcto y retira el aviso", async () => {
    const user = userEvent.setup();
    render(<ReadyPickupNotifier />);
    await user.click(await screen.findByRole("button", { name: "Marcar como entregado" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/sales/orders/123/kitchen-dispatches/25/deliver",
      { method: "POST", json: {} },
    ));
    expect(screen.queryByLabelText("Pedido listo de mesa 3")).not.toBeInTheDocument();
  });

  it("navega al pedido profundo desde la notificación", async () => {
    const user = userEvent.setup();
    render(<ReadyPickupNotifier />);
    await user.click(await screen.findByRole("button", { name: "Ver pedido" }));
    expect(mocks.push).toHaveBeenCalledWith("/sales/orders?orderId=123");
  });
});
