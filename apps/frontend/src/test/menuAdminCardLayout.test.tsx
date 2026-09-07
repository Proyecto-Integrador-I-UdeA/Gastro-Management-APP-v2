import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuListPage from "@/pages/menu";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getUserPermissions: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api", () => ({
  apiFetch: mocks.apiFetch,
}));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/menu/MenuCategoryManager", () => ({
  default: () => null,
}));

beforeEach(() => {
  mocks.getUserPermissions.mockReturnValue(["menu.manage"]);
  mocks.apiFetch.mockResolvedValue([
    {
      id: 2,
      name: "Pechuga de pollo a la plancha",
      description: "Servida con acompañamientos",
      active: true,
      kind: "STANDARD",
      available: false,
      includedItemsText: "Ensalada fresca y papa.",
      category: { name: "Platos fuertes" },
      image: null,
      caloriesPerPortion: 700,
    },
  ]);
});

describe("tarjeta administrativa del menú", () => {
  it("agrupa Editar e Inactivar y conserva la información principal", async () => {
    const user = userEvent.setup();
    render(<MenuListPage />);

    expect(await screen.findByText("Pechuga de pollo a la plancha")).toBeInTheDocument();
    expect(screen.getByText("Servida con acompañamientos")).toBeInTheDocument();
    expect(screen.getByText("Categoría: Platos fuertes")).toBeInTheDocument();
    expect(screen.getByText("Plato / producto")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Ensalada fresca y papa.")).toBeInTheDocument();
    expect(screen.getByText("🔥 Plato energético para jornadas exigentes.")).toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Editar" });
    const deactivateButton = screen.getByRole("button", { name: "Inactivar" });
    expect(editButton.parentElement).toBe(deactivateButton.parentElement);

    await user.click(editButton);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/menu/edit/2"));
  });
});
