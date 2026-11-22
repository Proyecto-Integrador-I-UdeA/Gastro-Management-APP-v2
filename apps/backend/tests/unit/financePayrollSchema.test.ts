import { describe, expect, it } from 'vitest';
import { createFinanceEmployeeSchema, updateFinancePayrollEntrySchema } from '../../src/schemas/financePayrollSchema';
import {
  ARL_RATES,
  calculateBasicPayroll,
  calculateEmployerSocialSecurity,
  CALCULATION_VERSION,
  summarizePayroll,
  TRANSPORT_AID_2026,
} from '../../src/services/finance/financePayrollService';

function number(value: { toNumber(): number }) {
  return value.toNumber();
}

describe('validación de colaboradores y líneas de nómina', () => {
  it('acepta un colaborador de cocina', () => {
    const parsed = createFinanceEmployeeSchema.safeParse({
      fullName: 'Ana Rojas',
      nationalId: '1-2345-6789',
      area: 'KITCHEN',
      position: 'Chef',
      hiredAt: '2024-03-01',
      monthlySalary: 850000,
    });
    expect(parsed.success).toBe(true);
  });

  it('valida la configuración patronal y la clase ARL del colaborador', () => {
    expect(createFinanceEmployeeSchema.safeParse({
      fullName: 'Ana Rojas',
      nationalId: '1-2345-6789',
      area: 'KITCHEN',
      position: 'Chef',
      hiredAt: '2024-03-01',
      monthlySalary: 850000,
      employerHealthContributionApplies: false,
      arlRiskClass: 'III',
    }).success).toBe(true);

    expect(createFinanceEmployeeSchema.safeParse({
      fullName: 'Ana Rojas',
      nationalId: '1-2345-6789',
      area: 'KITCHEN',
      position: 'Chef',
      hiredAt: '2024-03-01',
      monthlySalary: 850000,
      arlRiskClass: 'VI',
    }).success).toBe(false);
  });

  it('rechaza un salario mensual en cero', () => {
    expect(createFinanceEmployeeSchema.safeParse({
      fullName: 'Ana Rojas',
      nationalId: '1-2345-6789',
      area: 'KITCHEN',
      position: 'Chef',
      hiredAt: '2024-03-01',
      monthlySalary: 0,
    }).success).toBe(false);
  });

  it('acepta extras y prestaciones en una línea', () => {
    expect(updateFinancePayrollEntrySchema.safeParse({
      extras: 40000,
      deductions: 90000,
      benefits: 220000,
    }).success).toBe(true);
  });

  it('acepta horas dominicales/festivas decimales y rechaza valores negativos', () => {
    expect(updateFinancePayrollEntrySchema.safeParse({
      restDayDayHours: 2.5,
      restDayNightHours: 1.25,
    }).success).toBe(true);
    expect(updateFinancePayrollEntrySchema.safeParse({
      restDayDayHours: -1,
    }).success).toBe(false);
  });
});

describe('resumen de nómina por área', () => {
  it('agrupa salarios, prestaciones y costo', () => {
    const summary = summarizePayroll([
      {
        area: 'KITCHEN',
        salary: 800000,
        extras: 50000,
        deductions: 90000,
        benefits: 200000,
        transportAid: 249095,
        totalAccrued: 1099095,
        healthDeduction: 34000,
        pensionDeduction: 34000,
        otherDeductions: 22000,
        totalDeductions: 90000,
        net: 760000,
        employerCost: 1050000,
        totalSocialSecurityPayment: 0,
        employerSocialSecurityCost: 0,
        immediatePayrollCashOutflow: 760000,
      },
      {
        area: 'KITCHEN',
        salary: 700000,
        extras: 0,
        deductions: 70000,
        benefits: 180000,
        transportAid: 249095,
        totalAccrued: 949095,
        healthDeduction: 28000,
        pensionDeduction: 28000,
        otherDeductions: 14000,
        totalDeductions: 70000,
        net: 630000,
        employerCost: 880000,
        totalSocialSecurityPayment: 0,
        employerSocialSecurityCost: 0,
        immediatePayrollCashOutflow: 630000,
      },
      {
        area: 'SERVICE',
        salary: 600000,
        extras: 0,
        deductions: 60000,
        benefits: 150000,
        transportAid: 249095,
        totalAccrued: 849095,
        healthDeduction: 24000,
        pensionDeduction: 24000,
        otherDeductions: 12000,
        totalDeductions: 60000,
        net: 540000,
        employerCost: 750000,
        totalSocialSecurityPayment: 0,
        employerSocialSecurityCost: 0,
        immediatePayrollCashOutflow: 540000,
      },
    ]);

    const kitchen = summary.byArea.find(row => row.area === 'KITCHEN');
    expect(kitchen?.employeeCount).toBe(2);
    expect(kitchen?.salaries).toBe(1500000);
    expect(kitchen?.benefits).toBe(380000);
    expect(kitchen?.total).toBe(1930000);
    expect(summary.totals.employeeCount).toBe(3);
    expect(summary.totals.benefits).toBe(530000);
    expect(summary.totals.employerCost).toBe(2680000);
    expect(summary.totals.transportAid).toBe(747285);
    expect(summary.totals.totalDeductions).toBe(220000);
  });
});

describe('cálculo básico de nómina colombiana 2026', () => {
  it('expone la versión autoritativa esperada', () => {
    expect(CALCULATION_VERSION).toBe('CO_BASIC_2026_V1');
  });

  it('calcula hora ordinaria, extra diurna, extra nocturna y recargo nocturno', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 2,
      nightOvertimeHours: 3,
      nightSurchargeHours: 4,
      otherDeductions: 0,
      transportAidEligible: true,
    });

    expect(number(result.ordinaryHourlyRate)).toBe(10000);
    expect(number(result.dayOvertimePay)).toBe(25000);
    expect(number(result.nightOvertimePay)).toBe(52500);
    expect(number(result.nightSurchargePay)).toBe(14000);
    expect(number(result.extras)).toBe(91500);
  });

  it('con cero horas conserva extras en cero', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 0,
      transportAidEligible: true,
    });
    expect(number(result.extras)).toBe(0);
    expect(number(result.restDayDayPay)).toBe(0);
    expect(number(result.restDayNightPay)).toBe(0);
  });

  it('calcula solo los recargos adicionales por descanso obligatorio diurno y nocturno', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      restDayDayHours: 4,
      restDayNightHours: 2,
      otherDeductions: 0,
      transportAidEligible: true,
    });

    expect(number(result.ordinaryHourlyRate)).toBe(10_000);
    expect(number(result.restDayDayPay)).toBe(36_000);
    expect(number(result.restDayNightPay)).toBe(25_000);
    expect(number(result.extras)).toBe(61_000);
    expect(number(result.contributionBase)).toBe(2_161_000);
    expect(number(result.healthDeduction)).toBe(86_440);
    expect(number(result.pensionDeduction)).toBe(86_440);
    expect(number(result.totalAccrued)).toBe(2_410_095);
    expect(number(result.net)).toBe(2_237_215);
    expect(number(result.prestationsBase)).toBe(2_410_095);
    expect(number(result.primaProvision)).toBe(200_841.25);
    expect(number(result.severanceProvision)).toBe(200_841.25);
    expect(number(result.vacationProvision)).toBe(87_500);
    expect(number(result.benefits)).toBe(513_283.45);
    expect(number(result.employerCost)).toBe(3_377_663.87);
  });

  it('excluye los recargos de descanso obligatorio de la base de vacaciones', () => {
    const withoutRestDay = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      restDayDayHours: 0,
      restDayNightHours: 0,
      otherDeductions: 0,
      transportAidEligible: false,
    });
    const withRestDay = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      restDayDayHours: 4,
      restDayNightHours: 2,
      otherDeductions: 0,
      transportAidEligible: false,
    });

    expect(number(withRestDay.vacationProvision)).toBe(number(withoutRestDay.vacationProvision));
    expect(number(withRestDay.primaProvision)).toBeGreaterThan(number(withoutRestDay.primaProvision));
    expect(number(withRestDay.severanceProvision)).toBeGreaterThan(number(withoutRestDay.severanceProvision));
  });

  it.each([
    [3_501_809, true, TRANSPORT_AID_2026],
    [3_501_810, true, TRANSPORT_AID_2026],
    [3_501_811, true, 0],
    [1_750_905, false, 0],
  ])('aplica el auxilio según salario %s y elegibilidad %s', (salary, eligible, expected) => {
    const result = calculateBasicPayroll({
      salary,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 0,
      transportAidEligible: eligible,
    });
    expect(number(result.transportAid)).toBe(expected);
  });

  it('calcula salud y pensión al 4 %, excluye auxilio del IBC y suma otros descuentos', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 2,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 10_000,
      transportAidEligible: true,
    });

    expect(number(result.contributionBase)).toBe(2_125_000);
    expect(number(result.healthDeduction)).toBe(85_000);
    expect(number(result.pensionDeduction)).toBe(85_000);
    expect(number(result.otherDeductions)).toBe(10_000);
    expect(number(result.deductions)).toBe(180_000);
    expect(number(result.totalAccrued)).toBe(2_374_095);
    expect(number(result.net)).toBe(2_194_095);
  });

  it('calcula las cuatro provisiones y su total sobre las bases simplificadas', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 2,
      nightOvertimeHours: 3,
      nightSurchargeHours: 4,
      otherDeductions: 10_000,
      transportAidEligible: true,
    });

    expect(number(result.prestationsBase)).toBe(2_440_595);
    expect(number(result.primaProvision)).toBe(203_382.92);
    expect(number(result.severanceProvision)).toBe(203_382.92);
    expect(number(result.severanceInterestProvision)).toBe(24_405.95);
    expect(number(result.vacationProvision)).toBe(88_083.33);
    expect(number(result.benefits)).toBe(519_255.12);
    expect(number(result.employerCost)).toBe(3_420_547.25);
  });

  it('excluye de vacaciones el auxilio y las horas extra, pero incluye el recargo nocturno', () => {
    const withExtrasAndAid = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 8,
      nightOvertimeHours: 6,
      nightSurchargeHours: 4,
      otherDeductions: 0,
      transportAidEligible: true,
    });
    const withoutExtrasOrAid = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 4,
      otherDeductions: 0,
      transportAidEligible: false,
    });

    expect(number(withExtrasAndAid.vacationProvision)).toBe(88_083.33);
    expect(number(withExtrasAndAid.vacationProvision)).toBe(
      number(withoutExtrasOrAid.vacationProvision),
    );
  });

  it('calcula seguridad social total y costo adicional del empleador sin duplicar descuentos', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 2,
      nightOvertimeHours: 3,
      nightSurchargeHours: 4,
      restDayDayHours: 4,
      restDayNightHours: 2,
      otherDeductions: 10_000,
      transportAidEligible: true,
      employerHealthContributionApplies: true,
      arlRiskClass: 'I',
    });

    expect(number(result.contributionBase)).toBe(2_252_500);
    expect(number(result.employeeHealthDeduction)).toBe(90_100);
    expect(number(result.employerHealthContribution)).toBe(191_462.50);
    expect(number(result.totalHealthContribution)).toBe(281_562.50);
    expect(number(result.employeePensionDeduction)).toBe(90_100);
    expect(number(result.employerPensionContribution)).toBe(270_300);
    expect(number(result.totalPensionContribution)).toBe(360_400);
    expect(number(result.employerArlContribution)).toBe(11_758.05);
    expect(number(result.totalSocialSecurityPayment)).toBe(653_720.55);
    expect(number(result.employerSocialSecurityCost)).toBe(473_520.55);
    expect(number(result.immediatePayrollCashOutflow)).toBe(2_965_115.55);
    expect(number(result.employerCost)).toBe(3_505_147.33);
    expect(number(result.net)).toBe(2_311_395);
  });

  it('permite excluir salud patronal sin cambiar el neto del trabajador', () => {
    const withEmployerHealth = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 0,
      transportAidEligible: false,
      employerHealthContributionApplies: true,
      arlRiskClass: 'I',
    });
    const withoutEmployerHealth = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 0,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 0,
      transportAidEligible: false,
      employerHealthContributionApplies: false,
      arlRiskClass: 'I',
    });

    expect(number(withoutEmployerHealth.employerHealthContribution)).toBe(0);
    expect(number(withoutEmployerHealth.net)).toBe(number(withEmployerHealth.net));
    expect(number(withoutEmployerHealth.employerCost)).toBeLessThan(number(withEmployerHealth.employerCost));
  });

  it.each(Object.entries(ARL_RATES))('aplica la tarifa ARL de clase %s', (arlRiskClass, rate) => {
    const result = calculateEmployerSocialSecurity({
      contributionBase: 2_000_000,
      employerHealthContributionApplies: false,
      arlRiskClass: arlRiskClass as keyof typeof ARL_RATES,
    });

    expect(number(result.employerArlContribution)).toBe(
      Number((2_000_000 * rate).toFixed(2)),
    );
  });

  it('mantiene el neto independiente de provisiones y aportes patronales', () => {
    const result = calculateBasicPayroll({
      salary: 2_100_000,
      dayOvertimeHours: 2,
      nightOvertimeHours: 0,
      nightSurchargeHours: 0,
      otherDeductions: 10_000,
      transportAidEligible: true,
    });

    expect(number(result.net)).toBe(2_194_095);
    expect(number(result.employerCost)).toBe(
      number(result.totalAccrued.add(result.benefits).add(result.employerSocialSecurityCost)),
    );
  });
});
