import { describe, expect, it } from 'vitest';
import { createFinanceEmployeeSchema, updateFinancePayrollEntrySchema } from '../../src/schemas/financePayrollSchema';
import { summarizePayroll } from '../../src/services/finance/financePayrollService';

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
        net: 760000,
        employerCost: 1050000,
      },
      {
        area: 'KITCHEN',
        salary: 700000,
        extras: 0,
        deductions: 70000,
        benefits: 180000,
        net: 630000,
        employerCost: 880000,
      },
      {
        area: 'SERVICE',
        salary: 600000,
        extras: 0,
        deductions: 60000,
        benefits: 150000,
        net: 540000,
        employerCost: 750000,
      },
    ]);

    const kitchen = summary.byArea.find(row => row.area === 'KITCHEN');
    expect(kitchen?.employeeCount).toBe(2);
    expect(kitchen?.salaries).toBe(1500000);
    expect(kitchen?.benefits).toBe(380000);
    expect(kitchen?.total).toBe(1930000);
    expect(summary.totals.employeeCount).toBe(3);
    expect(summary.totals.employerCost).toBe(2680000);
  });
});
