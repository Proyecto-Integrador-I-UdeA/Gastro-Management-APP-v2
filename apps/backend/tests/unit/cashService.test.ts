import { describe, expect, it } from 'vitest';
import { calculateExpectedCash, calculateServiceAmounts, splitCashPayment } from '../../src/services/cash/cashService';
import { paymentSchema, serviceConfigSchema } from '../../src/schemas/cashSchema';

describe('CASH-01A cálculos financieros', () => {
  it('separa venta, servicio y total con servicio voluntario', () => {
    const result = calculateServiceAmounts('100000.00', '10.00', true);
    expect(result.subtotal.toFixed(2)).toBe('100000.00');
    expect(result.serviceAmount.toFixed(2)).toBe('10000.00');
    expect(result.total.toFixed(2)).toBe('110000.00');
  });

  it('mantiene servicio en cero cuando el cliente lo rechaza', () => {
    const result = calculateServiceAmounts('80000.00', '10.00', false);
    expect(result.serviceAmount.toFixed(2)).toBe('0.00');
    expect(result.total.toFixed(2)).toBe('80000.00');
  });

  it('calcula efectivo esperado solo con pagos CASH', () => {
    expect(calculateExpectedCash('200000.00', ['60000.00']).toFixed(2)).toBe('260000.00');
  });

  it('redondea servicio a centavos antes de sumar el total', () => {
    const result = calculateServiceAmounts('0.05', '10', true);
    expect(result.serviceAmount.toFixed(2)).toBe('0.01');
    expect(result.total.toFixed(2)).toBe('0.06');
  });

  it('divide cobros parciales preservando venta, impuesto y servicio al completar la cuenta', () => {
    const first = splitCashPayment('118000', '8000', '10000', '0', '60000');
    const second = splitCashPayment('118000', '8000', '10000', '60000', '58000');
    expect(first.salesAmount.add(first.consumptionTaxAmount).add(first.serviceAmount).toFixed(2)).toBe('60000.00');
    expect(second.salesAmount.add(second.consumptionTaxAmount).add(second.serviceAmount).toFixed(2)).toBe('58000.00');
    expect(first.consumptionTaxAmount.add(second.consumptionTaxAmount).toFixed(2)).toBe('8000.00');
    expect(first.serviceAmount.add(second.serviceAmount).toFixed(2)).toBe('10000.00');
    expect(first.salesAmount.add(second.salesAmount).toFixed(2)).toBe('100000.00');
  });

  it.each(['-1', '101', '10.001', 'NaN', 'Infinity'])('motor rechaza porcentaje %s', percent => {
    expect(() => calculateServiceAmounts('100', percent, true)).toThrow();
  });

  it('contratos conservan strings monetarios y rechazan precisión excesiva', () => {
    expect(serviceConfigSchema.parse({ servicePercent: '10.25' }).servicePercent).toBe('10.25');
    expect(serviceConfigSchema.parse({ servicePercent: 10 }).servicePercent).toBe('10');
    expect(serviceConfigSchema.safeParse({ servicePercent: '0.001' }).success).toBe(false);
    const payment = { preInvoiceId: 1, method: 'CASH', idempotencyKey: 'unit-test-payment' };
    expect(paymentSchema.parse({ ...payment, amount: '900719925474.09' }).amount).toBe('900719925474.09');
    expect(paymentSchema.safeParse({ ...payment, amount: '0.001' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...payment, amount: '' }).success).toBe(false);
  });
});
