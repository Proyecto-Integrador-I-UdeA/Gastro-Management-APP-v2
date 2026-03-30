/** Fecha local YYYY-MM-DD (para atributo `min` de `<input type="date">`). */
export function todayLocalDateInputValue(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Compara solo el día calendario en hora local. Vacío = válido (sin vencimiento). */
export function isExpirationDateNotBeforeToday(dateStr: string): boolean {
  const s = dateStr.trim();
  if (!s) return true;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [y, mo, day] = parts;
  const picked = new Date(y, mo - 1, day);
  picked.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return picked.getTime() >= today.getTime();
}
