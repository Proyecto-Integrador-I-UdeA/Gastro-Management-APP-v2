import { describe, expect, it } from 'vitest';
import {
  dateRangePresets,
  detectPreset,
  formatDeltaPct,
  previousRange,
} from './dateRanges';

// Usamos un "today" fijo para tests deterministas
const TODAY = '2026-03-15'; // domingo 15 de marzo de 2026

describe('dateRangePresets', () => {
  it('hoy → día único', () => {
    expect(dateRangePresets.hoy(TODAY)).toEqual({ from: '2026-03-15', to: '2026-03-15' });
  });

  it('ayer → día anterior', () => {
    expect(dateRangePresets.ayer(TODAY)).toEqual({ from: '2026-03-14', to: '2026-03-14' });
  });

  it('mesActual → primer día del mes hasta hoy', () => {
    expect(dateRangePresets.mesActual(TODAY)).toEqual({ from: '2026-03-01', to: '2026-03-15' });
  });

  it('mesAnterior → febrero completo', () => {
    expect(dateRangePresets.mesAnterior(TODAY)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('mesAnterior en enero → diciembre del año anterior', () => {
    expect(dateRangePresets.mesAnterior('2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('ytd → 1 de enero hasta hoy', () => {
    expect(dateRangePresets.ytd(TODAY)).toEqual({ from: '2026-01-01', to: '2026-03-15' });
  });
});

describe('previousRange', () => {
  it('mismo número de días, inmediatamente anterior', () => {
    expect(previousRange({ from: '2026-01-01', to: '2026-01-31' })).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('un solo día', () => {
    expect(previousRange({ from: '2026-02-10', to: '2026-02-10' })).toEqual({
      from: '2026-02-09',
      to: '2026-02-09',
    });
  });

  it('rango que cruza año', () => {
    expect(previousRange({ from: '2026-01-01', to: '2026-01-07' })).toEqual({
      from: '2025-12-25',
      to: '2025-12-31',
    });
  });
});

describe('detectPreset', () => {
  it('detecta el preset activo', () => {
    expect(detectPreset({ from: '2026-03-15', to: '2026-03-15' }, TODAY)).toBe('hoy');
  });

  it('retorna null si no coincide', () => {
    expect(detectPreset({ from: '2026-02-03', to: '2026-02-10' }, TODAY)).toBeNull();
  });
});

describe('formatDeltaPct', () => {
  it('positivo', () => {
    expect(formatDeltaPct(150, 100)).toBe(50);
  });

  it('negativo', () => {
    expect(formatDeltaPct(50, 100)).toBe(-50);
  });

  it('previous = 0 → null', () => {
    expect(formatDeltaPct(100, 0)).toBeNull();
  });
});