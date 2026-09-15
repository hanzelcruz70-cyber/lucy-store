'use client';

/* ============================================================
 * Sincronizador offline de Mi Prenda
 * Procesa la cola (FIFO) cuando hay internet. Cada tipo de
 * operación se envía de forma IDEMPOTENTE:
 *  - operaciones de dinero → RPCs transaccionales (todo o nada)
 *  - ids pre-generados en el cliente (un reintento no duplica)
 *  - montos validados (sanitizeNumber) antes de tocar la BD
 *  - TODAS las operaciones conservan su FECHA ORIGINAL de negocio
 *    (op.createdAt), no la fecha del sync (migración 10)
 * ============================================================ */

import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { getQueue, getQueueCount, dequeueOp, failOp, updateOp } from '@/lib/offline-queue';
import { sanitizeNumber, isUuid } from '@/lib/validation';
import { nicDayKey } from '@/lib/day';

let syncing = false;
let onStatus = null; // callback para la UI

export function setSyncObserver(fn) {
  onStatus = fn;
}

const notify = (state, info) => {
  if (onStatus) {
    try {
      onStatus(state, info);
    } catch {}
  }
};

/* ---- helpers de insert idempotente ---- */

/* Inserta con el id local (si la fila ya existe con ese id, no duplica). */
async function insertWithId(supabase, table, row) {
  const { data, error } = await supabase.from(table).insert(row).select('id').maybeSingle();
  if (error && error.code === '23505') return { ok: true }; // unique violation = ya insertado
  if (error) return { ok: false, error };
  return { ok: true, data };
}

/* Monto validado o falla la op (queda en cola para revisar). */
function amountOrError(v, label = 'Monto inválido') {
  const n = sanitizeNumber(v, { min: 0.01 });
  return n === null ? { error: new Error(label + ': ' + v) } : { amount: n };
}

/* Fecha original del negocio (ISO string) o null si no es válida. */
function createdAtOf(op) {
  const raw = (op.payload && op.payload.createdAt) || op.createdAt;
  if (raw && !Number.isNaN(new Date(raw).getTime())) {
    return new Date(raw).toISOString();
  }
  return null;
}

/* Busca una fila por campo y la devuelve, o null. Empareja por nombre
 * NORMALIZADO (sin acentos/case, igual que norm_name() de la BD):
 * "QÁ Cliente" encuentra "QA Cliente" — el UNIQUE de migración 10 haría
 * fallar el insert crudo con 23505 de lo contrario (QA 2026-09-14: C-5). */
async function findClient(supabase, storeId, name) {
  const { data } = await supabase
    .from('clients')
    .select('id, name, balance')
    .ilike('name', name)
    .limit(5);
  const list = data || [];
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return list.find((c) => norm(c.name) === norm(name)) || null;
}

/* ============================================================
 * PROCESADORES POR TIPO DE OPERACIÓN
 * Cada uno devuelve { ok, error?, data? }
 * ============================================================ */

const processors = {
  /* Venta de mostrador (contado, transferencia o fiado) */
  async sale(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.total, 'Total de venta inválido');
    if (monto.error) return { ok: false, error: monto.error };

    // RPC transaccional ÚNICO (migración 10): venta + payment/deuda + stock
    // + vendidos en una llamada. Idempotente por id local y guardia por
    // sale_id; p_created_at conserva la fecha ORIGINAL del negocio.
    const { data, error } = await supabase.rpc('registrar_venta', {
      p_sale_id: p.localId,
      p_total: monto.amount,
      p_items_count: parseInt(p.itemsCount, 10) || 1,
      p_channel: p.channel || 'mostrador',
      p_payment_method: p.paymentMethod === 'fiado' ? 'fiado' : (p.paymentMethod || 'efectivo'),
      p_client_name: p.clientName || null,
      p_notes: p.notes || null,
      p_payment_id: p.paymentLocalId || null,
      p_items: Array.isArray(p.items) && p.items.length > 0 ? p.items : null,
      p_created_at: createdAtOf(op),
    });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  /* Apartado de Live (pendiente) */
  async live_hold(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.total, 'Total inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const createdAt = createdAtOf(op);
    return insertWithId(supabase, 'sales', {
      id: p.localId,
      total: monto.amount,
      items_count: 1,
      channel: 'tiktok_live',
      payment_method: 'fiado',
      client_name: p.clientName,
      notes: p.notes || null,
      store_id: ctx.storeId,
      user_id: ctx.userId,
      ...(createdAt ? { created_at: createdAt } : {}),
    });
  },

  /* Cobrar apartado de Live (transaccional: update + payment juntos) */
  async live_collect(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const { error } = await supabase.rpc('cobrar_venta', {
      p_sale_id: p.saleLocalId,
      p_payment_id: p.paymentLocalId,
      p_amount: monto.amount,
      p_method: p.method || 'efectivo',
    });
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Fiar apartado de Live (RPC con anti doble-fiado) */
  async live_fiado(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const { data, error } = await supabase.rpc('fiar_venta', {
      p_sale_id: p.saleLocalId,
      p_amount: monto.amount,
    });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  /* Edición de apartado pendiente (cliente/prenda/precio) */
  async live_edit(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.total, 'Precio inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const { error } = await supabase
      .from('sales')
      .update({
        client_name: p.clientName,
        notes: p.notes || null,
        total: monto.amount,
      })
      .eq('id', p.saleLocalId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Eliminar apartado pendiente */
  async live_delete(supabase, ctx, op) {
    const p = op.payload;
    // Si tiene deuda ligada ya no es eliminable online (FK lo protege);
    // en offline lo dejamos pasar como no-op para no atascar la cola:
    // la venta fiada queda en la BD y el apartado visible en Live.
    const { data: existingDebt } = await supabase
      .from('debts')
      .select('id')
      .eq('sale_id', p.saleLocalId)
      .limit(1);
    if (existingDebt && existingDebt.length > 0) {
      return { ok: true, data: { skipped: true, reason: 'fiado' } };
    }
    // Solo apartados pendientes (mismo guard que la UI online)
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', p.saleLocalId)
      .eq('payment_method', 'fiado');
    if (error && error.code !== 'PGRST116') return { ok: false, error };
    return { ok: true };
  },

  /* Abono de deuda (RPC FIFO con FOR UPDATE; idempotente por paymentId) */
  async abono(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto de abono inválido');
    if (monto.error) return { ok: false, error: monto.error };
    if (!isUuid(p.clientId)) return { ok: false, error: new Error('Cliente inválido') };
    const { data, error } = await supabase.rpc('aplicar_abono', {
      p_payment_id: p.localId,
      p_client_id: p.clientId,
      p_amount: monto.amount,
      p_method: p.method || 'efectivo',
      p_created_at: createdAtOf(op),
    });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  /* Fiado directo desde la hoja de cliente (RPC transaccional) */
  async fiado_directo(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto de fiado inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const { data, error } = await supabase.rpc('registrar_venta', {
      p_sale_id: p.saleLocalId || p.localId,
      p_total: monto.amount,
      p_items_count: 0, // crédito directo: dinero, no prendas (C-6)
      p_channel: 'mostrador',
      p_payment_method: 'fiado',
      p_client_name: p.clientName || null,
      p_notes: 'Crédito directo',
      p_payment_id: null,
      p_created_at: createdAtOf(op),
    });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  /* Cliente nuevo (desde Clientes) */
  async client_new(supabase, ctx, op) {
    const p = op.payload;
    // Si el nombre ya existe (creado en línea u otra pestaña), no duplicar
    const client = await findClient(supabase, ctx.storeId, p.name);
    if (client) return { ok: true, data: { clientId: client.id } };
    const { error } = await supabase.from('clients').insert({
      name: p.name,
      phone: p.phone || null,
      tiktok: p.tiktok || null,
      store_id: ctx.storeId,
    });
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Edición de cliente (nombre/teléfono/tiktok) */
  async client_edit(supabase, ctx, op) {
    const p = op.payload;
    if (!isUuid(p.clientId)) return { ok: false, error: new Error('Cliente inválido') };
    const { error } = await supabase
      .from('clients')
      .update({
        name: p.name,
        phone: p.phone || null,
        tiktok: p.tiktok || null,
      })
      .eq('id', p.clientId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Eliminación de cliente (encolada offline desde la hoja) */
  async client_delete(supabase, ctx, op) {
    const p = op.payload;
    if (!isUuid(p.clientId)) return { ok: false, error: new Error('Cliente inválido') };
    const { error } = await supabase.from('clients').delete().eq('id', p.clientId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Gasto (Más → Gastos) */
  async expense(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto de gasto inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const createdAt = createdAtOf(op);
    return insertWithId(supabase, 'expenses', {
      id: p.localId,
      concept: p.concept,
      amount: monto.amount,
      category: p.category || 'otro',
      store_id: ctx.storeId,
      user_id: ctx.userId,
      ...(createdAt ? { created_at: createdAt } : {}),
    });
  },

  /* Edición de gasto (concepto/monto/categoría) */
  async expense_edit(supabase, ctx, op) {
    const p = op.payload;
    const monto = amountOrError(p.amount, 'Monto inválido');
    if (monto.error) return { ok: false, error: monto.error };
    const { error } = await supabase
      .from('expenses')
      .update({ concept: p.concept, amount: monto.amount, category: p.category })
      .eq('id', p.expenseId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Eliminación de gasto */
  async expense_delete(supabase, ctx, op) {
    const p = op.payload;
    if (!isUuid(p.expenseId)) return { ok: false, error: new Error('Gasto inválido') };
    const { error } = await supabase.from('expenses').delete().eq('id', p.expenseId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Corte de caja — usa la FECHA ORIGINAL de la cola, no la del sync */
  async cash_cut(supabase, ctx, op) {
    const p = op.payload;
    const createdAt = createdAtOf(op);

    // Idempotente: no dos cortes el mismo DÍA DE NEGOCIO de Nicaragua
    // (UTC-6) de la fecha ORIGINAL — un corte a las 11PM pertenece al día
    // que empezó a las 6AM UTC, no al día UTC del timestamp.
    if (createdAt) {
      const dayKey = nicDayKey(createdAt);
      const [y, m, d] = dayKey.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 6, 0, 0, 0)); // 6AM UTC = medianoche NI
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const { data: existing } = await supabase
        .from('cash_cuts')
        .select('id')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .limit(1);
      if (existing && existing.length > 0) return { ok: true, data: { skipped: true } };
    }

    const salesTotal = sanitizeNumber(p.salesTotal) || 0;
    const collected = sanitizeNumber(p.collectedTotal) || 0;
    const expensesTotal = sanitizeNumber(p.expensesTotal) || 0;
    const abonos = sanitizeNumber(p.abonosTotal) || 0;
    const transf = sanitizeNumber(p.transferTotal) || 0;
    const fisico = sanitizeNumber(p.fisicoTotal) || 0;
    const discrepancia = sanitizeNumber(p.discrepancyAmount) || 0;

    const { data: cut, error } = await supabase
      .from('cash_cuts')
      .insert({
        id: p.localId,
        sales_total: salesTotal,
        collected_total: collected + abonos, // dinero real recolectado en efectivo
        abonos_total: abonos,
        transfer_total: transf,
        fisico_total: fisico,
        discrepancy_amount: discrepancia,
        opening_total: sanitizeNumber(p.openingTotal) || 0,
        credit_total: 0,
        expenses_total: expensesTotal,
        notes: p.notes,
        store_id: ctx.storeId,
        user_id: ctx.userId,
        ...(createdAt ? { created_at: createdAt } : {}),
      })
      .select('id')
      .maybeSingle();
    // 23505: UNIQUE(store_id, día NI) — otro dispositivo ya cerró ese día
    if (error && error.code === '23505') return { ok: true, data: { skipped: true } };
    if (error) return { ok: false, error };
    return { ok: true, data: cut };
  },

  /* Caja inicial del día (fondo con el que se abrió el turno) */
  async cash_opening(supabase, ctx, op) {
    const p = op.payload;
    const monto = sanitizeNumber(p.amount, { min: 0 });
    if (monto === null) return { ok: false, error: new Error('Monto de caja inicial inválido') };
    const { error } = await supabase
      .from('cash_openings')
      .upsert(
        { store_id: ctx.storeId, user_id: ctx.userId, day: p.day, amount: monto },
        { onConflict: 'store_id,day' }
      );
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Producto nuevo (Inventario → Ingresar producto)
   * RPC transaccional: lote + producto juntos, códigos por contador. */
  async product_new(supabase, ctx, op) {
    const p = op.payload;
    const { data, error } = await supabase.rpc('registrar_producto', {
      p_lot_id: p.lotLocalId,
      p_product_id: p.productLocalId,
      p_name: p.name,
      p_pieces: parseInt(p.pieces, 10) || 0,
      p_cost: sanitizeNumber(p.cost) || 0,
      p_price: sanitizeNumber(p.price, { min: 0.01 }) || 0,
    });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  /* Edición de producto (nombre/precio) */
  async product_edit(supabase, ctx, op) {
    const p = op.payload;
    if (!isUuid(p.productId)) return { ok: false, error: new Error('Producto inválido') };
    const precio = sanitizeNumber(p.price, { min: 0.01 });
    if (precio === null) return { ok: false, error: new Error('Precio inválido') };
    const { error } = await supabase
      .from('products')
      .update({ name: p.name, sale_price: precio })
      .eq('id', p.productId);
    if (error) return { ok: false, error };
    return { ok: true };
  },
};

/* ============================================================
 * LOOP PRINCIPAL
 * ============================================================ */

export async function syncNow(reason = 'manual') {
  if (syncing) return { running: true };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { skipped: true };
  const queue = getQueue();
  if (queue.length === 0) return { empty: true };

  syncing = true;
  notify('syncing', { total: queue.length });
  const supabase = createClient();
  let ctx;
  try {
    ctx = await getMyContext();
  } catch {
    syncing = false;
    return { error: 'sin contexto' };
  }

  let processed = 0;
  let failed = 0;
  // Copia FIFO: procesar en orden de llegada
  const pending = [...getQueue()];
  for (const op of pending) {
    const processor = processors[op.type];
    if (!processor) {
      dequeueOp(op.id); // tipo desconocido: descartar
      continue;
    }
    try {
      const res = await processor(supabase, ctx, op);
      if (res.ok) {
        dequeueOp(op.id);
        processed += 1;
      } else {
        const retry = failOp(op.id);
        if (!retry) {
          // Tope de intentos: queda en cola para revisión manual
          notify('stuck', { opType: op.type, error: res.error?.message });
        }
        failed += 1;
      }
    } catch (err) {
      const retry = failOp(op.id);
      if (!retry) notify('stuck', { opType: op.type, error: err.message });
      failed += 1;
    }
  }

  syncing = false;
  const rest = getQueueCount();
  notify(rest > 0 ? 'pending' : 'done', { processed, failed, rest });
  // Tras un sync exitoso, avisar a las páginas para refrescar datos del
  // servidor (los server components muestran cifras pre-sync si no)
  if (processed > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('miprenda:synced', { detail: { processed, failed, rest } }));
  }
  return { processed, failed, rest };
}

/* Auto-sync: al volver la conexión, al abrir la app y cada 60s con pendientes */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncNow('online'));
  window.addEventListener('focus', () => syncNow('focus'));
  setInterval(() => {
    if (getQueueCount() > 0) syncNow('interval');
  }, 60000);
}
