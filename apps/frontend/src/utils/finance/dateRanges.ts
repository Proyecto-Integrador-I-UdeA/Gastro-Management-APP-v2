/**
 * Helpers de rango de fechas en horario Bogotá (UTC-05:00).
 * Todos los valores se manejan como 'YYYY-MM-DD'.
 */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export function todayInBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function lastOfMonth(ymd: string): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export type DateRange = { from: string; to: string };

export const dateRangePresets = {
  hoy(today = todayInBogota()): DateRange {
    return { from: today, to: today };
  },
  ayer(today = todayInBogota()): DateRange {
    const y = addDays(today, -1);
    return { from: y, to: y };
  },
  mesActual(today = todayInBogota()): DateRange {
    return { from: firstOfMonth(today), to: today };
  },
  mesAnterior(today = todayInBogota()): DateRange {
    const prevMonthLast = addDays(firstOfMonth(today), -1);
    return { from: firstOfMonth(prevMonthLast), to: prevMonthLast };
  },
  ytd(today = todayInBogota()): DateRange {
    return { from: `${today.slice(0, 4)}-01-01`, to: today };
  },
} as const;

export type DateRangePreset = keyof typeof dateRangePresets;

/**
 * Dado un rango [from, to] inclusivo, devuelve el rango inmediatamente
 * anterior con la MISMA cantidad de días. Sirve para comparar Δ%.
 *
 * Ejemplos:
 *   from=2026-01-01, to=2026-01-31  →  from=2025-12-01, to=2025-12-31
 *   from=2026-02-10, to=2026-02-10  →  from=2026-02-09, to=2026-02-09
 */
export function previousRange(range: DateRange): DateRange {
  if (!range.from || !range.to) {
    return { from: range.from, to: range.to };
  }
  const fromDate = new Date(`${range.from}T00:00:00.000Z`);
  const toDate = new Date(`${range.to}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { from: range.from, to: range.to };
  }
  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(fromDate.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (dayCount - 1) * DAY_MS);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

/**
 * Devuelve true si el rango coincide con alguno de los presets conocidos.
 * Útil para resaltar el botón activo en la UI.
 */
export function detectPreset(range: DateRange, today = todayInBogota()): DateRangePreset | null {
  for (const key of Object.keys(dateRangePresets) as DateRangePreset[]) {
    const preset = dateRangePresets[key](today);
    if (preset.from === range.from && preset.to === range.to) return key;
  }
  return null;
}

export function formatDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}