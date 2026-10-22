import { describe, expect, it } from 'vitest';
import {
  createFinanceExpenseSchema,
  listFinanceExpensesQuerySchema,
  updateFinanceExpenseSchema,
} from '../../src/schemas/financeExpenseSchema';

describe('validación de gastos financieros', () => {
  it('acepta un gasto fijo completo', () => {
    const parsed = createFinanceExpenseSchema.safeParse({
      kind: 'FIXED',
      month: '2026-10',
      concept: 'Arriendo local',
      periodicity: 'MONTHLY',
      amount: 8500000,
      active: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('acepta un costo variable completo', () => {
    const parsed = createFinanceExpenseSchema.safeParse({
      kind: 'VARIABLE',
      month: '2026-10',
      concept: 'Empaques',
      base: 'Domicilios',
      amount: 2180000,
    });
    expect(parsed.success).toBe(true);
  });

  it('rechaza un periodo inválido', () => {
    expect(listFinanceExpensesQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(createFinanceExpenseSchema.safeParse({
      kind: 'FIXED',
      month: 'octubre',
      concept: 'Arriendo',
      periodicity: 'MONTHLY',
      amount: 1,
    }).success).toBe(false);
  });

  it('rechaza un gasto fijo sin periodicidad', () => {
    expect(createFinanceExpenseSchema.safeParse({
      kind: 'FIXED',
      month: '2026-10',
      concept: 'Arriendo',
      amount: 1,
    }).success).toBe(false);
  });

  it('rechaza un costo variable sin base', () => {
    expect(createFinanceExpenseSchema.safeParse({
      kind: 'VARIABLE',
      month: '2026-10',
      concept: 'Empaques',
      amount: 1,
    }).success).toBe(false);
  });

  it('rechaza un valor negativo', () => {
    expect(updateFinanceExpenseSchema.safeParse({ amount: -10 }).success).toBe(false);
  });
});
