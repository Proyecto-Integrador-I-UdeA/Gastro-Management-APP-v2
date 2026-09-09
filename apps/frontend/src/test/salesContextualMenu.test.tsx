import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesMenuCatalogPage from "@/pages/sales/menu";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  router: { query: {} as Record<string, string>, isReady: true, push: vi.fn() },
}));

vi.mock("@/utils/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/utils/permissions", () => ({ getUserPermissions: mocks.getUserPermissions }));
vi.mock("next/router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const item = (overrides: Record<string, unknown>) => ({
  id: 10,
  name: "Hamburguesa clásica",
  description: "Carne y vegetales",
  kind: "STANDARD",
  available: true,
  includedItemsText: null,
  image: null,
  category: { id: 1, name: "Platos fuertes" },
  price: { amount: "20000.00", currency: "COP", taxIncluded: true, validFrom: "2026-09-08T12:00:00.000Z" },
  ...overrides,
});

const catalog = {
  categories: [
    {
      id: 1,
      name: "Platos fuertes",
      displayOrder: 1,
      items: [
        item({}),
        item({ id: 12, name: "Lomo al limón", description: "Salsa cítrica" }),
        item({ id: 13, name: "Pasta marinera", available: false }),
      ],
    },
    {
      id: 2,
      name: "Adiciones",
      displayOrder: 2,
      items: [
        item({ id: 20, name: "Queso adicional", kind: "ADDITION", category: { id: 2, name: "Adiciones" }, price: { amount: "2500.00", currency: "COP", taxIncluded: true, validFrom: "2026-09-08T12:00:00.000Z" } }),
        item({ id: 21, name: "Salsa de ajo", kind: "ADDITION", category: { id: 2, name: "Adiciones" }, price: { amount: "1200.00", currency: "COP", taxIncluded: true, validFrom: "2026-09-08T12:00:00.000Z" } }),
        item({ id: 22, name: "Aguacate", kind: "ADDITION", available: false, category: { id: 2, name: "Adiciones" }, price: { amount: "3000.00", currency: "COP", taxIncluded: true, validFrom: "2026-09-08T12:00:00.000Z" } }),
      ],
    },
  ],
};

const order = {
  id: 123,
  status: "OPEN",
  table: { id: 4, code: "4", area: "Salón", capacity: 4, active: true },
  guestCount: 4,
  openedAt: "2026-09-08T12:00:00.000Z",
  billRequestedAt: "2026-09-08T13:00:00.000Z",
  openedBy: { id: 7, fullName: "Laura" },
  items: [],
  totals: { subtotal: "0.00", total: "0.00", currency: null },
};

const updatedOrder = {
  ...order,
  items: [{
    id: 90,
    menuItemId: 10,
    name: "Hamburguesa clásica",
    quantity: 2,
    specialInstructions: "Sin cebolla",
    unitPrice: "20000.00",
    currency: "COP",
    taxIncluded: true,
    lineSubtotal: "40000.00",
    additions: [],
  }],
  totals: { subtotal: "47400.00", total: "47400.00", currency: "COP" },
};

function defaultApi(path: string, options?: { method?: string }) {
  if (path === "/sales/menu-catalog") return Promise.resolve(catalog);
  if (path === "/sales/orders/123" && !options?.method) return Promise.resolve(order);
  if (path === "/sales/orders/123/items" && options?.method === "POST") return Promise.resolve(updatedOrder);
  throw new Error(`Endpoint inesperado: ${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.router.query = { orderId: "123" };
  mocks.getUserPermissions.mockReturnValue(["sales.read", "sales.manage"]);
  mocks.apiFetch.mockImplementation(defaultApi);
});

describe("menú contextual de ingreso de pedidos", () => {
  it("conserva el catálogo normal cuando no existe orderId", async () => {
    mocks.router.query = {};
    render(<SalesMenuCatalogPage />);

    expect(await screen.findByRole("heading", { name: "Menú y precios" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/sales/menu-catalog");
  });

  it("carga el contexto canónico, mantiene Cuenta solicitada y muestra solo STANDARD como principales", async () => {
    render(<SalesMenuCatalogPage />);

    expect(await screen.findByText(/Mesa 4 · Pedido #123/)).toBeInTheDocument();
    expect(screen.getByText("4 comensales · 0 líneas principales")).toBeInTheDocument();
    expect(screen.getByText("Cuenta solicitada")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Agregar" })[0]).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Pasta marinera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agotado" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Queso adicional" })).not.toBeInTheDocument();
  });

  it("maneja un orderId inválido sin consultar ni sustituir otro pedido", async () => {
    mocks.router.query = { orderId: "abc" };
    render(<SalesMenuCatalogPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("identificador del pedido no es válido");
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/sales\/orders\//));
    await userEvent.click(screen.getByRole("button", { name: "Volver a Mesas y pedidos" }));
    expect(mocks.router.push).toHaveBeenCalledWith("/sales/orders");
  });

  it("aplica búsqueda local acentuada y conserva agotados coincidentes", async () => {
    const user = userEvent.setup();
    render(<SalesMenuCatalogPage />);
    await screen.findByText(/Pedido #123/);

    await user.type(screen.getByRole("searchbox", { name: "Buscar en el menú" }), "limon");
    expect(screen.getByRole("heading", { name: "Lomo al limón" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hamburguesa clásica" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Buscar en el menú" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar en el menú" }), "marinera");
    expect(screen.getByRole("heading", { name: "Pasta marinera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agotado" })).toBeDisabled();
  });

  it("configura cantidad, indicaciones y varias adiciones sin enviar snapshots de cliente", async () => {
    const user = userEvent.setup();
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);

    const dialog = screen.getByRole("dialog", { name: "Configurar Hamburguesa clásica" });
    expect(within(dialog).getByRole("spinbutton", { name: "Cantidad" })).toHaveValue(1);
    expect(within(dialog).getByText(/2[.]500/)).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Seleccionar Aguacate" })).toBeDisabled();

    const quantity = within(dialog).getByRole("spinbutton", { name: "Cantidad" });
    await user.clear(quantity);
    await user.type(quantity, "2");
    await user.type(within(dialog).getByRole("textbox", { name: "Indicaciones especiales" }), "  Sin cebolla  ");
    await user.click(within(dialog).getByRole("checkbox", { name: "Seleccionar Queso adicional" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Seleccionar Salsa de ajo" }));
    await user.click(within(dialog).getByRole("button", { name: "Agregar al pedido" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith("/sales/orders/123/items", {
      method: "POST",
      json: {
        menuItemId: 10,
        quantity: 2,
        specialInstructions: "Sin cebolla",
        additions: [{ menuItemId: 20 }, { menuItemId: 21 }],
      },
    }));
    const payload = mocks.apiFetch.mock.calls.find(([path]) => path === "/sales/orders/123/items")?.[1]?.json;
    expect(payload).not.toHaveProperty("price");
    expect(payload).not.toHaveProperty("currency");
    expect(payload).not.toHaveProperty("taxIncluded");
    expect(payload).not.toHaveProperty("nameSnapshot");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Registrar pedido" })).toBeInTheDocument();
    expect(await screen.findByText(/Total actual: COP 47[.]400/)).toBeInTheDocument();
    expect(screen.getByLabelText("Contexto del pedido")).toHaveTextContent("1 líneas principales");

    const secondProductCard = screen.getByRole("heading", { name: "Lomo al limón" }).closest("article");
    await user.click(within(secondProductCard as HTMLElement).getByRole("button", { name: "Agregar" }));
    expect(screen.getByRole("dialog", { name: "Configurar Lomo al limón" })).toBeInTheDocument();
  });

  it("bloquea cantidad no positiva, decimales e indicaciones mayores a 500", async () => {
    const user = userEvent.setup();
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);
    const dialog = screen.getByRole("dialog");
    const quantity = within(dialog).getByRole("spinbutton", { name: "Cantidad" });

    await user.clear(quantity);
    await user.type(quantity, "0");
    expect(within(dialog).getByText("La cantidad debe ser un entero mayor que 0.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Agregar al pedido" })).toBeDisabled();
    await user.clear(quantity);
    await user.type(quantity, "1.5");
    expect(within(dialog).getByRole("button", { name: "Agregar al pedido" })).toBeDisabled();

    await user.clear(quantity);
    await user.type(quantity, "1");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Indicaciones especiales" }), {
      target: { value: "x".repeat(501) },
    });
    expect(within(dialog).getByText("501/500 caracteres")).toHaveClass("text-red-700");
    expect(within(dialog).getByRole("button", { name: "Agregar al pedido" })).toBeDisabled();
    expect(mocks.apiFetch.mock.calls.some(([path]) => path === "/sales/orders/123/items")).toBe(false);
  });

  it("impide doble envío rápido y permite seleccionar otro producto tras la respuesta", async () => {
    const user = userEvent.setup();
    let resolvePost: (value: unknown) => void = () => undefined;
    const pending = new Promise(resolve => { resolvePost = resolve; });
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/sales/orders/123/items" && options?.method === "POST") return pending;
      return defaultApi(path, options);
    });
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);
    const submit = screen.getByRole("button", { name: "Agregar al pedido" });
    await user.dblClick(submit);
    expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/sales/orders/123/items")).toHaveLength(1);
    resolvePost(updatedOrder);
    expect(await screen.findByText(/Hamburguesa clásica agregado/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Agregar" }).length).toBeGreaterThan(1);
  });

  it("mantiene el contexto ante error genérico y revalida catálogo si el producto se agota", async () => {
    const user = userEvent.setup();
    const unavailable = Object.assign(new Error("raw"), { body: { code: "MENU_ITEM_UNAVAILABLE" } });
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/sales/orders/123/items" && options?.method === "POST") return Promise.reject(unavailable);
      return defaultApi(path, options);
    });
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);
    await user.click(screen.getByRole("button", { name: "Agregar al pedido" }));

    expect(await screen.findByText("El producto acaba de agotarse. Actualizamos el menú.")).toBeInTheDocument();
    expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/sales/menu-catalog").length).toBeGreaterThan(1);
    expect(screen.getByText(/Mesa 4 · Pedido #123/)).toBeInTheDocument();
  });

  it("conserva el pedido cargado ante un fallo genérico de la mutación", async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/sales/orders/123/items" && options?.method === "POST") {
        return Promise.reject(new Error("detalle técnico privado"));
      }
      return defaultApi(path, options);
    });
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);
    await user.click(screen.getByRole("button", { name: "Agregar al pedido" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible agregar el producto");
    expect(screen.queryByText("detalle técnico privado")).not.toBeInTheDocument();
    expect(screen.getByText(/Mesa 4 · Pedido #123/)).toBeInTheDocument();
    expect(screen.getByText("Cuenta solicitada")).toBeInTheDocument();
  });

  it("bloquea nuevas adiciones al recibir ORDER_NOT_OPEN y conserva Cuenta solicitada", async () => {
    const user = userEvent.setup();
    const closedOrder = { ...order, status: "SETTLED" };
    const closedError = Object.assign(new Error("raw"), { body: { code: "ORDER_NOT_OPEN" } });
    let orderReads = 0;
    mocks.apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/sales/menu-catalog") return Promise.resolve(catalog);
      if (path === "/sales/orders/123" && !options?.method) {
        orderReads += 1;
        return Promise.resolve(orderReads === 1 ? order : closedOrder);
      }
      if (path === "/sales/orders/123/items") return Promise.reject(closedError);
      return defaultApi(path, options);
    });
    render(<SalesMenuCatalogPage />);
    await user.click((await screen.findAllByRole("button", { name: "Agregar" }))[0]);
    await user.click(screen.getByRole("button", { name: "Agregar al pedido" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pedido ya no está abierto");
    expect(screen.getByText("Cuenta solicitada")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Pedido cerrado" })[0]).toBeDisabled();
  });

  it("respeta sales.manage y vuelve al pedido conservando el identificador", async () => {
    const user = userEvent.setup();
    mocks.getUserPermissions.mockReturnValue(["sales.read"]);
    render(<SalesMenuCatalogPage />);

    expect((await screen.findAllByRole("button", { name: "Solo lectura" }))[0]).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Volver al pedido" }));
    expect(mocks.router.push).toHaveBeenCalledWith("/sales/orders?orderId=123");
  });

  it("muestra recuperación segura para ORDER_NOT_FOUND", async () => {
    const notFound = Object.assign(new Error("database detail"), { body: { code: "ORDER_NOT_FOUND" } });
    mocks.apiFetch.mockImplementation((path: string) => (
      path === "/sales/menu-catalog" ? Promise.resolve(catalog) : Promise.reject(notFound)
    ));
    render(<SalesMenuCatalogPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El pedido solicitado no existe");
    expect(screen.queryByText("database detail")).not.toBeInTheDocument();
  });
});
