import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuListPage from "@/pages/menu";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
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

const categories = [
  {
    id: 1,
    name: "Entradas",
    description: "Para comenzar",
    displayOrder: 1,
    active: true,
  },
  {
    id: 2,
    name: "Temporada",
    description: null,
    displayOrder: 2,
    active: false,
  },
];

beforeEach(() => {
  mocks.getUserPermissions.mockReturnValue(["menu.read", "menu.manage"]);
  mocks.apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/menu-items") {
      return [
        { id: 10, name: "Croquetas", active: true, category: categories[0] },
        { id: 11, name: "Plato pendiente", active: true, category: null },
      ];
    }
    if (path === "/menu-categories?includeInactive=true") return categories;
    if (path === "/menu-categories" && options?.method === "POST") {
      return {
        id: 3,
        ...JSON.parse(String(options.body)),
      };
    }
    if (path === "/menu-categories/1" && options?.method === "PATCH") {
      return { ...categories[0], ...JSON.parse(String(options.body)) };
    }
    if (path === "/menu-categories/2" && options?.method === "PATCH") {
      return { ...categories[1], active: true };
    }
    throw new Error(`Endpoint no esperado: ${path}`);
  });
});

describe("gestión y visualización de categorías del menú", () => {
  it("carga categorías existentes y muestra la categoría o su ausencia en cada plato", async () => {
    render(<MenuListPage />);

    expect(await screen.findByRole("heading", { name: "Entradas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Temporada" })).toBeInTheDocument();
    expect(screen.getByText("Categoría: Entradas")).toBeInTheDocument();
    expect(screen.getByText("Categoría: Sin categoría")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/menu-items");
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/menu-categories?includeInactive=true",
      );
    });
    expect(
      mocks.apiFetch.mock.calls.every(([path]) =>
        ["/menu-items", "/menu-categories?includeInactive=true"].includes(path),
      ),
    ).toBe(true);
  });

  it("crea una categoría usando el contrato existente", async () => {
    const user = userEvent.setup();
    render(<MenuListPage />);

    await user.type(await screen.findByLabelText("Nombre"), "Postres");
    await user.type(screen.getByLabelText("Descripción"), "Dulces de la casa");
    await user.clear(screen.getByLabelText("Orden"));
    await user.type(screen.getByLabelText("Orden"), "4");
    await user.click(screen.getByRole("button", { name: "Crear categoría" }));

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/menu-categories", {
        method: "POST",
        body: JSON.stringify({
          name: "Postres",
          description: "Dulces de la casa",
          displayOrder: 4,
          active: true,
        }),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Postres" })).toBeInTheDocument();
  });

  it("activa y desactiva categorías mediante PATCH sin consultar endpoints adicionales", async () => {
    const user = userEvent.setup();
    render(<MenuListPage />);

    const category = await screen.findByRole("heading", { name: "Entradas" });
    await user.click(
      within(category.closest("article") as HTMLElement).getByRole("button", {
        name: "Desactivar",
      }),
    );

    const inactiveCategory = screen.getByRole("heading", { name: "Temporada" });
    await user.click(
      within(inactiveCategory.closest("article") as HTMLElement).getByRole("button", {
        name: "Activar",
      }),
    );

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/menu-categories/1", {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      expect(mocks.apiFetch).toHaveBeenCalledWith("/menu-categories/2", {
        method: "PATCH",
        body: JSON.stringify({ active: true }),
      });
    });
    expect(
      mocks.apiFetch.mock.calls
        .filter(([path]) => String(path).startsWith("/menu-categories"))
        .map(([path]) => path),
    ).toEqual([
      "/menu-categories?includeInactive=true",
      "/menu-categories/1",
      "/menu-categories/2",
    ]);
  });

  it("carga los valores actuales y edita nombre, descripción y orden", async () => {
    const user = userEvent.setup();
    render(<MenuListPage />);

    const heading = await screen.findByRole("heading", { name: "Entradas" });
    const categoryCard = heading.closest("article") as HTMLElement;
    await user.click(within(categoryCard).getByRole("button", { name: "Editar" }));

    const nameInput = within(categoryCard).getByLabelText("Nombre");
    const descriptionInput = within(categoryCard).getByLabelText("Descripción");
    const orderInput = within(categoryCard).getByLabelText("Orden");
    expect(nameInput).toHaveValue("Entradas");
    expect(descriptionInput).toHaveValue("Para comenzar");
    expect(orderInput).toHaveValue(1);

    await user.clear(nameInput);
    await user.type(nameInput, "Entradas frías");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Opciones frescas");
    await user.clear(orderInput);
    await user.type(orderInput, "3");
    await user.click(
      within(categoryCard).getByRole("button", { name: "Guardar cambios" }),
    );

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith("/menu-categories/1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Entradas frías",
          description: "Opciones frescas",
          displayOrder: 3,
        }),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Entradas frías" }))
      .toBeInTheDocument();
  });

  it("cancela la edición sin enviar PATCH", async () => {
    const user = userEvent.setup();
    render(<MenuListPage />);

    const heading = await screen.findByRole("heading", { name: "Entradas" });
    const categoryCard = heading.closest("article") as HTMLElement;
    await user.click(within(categoryCard).getByRole("button", { name: "Editar" }));
    await user.clear(within(categoryCard).getByLabelText("Nombre"));
    await user.type(within(categoryCard).getByLabelText("Nombre"), "No guardar");
    await user.click(within(categoryCard).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("heading", { name: "Entradas" })).toBeInTheDocument();
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path, options]) =>
          path === "/menu-categories/1" && options?.method === "PATCH",
      ),
    ).toBe(false);
  });

  it("permite lectura con menu.read sin exponer controles de escritura", async () => {
    mocks.getUserPermissions.mockReturnValue(["menu.read"]);

    render(<MenuListPage />);

    expect(await screen.findByRole("heading", { name: "Entradas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear categoría" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});
