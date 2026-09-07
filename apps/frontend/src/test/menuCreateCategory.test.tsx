import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateMenuItemPage from "@/pages/menu/create";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  mocks.getUserPermissions.mockReturnValue(["menu.read", "menu.manage"]);
  mocks.apiFetch.mockImplementation(async (path: string) => {
    if (path === "/products" || path === "/recipes") return [];
    if (path === "/menu-categories") {
      return [
        { id: 1, name: "Platos fuertes", active: true },
        { id: 2, name: "Archivada", active: false },
      ];
    }
    if (path === "/menu-items") return { id: 20 };
    throw new Error(`Endpoint no esperado: ${path}`);
  });
});

describe("categoría al crear un plato", () => {
  it("suma costos autoritativos y no usa Recipe.totalCost histórico", async () => {
    const recipes = [
      { id: 1, name: "Pechuga de pollo a la plancha", active: true, portions: 1, totalCost: 5_683_000 },
      { id: 2, name: "Papas al vapor", active: true, portions: 1, totalCost: 903_000 },
      { id: 3, name: "Ensalada de lechuga", active: true, portions: 1, totalCost: 577_950 },
    ];
    const authoritativeCosts: Record<number, number> = {
      1: 5683,
      2: 903,
      3: 577.95,
    };
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products" || path === "/menu-categories") return [];
      if (path === "/recipes") return recipes;
      const recipeCostMatch = path.match(/^\/costs\/recipe\/(\d+)$/);
      if (recipeCostMatch) {
        return { costPerPortion: authoritativeCosts[Number(recipeCostMatch[1])] };
      }
      if (path === "/menu-items") return { id: 20 };
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    for (const recipe of recipes) {
      await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
      const options = await screen.findAllByRole("option", { name: new RegExp(recipe.name) });
      await user.selectOptions(
        options[options.length - 1].parentElement as HTMLSelectElement,
        `recipe-${recipe.id}`,
      );
    }

    expect(await screen.findByText(/7[.]163,95/)).toBeInTheDocument();
    expect(screen.queryByText(/7[.]163[.]950/)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Nombre del plato"), "Pollo a la Plancha");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));
    const createCall = mocks.apiFetch.mock.calls.find(
      ([path, options]) => path === "/menu-items" && options?.method === "POST",
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).not.toHaveProperty("totalCost");
  });

  it("muestra un error local si falla el costo autoritativo de una receta", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products" || path === "/menu-categories") return [];
      if (path === "/recipes") {
        return [{ id: 1, name: "Receta sin costo", active: true, portions: 1, totalCost: 999_999 }];
      }
      if (path === "/costs/recipe/1") throw new Error("Fallo controlado");
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
    const option = await screen.findByRole("option", { name: /Receta sin costo/ });
    await user.selectOptions(option.parentElement as HTMLSelectElement, "recipe-1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo obtener el costo actualizado de esta receta.",
    );
    expect(screen.queryByText(/999[.,]999/)).not.toBeInTheDocument();
  });

  it("calcula un Product directo usando unitCost y la conversión de su presentación", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products") {
        return [{
          id: 9,
          name: "Pechuga de pollo",
          active: true,
          unitOfMeasure: "g",
          inputUnit: "kg",
          inputUnitQuantity: 1,
          unitCost: 18_000,
        }];
      }
      if (path === "/recipes" || path === "/menu-categories") return [];
      if (path === "/menu-items") return { id: 20 };
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
    const productOption = await screen.findByRole("option", { name: /Pechuga de pollo/ });
    await user.selectOptions(productOption.parentElement as HTMLSelectElement, "product-9");
    const quantityInput = screen.getByRole("spinbutton");
    await user.clear(quantityInput);
    await user.type(quantityInput, "200");

    expect(screen.getByText(/3[.,]600/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Nombre del plato"), "Pollo porcionado");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true);
  });

  it("no rompe con cantidad negativa y bloquea la creación del plato", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products") {
        return [{
          id: 9,
          name: "Pechuga de pollo",
          active: true,
          unitOfMeasure: "g",
          inputUnit: "kg",
          inputUnitQuantity: 1,
          unitCost: 18_000,
        }];
      }
      if (path === "/recipes" || path === "/menu-categories") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
    const option = await screen.findByRole("option", { name: /Pechuga de pollo/ });
    await user.selectOptions(option.parentElement as HTMLSelectElement, "product-9");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "-1" } });

    expect(screen.getByRole("alert")).toHaveTextContent("La cantidad debe ser mayor que 0.");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("cantidad cero con producto seleccionado muestra validación y bloquea el plato", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/products") {
        return [{
          id: 9,
          name: "Pechuga de pollo",
          active: true,
          unitOfMeasure: "g",
          inputUnit: "kg",
          inputUnitQuantity: 1,
          unitCost: 18_000,
        }];
      }
      if (path === "/recipes" || path === "/menu-categories") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await user.click(screen.getByRole("button", { name: "+ Agregar componente" }));
    const option = await screen.findByRole("option", { name: /Pechuga de pollo/ });
    await user.selectOptions(option.parentElement as HTMLSelectElement, "product-9");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });

    expect(screen.getByRole("alert")).toHaveTextContent("La cantidad debe ser mayor que 0.");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("carga categorías activas, muestra la ayuda y envía categoryId", async () => {
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    const categorySelect = await screen.findByLabelText("Categoría");
    expect(categorySelect).toBeEnabled();
    expect(screen.getByRole("option", { name: "Platos fuertes" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archivada" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Los platos sin categoría no estarán disponibles para la venta."),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Nombre del plato"), "Bandeja de la casa");
    await user.selectOptions(categorySelect, "1");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => {
      const createCall = mocks.apiFetch.mock.calls.find(
        ([path, options]) => path === "/menu-items" && options?.method === "POST",
      );
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
        name: "Bandeja de la casa",
        categoryId: 1,
      });
    });
  });

  it("envía null cuando se crea sin categoría y no inventa un ID", async () => {
    const user = userEvent.setup();
    render(<CreateMenuItemPage />);

    await screen.findByRole("option", { name: "Platos fuertes" });
    await user.type(screen.getByPlaceholderText("Nombre del plato"), "Sin clasificar");
    await user.click(screen.getByRole("button", { name: "Guardar Plato" }));

    await waitFor(() => {
      const createCall = mocks.apiFetch.mock.calls.find(
        ([path, options]) => path === "/menu-items" && options?.method === "POST",
      );
      expect(JSON.parse(String(createCall?.[1]?.body)).categoryId).toBeNull();
    });
  });
});
