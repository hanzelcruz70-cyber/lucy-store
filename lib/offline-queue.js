'use client';

/* ============================================================
 * Cola offline de PacaPOS (outbox pattern)
 * Las escrituras que fallan sin internet se guardan AQUÍ con un
 * id temporal (uuid generado en el cliente) y el sincronizador
 * las envía a Supabase cuando vuelve la conexión.
 * ============================================================ */

const LS_QUEUE = 'pacapos_outbox';
const LS_EMITS = 'pacapos_emit'; // id de la última emisión de eventos

/* ---- helpers de storage (tolerantes a modo privado) ---- */
function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeLS(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/* ---- id uuid generado en el cliente (sin dependencias) ---- */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---- estado de la cola ---- */
export function getQueue() {
  return readLS(LS_QUEUE);
}
export function getQueueCount() {
  return readLS(LS_QUEUE).length;
}

export function enqueueOp(op) {
  const q = readLS(LS_QUEUE);
  const entry = {
    id: uuid(),
    ts: Date.now(),
    tries: 0,
    ...op, // { type, payload }
  };
  q.push(entry);
  writeLS(LS_QUEUE, q);
  emit();
  return entry.id;
}

/* Reemplaza una operación (p. ej. al asignarle el id real de la BD).
 * Devuelve la op actualizada o null. */
export function updateOp(localId, patch) {
  const q = readLS(LS_QUEUE);
  const i = q.findIndex((o) => o.id === localId);
  if (i === -1) return null;
  q[i] = { ...q[i], ...patch };
  writeLS(LS_QUEUE, q);
  emit();
  return q[i];
}

export function dequeueOp(localId) {
  const q = readLS(LS_QUEUE).filter((o) => o.id !== localId);
  writeLS(LS_QUEUE, q);
  emit();
}

/* Incrementa el contador de intentos; devuelve true si debe reintentar */
export function failOp(localId) {
  const q = readLS(LS_QUEUE);
  const i = q.findIndex((o) => o.id === localId);
  if (i === -1) return false;
  q[i].tries += 1;
  writeLS(LS_QUEUE, q);
  return q[i].tries < 5; // tope de 5 intentos, luego queda pendiente manual
}

/* ---- eventos para la UI (banner, contadores) ---- */
const listeners = new Set();
let lastEmit = null;

function emit() {
  lastEmit = Date.now();
  writeLS(LS_EMITS, [lastEmit]);
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribeQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Otras pestañas de la misma app sincronizan la cola via storage-event */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_EMITS) {
      listeners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    }
  });
}

/* Limpieza total (logout) */
export function clearQueue() {
  writeLS(LS_QUEUE, []);
  emit();
}

/* ¿Hay internet ahora? (usar antes de intentar escribir a Supabase) */
export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
