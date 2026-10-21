import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinancePayrollPage from "@/pages/finance/payroll";

const mocks = vi.hoisted(() => ({
  api: {
    fetchFinancePayroll: vi.fn(),
    createFinanceEmployee: vi.fn(),
    updateFinanceEmployee: vi.fn(),
    deleteFinanceEmployee: vi.fn(),
    generateFinancePayroll: vi.fn(),
    updateFinancePayrollEntry: vi.fn(),
    deleteFinancePayrollEntry: vi.fn(),
    closeFinancePayroll: vi.fn(),
    reopenFinancePayroll: vi.fn(),
  },
  permissions: vi.fn(),
}));

vi.mock("@/lib/financePayrollApi", () => mocks.api);
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.permissions,
}));
vi.mock("@/hooks/useAuthGuard", () => ({ useAuthGuard: vi.fn() }));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const emptyResponse = {
  month: "2026-10",
  employees: [],
  period: null,
};

describe("pantalla de nómina", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.mockReturnValue(["accounting.read", "accounting.update"]);
    mocks.api.fetchFinancePayroll.mockResolvedValue(emptyResponse);
  });

  it("muestra colaboradores y resumen por área, sin KPIs ni lectura laboral", async () => {
    render(<FinancePayrollPage />);

    expect(await screen.findByRole("heading", { name: "Nómina" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Colaboradores" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nómina del periodo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nómina por área" })).toBeInTheDocument();
    expect(screen.queryByText("Lectura laboral")).not.toBeInTheDocument();
    expect(screen.queryByText("Costo total nómina")).not.toBeInTheDocument();
    expect(screen.queryByText("% sobre ventas")).not.toBeInTheDocument();
  });

  it("permite crear un colaborador", async () => {
    const user = userEvent.setup();
    mocks.api.createFinanceEmployee.mockResolvedValue({
      id: 1,
      fullName: "Ana Rojas",
      nationalId: "1-2345-6789",
      area: "KITCHEN",
      position: "Chef",
      hiredAt: "2024-03-01",
      monthlySalary: 850000,
      active: true,
    });
    mocks.api.fetchFinancePayroll
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce({
        ...emptyResponse,
        employees: [{
          id: 1,
          fullName: "Ana Rojas",
          nationalId: "1-2345-6789",
          area: "KITCHEN",
          position: "Chef",
          hiredAt: "2024-03-01",
          monthlySalary: 850000,
          active: true,
        }],
      });

    render(<FinancePayrollPage />);
    await user.click(await screen.findByRole("button", { name: "+ Agregar" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Ana Rojas");
    await user.type(screen.getByRole("textbox", { name: "Documento" }), "1-2345-6789");
    await user.type(screen.getByRole("textbox", { name: "Cargo" }), "Chef");
    await user.type(screen.getByLabelText("Ingreso"), "2024-03-01");
    await user.type(screen.getByRole("spinbutton", { name: "Salario mensual" }), "850000");
    await user.click(screen.getByRole("button", { name: "Guardar colaborador" }));

    await waitFor(() => expect(mocks.api.createFinanceEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Ana Rojas",
        nationalId: "1-2345-6789",
        area: "KITCHEN",
        position: "Chef",
        monthlySalary: 850000,
      }),
    ));
    expect(await screen.findByText("Ana Rojas")).toBeInTheDocument();
  });

  it("oculta las acciones de captura sin accounting.update", async () => {
    mocks.permissions.mockReturnValue(["accounting.read"]);
    render(<FinancePayrollPage />);
    await screen.findByRole("heading", { name: "Colaboradores" });
    expect(screen.queryByRole("button", { name: "+ Agregar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar nómina" })).not.toBeInTheDocument();
  });
});
