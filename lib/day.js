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
