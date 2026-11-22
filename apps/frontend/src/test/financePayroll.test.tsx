import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const automaticEntry = {
  id: 10,
  periodId: 5,
  employeeId: 1,
  fullName: "Ana Rojas",
  nationalId: "1-2345-6789",
  area: "KITCHEN",
  position: "Chef",
  salary: 2100000,
  extras: 152500,
  deductions: 190200,
  benefits: 530031.78,
  dayOvertimeHours: 2,
  dayOvertimePay: 25000,
  nightOvertimeHours: 3,
  nightOvertimePay: 52500,
  nightSurchargeHours: 4,
  nightSurchargePay: 14000,
  restDayDayHours: 4,
  restDayDayPay: 36000,
  restDayNightHours: 2,
  restDayNightPay: 25000,
  ordinaryHourlyRate: 10000,
  transportAid: 249095,
  totalAccrued: 2501595,
  healthDeduction: 90100,
  pensionDeduction: 90100,
  otherDeductions: 10000,
  totalDeductions: 190200,
  contributionBase: 2252500,
  employeeHealthDeduction: 90100,
  employerHealthContributionApplies: true,
  employerHealthContribution: 191462.5,
  totalHealthContribution: 281562.5,
  employeePensionDeduction: 90100,
  employerPensionContribution: 270300,
  totalPensionContribution: 360400,
  arlRiskClass: "I",
  arlRate: 0.00522,
  employerArlContribution: 11758.05,
  totalSocialSecurityPayment: 653720.55,
  employerSocialSecurityCost: 473520.55,
  immediatePayrollCashOutflow: 2965115.55,
  prestationsBase: 2501595,
  primaProvision: 208466.25,
  severanceProvision: 208466.25,
  severanceInterestProvision: 25015.95,
  vacationProvision: 88083.33,
  calculationVersion: "CO_BASIC_2026_V1",
  note: null,
  gross: 2501595,
  net: 2311395,
  employerCost: 3505147.33,
};

const automaticResponse = {
  month: "2026-10",
  employees: [],
  period: {
    id: 5,
    month: "2026-10",
    status: "OPEN",
    note: null,
    closedAt: null,
    entries: [automaticEntry],
    byArea: [{
      area: "KITCHEN",
      employeeCount: 1,
      salaries: 2100000,
      extras: 152500,
      transportAid: 249095,
      totalAccrued: 2501595,
      totalDeductions: 190200,
      net: 2311395,
      benefits: 530031.78,
      totalSocialSecurityPayment: 653720.55,
      employerSocialSecurityCost: 473520.55,
      immediatePayrollCashOutflow: 2965115.55,
      total: 3505147.33,
    }],
    totals: {
      employeeCount: 1,
      salaries: 2100000,
      extras: 152500,
      deductions: 190200,
      benefits: 530031.78,
      transportAid: 249095,
      totalAccrued: 2501595,
      healthDeduction: 90100,
      pensionDeduction: 90100,
      otherDeductions: 10000,
      totalDeductions: 190200,
      net: 2311395,
      totalSocialSecurityPayment: 653720.55,
      employerSocialSecurityCost: 473520.55,
      immediatePayrollCashOutflow: 2965115.55,
      employerCost: 3505147.33,
    },
  },
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
      transportAidEligible: true,
      employerHealthContributionApplies: true,
      arlRiskClass: "I",
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
          transportAidEligible: true,
          employerHealthContributionApplies: true,
          arlRiskClass: "I",
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
    expect(screen.getByRole("checkbox", { name: "Aplica aporte patronal de salud" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Clase de riesgo ARL" })).toHaveValue("I");
    await user.click(screen.getByRole("button", { name: "Guardar colaborador" }));

    await waitFor(() => expect(mocks.api.createFinanceEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Ana Rojas",
        nationalId: "1-2345-6789",
        area: "KITCHEN",
        position: "Chef",
        monthlySalary: 850000,
        transportAidEligible: true,
        employerHealthContributionApplies: true,
        arlRiskClass: "I",
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

  it("captura horas y otros descuentos sin enviar totales calculados", async () => {
    const user = userEvent.setup();
    mocks.api.fetchFinancePayroll.mockResolvedValue(automaticResponse);
    mocks.api.updateFinancePayrollEntry.mockResolvedValue(automaticEntry);

    render(<FinancePayrollPage />);
    await user.click(await screen.findByRole("button", { name: "Ajustar" }));
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Valor hora ordinaria");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("PROVISIONES PRESTACIONALES");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Prima de servicios");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Cesantías");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Intereses de cesantías");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Vacaciones");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Dominical/festivo diurno");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Dominical/festivo nocturno");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("SEGURIDAD SOCIAL");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Salud empresa 8,5%");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Pensión empresa 12%");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("ARL clase I");
    expect(screen.getByLabelText("Desglose calculado")).toHaveTextContent("Total seguridad social a girar");

    const day = screen.getByRole("spinbutton", { name: "Horas extra diurnas" });
    await user.clear(day);
    await user.type(day, "5");
    const restDayDay = screen.getByRole("spinbutton", { name: "Horas dominicales/festivas diurnas" });
    await user.clear(restDayDay);
    await user.type(restDayDay, "6");
    const restDayNight = screen.getByRole("spinbutton", { name: "Horas dominicales/festivas nocturnas" });
    await user.clear(restDayNight);
    await user.type(restDayNight, "3");
    const other = screen.getByRole("spinbutton", { name: "Otros descuentos" });
    await user.clear(other);
    await user.type(other, "12000");
    await user.click(screen.getByRole("button", { name: "Actualizar línea" }));

    await waitFor(() => expect(mocks.api.updateFinancePayrollEntry).toHaveBeenCalledWith(10, {
      dayOvertimeHours: 5,
      nightOvertimeHours: 3,
      nightSurchargeHours: 4,
      restDayDayHours: 6,
      restDayNightHours: 3,
      otherDeductions: 12000,
      note: null,
    }));
    const payload = mocks.api.updateFinancePayrollEntry.mock.calls[0][1];
    expect(payload).not.toHaveProperty("extras");
    expect(payload).not.toHaveProperty("deductions");
    expect(payload).not.toHaveProperty("net");
  });

  it("separa el comprobante del empleado del informe administrativo imprimible", async () => {
    const user = userEvent.setup();
    mocks.api.fetchFinancePayroll.mockResolvedValue(automaticResponse);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(<FinancePayrollPage />);
    expect(await screen.findByRole("heading", { name: "Resumen general del período" })).toBeInTheDocument();
    expect(screen.getByText("Neto total de nómina")).toBeInTheDocument();
    expect(screen.getByText("Total seguridad social a girar")).toBeInTheDocument();
    expect(screen.getByText("Aportes adicionales empresa")).toBeInTheDocument();
    expect(screen.getByText("Salida inmediata de nómina")).toBeInTheDocument();
    expect(screen.getByText("Total provisiones prestacionales")).toBeInTheDocument();
    expect(screen.getByText("Costo estimado total del restaurante")).toBeInTheDocument();
    expect(screen.getAllByText(/2\.311\.395/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Comprobante" }));
    const receipt = screen.getByRole("article", { name: "Comprobante de nómina" });
    expect(within(receipt).getByRole("heading", { name: "COMPROBANTE DE NÓMINA" })).toBeInTheDocument();
    expect(within(receipt).getByText("DEVENGADOS")).toBeInTheDocument();
    expect(within(receipt).getByText("DEDUCCIONES")).toBeInTheDocument();
    expect(within(receipt).getByText("NETO A PAGAR")).toBeInTheDocument();
    expect(within(receipt).getByText("Dominical/festivo diurno")).toBeInTheDocument();
    expect(within(receipt).getByText("Dominical/festivo nocturno")).toBeInTheDocument();
    expect(within(receipt).queryByText("PROVISIONES DEL EMPLEADOR")).not.toBeInTheDocument();
    expect(within(receipt).queryByText("Total provisiones")).not.toBeInTheDocument();
    expect(within(receipt).queryByText("Costo estimado restaurante")).not.toBeInTheDocument();
    expect(within(receipt).queryByText("Aportes adicionales empresa")).not.toBeInTheDocument();
    expect(within(receipt).queryByText("TOTAL SEGURIDAD SOCIAL A GIRAR")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Imprimir / Guardar PDF" }));
    expect(print).toHaveBeenCalledTimes(1);

    await user.click(within(receipt).getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Informe de costos" }));
    const report = screen.getByRole("article", { name: "Informe administrativo de costos" });
    expect(within(report).getByRole("heading", { name: "INFORME ADMINISTRATIVO DE COSTO LABORAL" })).toBeInTheDocument();
    expect(within(report).getByText("Total prima")).toBeInTheDocument();
    expect(within(report).getByText("Total cesantías")).toBeInTheDocument();
    expect(within(report).getByText("Total provisiones")).toBeInTheDocument();
    expect(within(report).getByText("Salud empresa 8,5%")).toBeInTheDocument();
    expect(within(report).getByText("Pensión empresa 12%")).toBeInTheDocument();
    expect(within(report).getByText("ARL empresa")).toBeInTheDocument();
    expect(within(report).getByText("TOTAL SEGURIDAD SOCIAL A GIRAR")).toBeInTheDocument();
    expect(within(report).getByText("APORTES ADICIONALES EMPRESA")).toBeInTheDocument();
    expect(within(report).getByText("SALIDA INMEDIATA DE NÓMINA")).toBeInTheDocument();
    expect(within(report).getByText("COSTO LABORAL ESTIMADO DEL RESTAURANTE")).toBeInTheDocument();
    await user.click(within(report).getByRole("button", { name: "Imprimir informe / Guardar PDF" }));
    expect(print).toHaveBeenCalledTimes(2);
    print.mockRestore();
  });
});
