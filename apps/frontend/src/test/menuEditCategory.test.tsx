import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditMenuItemPage from "@/pages/menu/edit/[id]";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const menuItem = {
  id: 7,
  name: "Arroz especial",
  description: "Plato de prueba",
  hasDrink: false,
  hasDessert: false,
  active: true,
  categoryId: 1,
  components: [{ productId: null, recipeId: 5, quantity: 1 }],
};

beforeEach(() => {
  mocks.getUserPermissions.mockReturnValue(["menu.read", "menu.manage"]);
  mocks.apiFetch.mockImplementation(async (path: string) => {
    if (path === "/menu-items/7") return menuItem;
    if (path === "/products") return [];
    if (path === "/recipes") {
      return [
        {
          id: 5,
          name: "Arroz base",
          active: true,
          portions: 1,
          totalCost: 0,
          nutritionRole: "CARB_BASE",
        },
      ];
    }
    if (path === "/costs/recipe/5") return { costPerPortion: 0 };
    if (path === "/menu-categories?includeInactive=true") {
      return [
        { id: 1, name: "Platos fuertes", active: true },
        { id: 2, name: "Especiales", active: true },
      ];
    }
    if (path === "/menu-items/7") return menuItem;
    throw new Error(`Endpoint no esperado: ${path}`);
  });
});

async function getUpdatePayload() {
  await waitFor(() => {
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path, options]) => path === "/menu-items/7" && options?.method === "PUT",
      ),
    ).toBe(true);
  });
  const updateCall = mocks.apiFetch.mock.calls.find(
    ([path, options]) => path === "/menu-items/7" && options?.method === "PUT",
  );
  return JSON.parse(String(updateCall?.[1]?.body));
}

describe("categoría al editar un plato", () => {
  it("usa el costo autoritativo al editar aunque Recipe.totalCost sea histórico", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/menu-items/7") {
        return {
          ...menuItem,
          components: [{ productId: null, recipeId: 5, quantity: 2 }],
        };
      }
      if (path === "/products") return [];
      if (path === "/recipes") {
        return [{
          id: 5,
          name: "Pechuga preparada",
          active: true,
          portions: 1,
          totalCost: 5_683_000,
        }];
      }
      if (path === "/costs/recipe/5") return { costPerPortion: 5683 };
      if (path === "/menu-categories?includeInactive=true") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    expect(await screen.findByText(/11[.,]366/)).toBeInTheDocument();
    expect(screen.queryByText(/11[.,]366[.,]000/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const payload = await getUpdatePayload();
    expect(payload).not.toHaveProperty("totalCost");
  });

  it("calcula un Product directo con la conversión completa al editar", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/menu-items/7") {
        return {
          ...menuItem,
          components: [{ productId: 9, recipeId: null, quantity: 200 }],
        };
      }
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
      if (path === "/recipes" || path === "/menu-categories?includeInactive=true") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    render(<EditMenuItemPage />);

    expect(await screen.findByText(/3[.,]600/)).toBeInTheDocument();
  });

  it("preserva un dato no numérico como inválido y bloquea el guardado", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/menu-items/7") {
        return {
          ...menuItem,
          components: [{ productId: 9, recipeId: null, quantity: "abc" }],
        };
      }
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
      if (path === "/recipes" || path === "/menu-categories?includeInactive=true") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/número válido/);
    expect(screen.getByPlaceholderText("Cantidad")).toHaveValue(null);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  });

  it("cantidad cero persistida bloquea la edición del plato", async () => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === "/menu-items/7") {
        return {
          ...menuItem,
          components: [{ productId: 9, recipeId: null, quantity: 0 }],
        };
      }
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
      if (path === "/recipes" || path === "/menu-categories?includeInactive=true") return [];
      throw new Error(`Endpoint no esperado: ${path}`);
    });
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("La cantidad debe ser mayor que 0.");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  });

  it("muestra la categoría actual y envía la nueva sin reemplazar componentes", async () => {
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    const categorySelect = await screen.findByLabelText("Categoría");
    expect(categorySelect).toHaveValue("1");

    await user.selectOptions(categorySelect, "2");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const payload = await getUpdatePayload();
    expect(payload.categoryId).toBe(2);
    expect(payload).not.toHaveProperty("components");
  });

  it("permite quitar la categoría enviando null sin reemplazar componentes", async () => {
    const user = userEvent.setup();
    render(<EditMenuItemPage />);

    const categorySelect = await screen.findByLabelText("Categoría");
    await user.selectOptions(categorySelect, "");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const payload = await getUpdatePayload();
    expect(payload.categoryId).toBeNull();
    expect(payload).not.toHaveProperty("components");
  });
});
