import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditMenuItemPage from "@/pages/menu/edit/[id]";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const existingImage = {
  assetId: 12,
  url: "/menu-media/files/11111111-1111-4111-8111-111111111111.jpg",
  width: 1200,
  height: 900,
};
const menuItem = {
  id: 7,
  name: "Pollo a la plancha",
  description: "Plato de prueba",
  kind: "ADDITION",
  available: false,
  includedItemsText: "Incluye salsa de la casa.",
  hasDrink: false,
  hasDessert: false,
  active: true,
  categoryId: null,
  components: [],
  image: existingImage,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/lib/api", () => ({
  apiFetch: mocks.apiFetch,
}));
vi.mock("@/config/apiBaseUrl", () => ({
  API_BASE_URL: "https://api.example.test",
}));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/utils/toast", () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess,
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.getUserPermissions.mockReturnValue(["menu.manage"]);
  mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/menu-items/7" && !options?.method) return menuItem;
    if (path === "/products" || path === "/recipes") return [];
    if (path === "/menu-categories?includeInactive=true") return [];
    if (path === "/menu-items/7" && options?.method === "PUT") return menuItem;
    if (path === "/menu-items/7/image" && options?.method === "DELETE") {
      return { ...menuItem, image: null };
    }
    throw new Error(`Endpoint no esperado: ${path}`);
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:edit-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("imagen administrativa al editar MenuItem", () => {
  it("carga y permite modificar tipo, disponibilidad e incluidos", async () => {
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    expect(await screen.findByLabelText("Tipo de artículo")).toHaveValue("ADDITION");
    expect(screen.getByRole("checkbox", { name: "Disponible para la venta" }))
      .not.toBeChecked();
    expect(screen.getByLabelText("¿Qué incluye?")).toHaveValue("Incluye salsa de la casa.");

    await user.selectOptions(screen.getByLabelText("Tipo de artículo"), "STANDARD");
    await user.click(screen.getByRole("checkbox", { name: "Disponible para la venta" }));
    await user.clear(screen.getByLabelText("¿Qué incluye?"));
    await user.type(screen.getByLabelText("¿Qué incluye?"), "Incluye papa y ensalada.");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
    const updateCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) => path === "/menu-items/7" && options?.method === "PUT",
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      kind: "STANDARD",
      available: true,
      includedItemsText: "Incluye papa y ensalada.",
      active: true,
    });
  });

  it("muestra la imagen existente resuelta contra el origen del backend", async () => {
    render(<EditMenuItemPage />);
    expect(await screen.findByRole("img", { name: "Fotografía de Pollo a la plancha" }))
      .toHaveAttribute(
        "src",
        `https://api.example.test${existingImage.url}`,
      );
  });

  it("sube la nueva imagen y después incluye el assetId en el PUT", async () => {
    mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/menu-items/7" && !options?.method) return menuItem;
      if (path === "/products" || path === "/recipes") return [];
      if (path === "/menu-categories?includeInactive=true") return [];
      if (path === "/menu-media/images") return { assetId: 33 };
      if (path === "/menu-items/7" && options?.method === "PUT") return menuItem;
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<EditMenuItemPage />);
    await user.upload(
      await screen.findByLabelText("Cambiar imagen"),
      new File(["webp"], "nueva.webp", { type: "image/webp" }),
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:edit-preview");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
    const uploadIndex = mocks.apiFetch.mock.calls.findIndex(([path]) => path === "/menu-media/images");
    const updateIndex = mocks.apiFetch.mock.calls.findIndex(
      ([path, options]) => path === "/menu-items/7" && options?.method === "PUT",
    );
    expect(updateIndex).toBeGreaterThan(uploadIndex);
    expect(JSON.parse(String(mocks.apiFetch.mock.calls[updateIndex][1]?.body))).toMatchObject({
      imageAssetId: 33,
    });
  });

  it("elimina la imagen existente mediante el endpoint dedicado", async () => {
    const user = userEvent.setup();
    render(<EditMenuItemPage />);
    await user.click(await screen.findByRole("button", { name: "Eliminar imagen" }));

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/menu-items/7/image",
      { method: "DELETE" },
    ));
    expect(window.confirm).toHaveBeenCalledWith("¿Deseas eliminar la imagen actual del plato?");
    expect(await screen.findByText("Sin imagen")).toBeInTheDocument();
    expect(mocks.showSuccess).toHaveBeenCalledWith("Imagen eliminada correctamente");
  });

  it("si falla la eliminación conserva la imagen y muestra error", async () => {
    mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/menu-items/7" && !options?.method) return menuItem;
      if (path === "/products" || path === "/recipes") return [];
      if (path === "/menu-categories?includeInactive=true") return [];
      if (path === "/menu-items/7/image" && options?.method === "DELETE") {
        throw new Error("delete failed");
      }
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<EditMenuItemPage />);
    await user.click(await screen.findByRole("button", { name: "Eliminar imagen" }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith(
      "No fue posible eliminar la imagen. Inténtalo nuevamente.",
    ));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      `https://api.example.test${existingImage.url}`,
    );
  });
});
