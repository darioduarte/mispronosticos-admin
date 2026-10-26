/** Fecha calendario de Bogotá, con un desplazamiento en días. */
export function bogotaCalendarDate(now = new Date(), dayOffset = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  if (!dayOffset) return today;
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString().slice(0, 10);
}
