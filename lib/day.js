/**
 * Inicio del "hoy" de negocio en Nicaragua (America/Managua, UTC-6 siempre,
 * sin horario de verano). Sin esta función, `new Date().setHours(0,0,0,0)`
 * calcula la medianoche UTC — 6 PM en Managua del día anterior — y las ventas
 * de la tarde terminan metidas en el "día de ayer" para la BD.
 *
 * Uso: devuelve un Date (UTC point-in-time) listo para `.toISOString()`,
 * que puede mezclarse directo con `supabase.gte('created_at', ...)`.
 */
export function startOfTodayNic() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = fmt.format(now).split('-').map(Number);
  // Nicaragua no observa horario de verano: siempre UTC-6.
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0));
}

/**
 * Clave de día de negocio en Nicaragua (YYYY-MM-DD) para un timestamp dado.
 * Evita el bug de bucketing por UTC: una venta de las 7PM cae en el día
 * correcto de Managua, no en el siguiente.
 */
export function nicDayKey(ts = new Date()) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) {
    // Legacy/unknown date: usa HOY para no romper el bucket ni la página
    return nicDayKey(new Date());
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Inicio (medianoche Nicaragua) de un día de negocio expresado como Date UTC.
 */
export function startOfNicDay(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0));
}
