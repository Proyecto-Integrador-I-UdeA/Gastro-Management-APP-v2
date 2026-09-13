import { describe, expect, it } from 'vitest';
import {
  applyWasteFactor,
  validateWastePercent,
  wasteFactor,
} from '../../src/services/pricing/globalWasteService';
import { InvalidCostComponentError } from '../../src/services/pricing/pricingErrors';

describe('factor global de merma', () => {
  it('mantiene la cantidad teórica con 0 %', () => {
    expect(applyWasteFactor('200', '0').toString()).toBe('200');
  });

  it('aplica 8 % como factor 1.08', () => {
    expect(wasteFactor('8').toString()).toBe('1.08');
    expect(applyWasteFactor('200', '8').toString()).toBe('216');
    expect(applyWasteFactor('4000', '8').toString()).toBe('4320');
  });

  it.each(['-0.01', '8.001', '100.01', 'NaN', 'Infinity'])(
    'rechaza porcentaje fuera del contrato: %s',
    value => expect(() => validateWastePercent(value)).toThrow(InvalidCostComponentError),
  );
});
