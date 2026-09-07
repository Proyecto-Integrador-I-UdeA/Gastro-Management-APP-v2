import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateMenuItemPage from "@/pages/menu/create";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api", () => ({
  API_URL: "https://api.example.test",
  apiFetch: mocks.apiFetch,
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
  mocks.getUserPermissions.mockReturnValue(["menu.manage"]);
  mocks.apiFetch.mockImplementation(async (path: string) => {
    if (path === "/products" || path === "/recipes" || path === "/menu-categories") return [];
    if (path === "/menu-items") return { id: 20 };
    throw new Error(`Endpoint no esperado: ${path}`);
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:create-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("imagen administrativa al crear MenuItem", () => {
  it("crea una adición agotada con el texto de incluidos separado", async () => {
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await user.selectOptions(
      screen.getByLabelText("Tipo de artículo"),
      "ADDITION",
    );
    await user.click(screen.getByRole("checkbox", { name: "Disponible para la venta" }));
    await user.type(
      screen.getByLabelText("¿Qué incluye?"),
      "Incluye salsa de la casa.",
    );
    await user.click(await screen.findByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
    const createCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) => path === "/menu-items" && options?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      kind: "ADDITION",
      available: false,
      includedItemsText: "Incluye salsa de la casa.",
    });
  });

  it("permite crear sin imagen y no llama el endpoint de upload", async () => {
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);
    await user.type(screen.getByPlaceholderText("Nombre del plato"), "Plato sin foto");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar Plato" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
    expect(mocks.apiFetch.mock.calls.some(([path]) => path === "/menu-media/images")).toBe(false);
    const createCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) => path === "/menu-items" && options?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).not.toHaveProperty("imageAssetId");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      kind: "STANDARD",
      available: true,
      includedItemsText: null,
    });
  });

  it("sube primero y envía el assetId al crear el plato", async () => {
    mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/products" || path === "/recipes" || path === "/menu-categories") return [];
      if (path === "/menu-media/images") return { assetId: 27 };
      if (path === "/menu-items" && options?.method === "POST") return { id: 20 };
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);
    await user.upload(
      screen.getByLabelText("Seleccionar imagen"),
      new File(["jpeg"], "plato.jpg", { type: "image/jpeg" }),
    );
    await user.click(await screen.findByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
    const uploadIndex = mocks.apiFetch.mock.calls.findIndex(([path]) => path === "/menu-media/images");
    const createIndex = mocks.apiFetch.mock.calls.findIndex(
      ([path, options]) => path === "/menu-items" && options?.method === "POST",
    );
    expect(uploadIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(uploadIndex);
    const uploadBody = mocks.apiFetch.mock.calls[uploadIndex][1]?.body as FormData;
    expect(uploadBody.get("image")).toBeInstanceOf(File);
    expect(JSON.parse(String(mocks.apiFetch.mock.calls[createIndex][1]?.body))).toMatchObject({
      imageAssetId: 27,
    });
  });

  it("si falla el upload conserva el preview y no intenta crear el plato", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products" || path === "/recipes" || path === "/menu-categories") return [];
      if (path === "/menu-media/images") throw new Error("upload failed");
      if (path === "/menu-items") return { id: 20 };
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);
    await user.upload(
      screen.getByLabelText("Seleccionar imagen"),
      new File(["png"], "plato.png", { type: "image/png" }),
    );
    await user.click(await screen.findByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith(
      "No fue posible cargar la imagen. Inténtalo nuevamente.",
    ));
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:create-preview");
    expect(mocks.apiFetch.mock.calls.some(
      ([path, options]) => path === "/menu-items" && options?.method === "POST",
    )).toBe(false);
  });

  it("bloquea doble submit y no inicia dos uploads simultáneos", async () => {
    let resolveUpload: (value: { assetId: number }) => void = () => undefined;
    const pendingUpload = new Promise<{ assetId: number }>(resolve => {
      resolveUpload = resolve;
    });
    mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/products" || path === "/recipes" || path === "/menu-categories") return [];
      if (path === "/menu-media/images") return pendingUpload;
      if (path === "/menu-items" && options?.method === "POST") return { id: 20 };
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);
    await user.upload(
      screen.getByLabelText("Seleccionar imagen"),
      new File(["webp"], "plato.webp", { type: "image/webp" }),
    );
    const saveButton = await screen.findByRole("button", { name: "Guardar Plato" });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(mocks.apiFetch.mock.calls.filter(([path]) => path === "/menu-media/images")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
    resolveUpload({ assetId: 31 });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu"));
  });
});
