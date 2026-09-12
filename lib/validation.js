/* ============================================================
 * Mi Prenda · sanitización de input (anti-XSS / anti-basura)
 * Todo lo que llega por POST/PUT/DELETE pasa por aquí antes
 * de tocar la BD o Supabase Auth.
 * ============================================================ */

/* String: quita caracteres de control, recorta longitud. */
export function sanitizeString(s, maxLen = 200) {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

/* Número: clamp 0–999,999,999.99; rechaza NaN/Infinity/negativos. */
export function sanitizeNumber(n, { min = 0, max = 999999999.99 } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null; // NaN, Infinity, strings basura
  return Math.min(Math.max(v, min), max);
}

/* UUID v4 estricto — evita inyecciones en .eq('id', ...) */
export function isUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

/* Email básico (misma regla que Supabase Auth). */
export function isEmail(s) {
  return typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}
