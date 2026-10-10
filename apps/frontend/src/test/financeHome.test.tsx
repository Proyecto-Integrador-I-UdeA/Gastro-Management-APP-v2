import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceHomePage from "@/pages/finance/index";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mocks.push,
    pathname: "/finance",
    asPath: "/finance",
    isReady: true,
  }),
}));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.permissions,
}));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("home de gestión financiera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.mockReturnValue(["accounting.read"]);
  });

  it("muestra solo Gastos y Nómina como módulos activos", async () => {
    render(<FinanceHomePage />);

    expect(await screen.findByRole("heading", { name: "Módulo de Gestión Financiera" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GASTOS Y NÓMINA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gastos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nómina/i })).toBeInTheDocument();
    expect(screen.getAllByText("Sin submódulos en esta fase.")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Ingresos y egresos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Estado de resultados/i })).not.toBeInTheDocument();
  });

  it("navega a Gastos desde el home", async () => {
    const user = userEvent.setup();
    render(<FinanceHomePage />);

    await user.click(await screen.findByRole("button", { name: /Gastos/i }));
    expect(mocks.push).toHaveBeenCalledWith("/finance/expenses");
  });
});
