import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceExpensesPage from "@/pages/finance/expenses";

const mocks = vi.hoisted(() => ({
  api: {
    fetchFinanceExpenses: vi.fn(),
    createFinanceExpense: vi.fn(),
    updateFinanceExpense: vi.fn(),
    deleteFinanceExpense: vi.fn(),
  },
  permissions: vi.fn(),
}));

vi.mock("@/lib/financeExpensesApi", () => mocks.api);
vi.mock("@/lib/financeLedgerApi", () => ({
  fetchFinanceLedger: vi.fn().mockResolvedValue({
    month: "2026-10",
    payables: [],
    receivables: [],
    suppliers: [],
  }),
  createFinanceLedger: vi.fn(),
  updateFinanceLedger: vi.fn(),
  deleteFinanceLedger: vi.fn(),
  createFinanceLedgerPayment: vi.fn(),
}));
vi.mock("@/utils/permissions", () => ({
  getUserPermissions: mocks.permissions,
}));
vi.mock("@/hooks/useAuthGuard", () => ({ useAuthGuard: vi.fn() }));
vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const emptyResponse = {
  month: "2026-10",
  fixed: [],
  variable: [],
  totals: { fixed: 0, variable: 0 },
};

describe("pantalla de gastos financieros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.mockReturnValue(["accounting.read", "accounting.update"]);
    mocks.api.fetchFinanceExpenses.mockResolvedValue(emptyResponse);
  });

  it("muestra las dos tablas y permite crear un gasto fijo", async () => {
    const user = userEvent.setup();
    mocks.api.createFinanceExpense.mockResolvedValue({
      id: 1,
      kind: "FIXED",
      month: "2026-10",
      concept: "Arriendo local",
      periodicity: "MONTHLY",
      base: null,
      amount: 8500000,
      active: true,
    });
    mocks.api.fetchFinanceExpenses
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce({
        ...emptyResponse,
        fixed: [{
          id: 1,
          kind: "FIXED",
          month: "2026-10",
          concept: "Arriendo local",
          periodicity: "MONTHLY",
          base: null,
          amount: 8500000,
          active: true,
        }],
        totals: { fixed: 8500000, variable: 0 },
      });

    render(<FinanceExpensesPage />);

    expect(await screen.findByRole("heading", { name: "Gastos fijos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Costos indirectos variables" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tendencia" })).not.toBeInTheDocument();

    const addButtons = await screen.findAllByRole("button", { name: "+ Agregar" });
    await user.click(addButtons[2]);
    await user.type(screen.getByRole("textbox", { name: "Concepto" }), "Arriendo local");
    await user.type(screen.getByRole("spinbutton", { name: "Valor" }), "8500000");
    await user.click(screen.getByRole("button", { name: "Guardar rubro" }));

    await waitFor(() => expect(mocks.api.createFinanceExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "FIXED",
        concept: "Arriendo local",
        amount: 8500000,
        periodicity: "MONTHLY",
      }),
    ));
    expect(await screen.findByText("Arriendo local")).toBeInTheDocument();
  });

  it("oculta las acciones de captura sin accounting.update", async () => {
    mocks.permissions.mockReturnValue(["accounting.read"]);
    render(<FinanceExpensesPage />);
    await screen.findByRole("heading", { name: "Gastos fijos" });
    expect(screen.queryByRole("button", { name: "+ Agregar" })).not.toBeInTheDocument();
  });
});
