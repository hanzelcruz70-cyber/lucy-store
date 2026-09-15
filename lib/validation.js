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

/* Monto escrito por la dueña: acepta "1.500,50", "1,500.50", "1500.50", "C$150".
 * En Nicaragua se escribe "1,500" con coma de miles — parseFloat la trunca a 1.
 * Devuelve un Number finito >= min o null si no se puede interpretar.
 * Regla: si hay coma Y punto, el último es el separador decimal (formato NI);
 * si solo hay coma: es decimal si tiene 1-2 dígitos después, si no, miles. */
export function parseMonto(s, { min = 0.01, max = 999999999.99 } = {}) {
  if (typeof s === 'number') {
    return Number.isFinite(s) && s >= min && s <= max ? s : null;
  }
  if (typeof s !== 'string') return null;
  const raw = s.replace(/[C$%\s]/g, '').trim();
  if (!raw) return null;
  // Rechaza basura que no sea dígitos, coma o punto
  if (!/^[-\d.,]+$/.test(raw)) return null;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized;
  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos: el ÚLTIMO es decimal, el otro es miles → quitar miles, dec → punto
    const decSep = lastComma > lastDot ? ',' : '.';
    const milSep = decSep === ',' ? '.' : ',';
    normalized = raw.split(milSep).join('').replace(decSep, '.');
  } else if (lastComma !== -1) {
    // Solo comas: "1500,50" = 1500.50 · "1,500" = 1500 · "1,500,000" = miles
    const parts = raw.split(',');
    const tail = parts[parts.length - 1];
    const isDecimal = parts.length === 2 && /^\d{1,2}$/.test(tail);
    normalized = isDecimal ? parts[0] + '.' + tail : parts.join('');
  } else if (lastDot !== -1) {
    // Solo puntos: "1.500.50" (miles) vs "1500.50" (decimal)
    const parts = raw.split('.');
    const tail = parts[parts.length - 1];
    const isDecimal = parts.length === 2 && /^\d{1,2}$/.test(tail);
    normalized = isDecimal ? raw : parts.join('');
  } else {
    normalized = raw;
  }
  const v = Number(normalized);
  if (!Number.isFinite(v) || v < min || v > max) return null;
  return v;
}

/* Email básico (misma regla que Supabase Auth). */
export function isEmail(s) {
  return typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}
