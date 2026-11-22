import { z } from 'zod';
import { financeExpenseMonthSchema } from './financeExpenseSchema';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD');

const moneySchema = z
  .number()
  .finite()
  .min(0, 'El valor no puede ser negativo');

const hoursSchema = z
  .number()
  .finite()
  .min(0, 'Las horas no pueden ser negativas');

export const financePayrollAreaSchema = z.enum(['KITCHEN', 'SERVICE', 'ADMIN', 'SUPPORT']);
export const financeArlRiskClassSchema = z.enum(['I', 'II', 'III', 'IV', 'V']);

export const listFinancePayrollQuerySchema = z.object({
  month: financeExpenseMonthSchema,
});

export const createFinanceEmployeeSchema = z.object({
  fullName: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  nationalId: z.string().trim().min(5, 'El documento es obligatorio').max(30),
  area: financePayrollAreaSchema,
  position: z.string().trim().min(1, 'El cargo es obligatorio').max(120),
  hiredAt: dateOnlySchema,
  monthlySalary: z.number().finite().positive('El salario debe ser mayor a 0'),
  transportAidEligible: z.boolean().optional().default(true),
  employerHealthContributionApplies: z.boolean().optional().default(true),
  arlRiskClass: financeArlRiskClassSchema.optional().default('I'),
  active: z.boolean().optional().default(true),
}).strict();

export const updateFinanceEmployeeSchema = z.object({
  fullName: z.string().trim().min(1, 'El nombre es obligatorio').max(200).optional(),
  nationalId: z.string().trim().min(5, 'El documento es obligatorio').max(30).optional(),
  area: financePayrollAreaSchema.optional(),
  position: z.string().trim().min(1, 'El cargo es obligatorio').max(120).optional(),
  hiredAt: dateOnlySchema.optional(),
  monthlySalary: z.number().finite().positive('El salario debe ser mayor a 0').optional(),
  transportAidEligible: z.boolean().optional(),
  employerHealthContributionApplies: z.boolean().optional(),
  arlRiskClass: financeArlRiskClassSchema.optional(),
  active: z.boolean().optional(),
}).strict();

export const generateFinancePayrollSchema = z.object({
  month: financeExpenseMonthSchema,
});

export const updateFinancePayrollEntrySchema = z.object({
  salary: moneySchema.optional(),
  extras: moneySchema.optional(),
  deductions: moneySchema.optional(),
  benefits: moneySchema.optional(),
  dayOvertimeHours: hoursSchema.optional(),
  nightOvertimeHours: hoursSchema.optional(),
  nightSurchargeHours: hoursSchema.optional(),
  restDayDayHours: hoursSchema.optional(),
  restDayNightHours: hoursSchema.optional(),
  otherDeductions: moneySchema.optional(),
  note: z.string().trim().max(200).nullable().optional(),
}).strict();

export type CreateFinanceEmployeeInput = z.infer<typeof createFinanceEmployeeSchema>;
export type UpdateFinanceEmployeeInput = z.infer<typeof updateFinanceEmployeeSchema>;
export type UpdateFinancePayrollEntryInput = z.infer<typeof updateFinancePayrollEntrySchema>;
