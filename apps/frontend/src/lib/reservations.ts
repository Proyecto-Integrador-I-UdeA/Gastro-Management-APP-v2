const BOGOTA_TIME_ZONE = 'America/Bogota';

export function formatReservationDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: BOGOTA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatReservationTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric', minute: '2-digit', timeZone: BOGOTA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatReservationDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: BOGOTA_TIME_ZONE,
  }).format(new Date(value));
}

export function bogotaInputParts(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: BOGOTA_TIME_ZONE,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

export function bogotaLocalToIso(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00.000-05:00`);
  if (!date || !time || Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
