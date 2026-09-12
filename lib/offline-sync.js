'use client';

/* ============================================================
 * Sincronizador offline de PacaPOS
 * Procesa la cola (FIFO) cuando hay internet. Cada tipo de
 * operación se envía de forma IDEMPOTENTE: usa ids pre-generados
 * en el cliente para que un reintento no duplique dinero.
 * ============================================================ */

import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { getQueue, getQueueCount, dequeueOp, failOp, updateOp } from '@/lib/offline-queue';

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

/* Busca una fila por campo (case-insensitive) y la devuelve, o null. */
async function findClient(supabase, storeId, name) {
  const { data } = await supabase
    .from('clients')
    .select('id, name, balance')
    .ilike('name', name)
    .limit(5);
  const list = data || [];
  return list.find((c) => (c.name || '').toLowerCase() === name.toLowerCase()) || null;
}

/* Balance real del cliente desde la BD (fuente de verdad). */
async function clientBalance(supabase, clientId) {
  const { data } = await supabase.from('clients').select('balance').eq('id', clientId).maybeSingle();
  return Number(data?.balance || 0);
}

/* Upsert idempotente de abono: si ya existe un payment con el id local, no repite. */
async function upsertAbono(supabase, op) {
  const p = op.payload;
  const clientId = p.clientId;
  const monto = Number(p.amount);

  // 1) Verificar si ya se aplicó este abono (id local en el payload del payment)
  const { data: existing } = await supabase.from('payments').select('id').eq('id', p.localId).limit(1);
  if (existing && existing.length > 0) return { ok: true };

  // 2) Leer deudas pendientes FIFO (la más antigua primero)
  const { data: debts, error: errDebts } = await supabase
    .from('debts')
    .select('id, remaining')
    .eq('client_id', clientId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true });
  if (errDebts) return { ok: false, error: errDebts };

  // 3) Insertar el payment con id pre-generado
  const ctx = await getMyContext();
  const { error: errPay } = await supabase.from('payments').insert({
    id: p.localId,
    amount: monto,
    method: p.method || 'efectivo',
    debt_id: (debts || [])[0]?.id || null,
    store_id: ctx.storeId,
    user_id: ctx.userId,
  });
  if (errPay && errPay.code !== '23505') return { ok: false, error: errPay };

  // 4) Descontar de las deudas (FIFO) y recalcular balance desde la BD
  let remaining = monto;
  for (const d of debts || []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(d.remaining));
    const newRemaining = Number(d.remaining) - take;
    const { error: errUpd } = await supabase
      .from('debts')
      .update({ remaining: newRemaining, status: newRemaining <= 0 ? 'saldada' : 'pendiente' })
      .eq('id', d.id);
    if (errUpd) return { ok: false, error: errUpd };
    remaining -= take;
  }

  // 5) Balance = suma real de deudas pendientes (evita drift)
  const balanceFinal = await recomputeBalance(supabase, clientId);
  if (balanceFinal === null) return { ok: false, error: new Error('No se pudo recalcular el saldo') };
  return { ok: true, data: { balance: balanceFinal } };
}

/* Recalcula el balance del cliente como suma de sus deudas pendientes. */
async function recomputeBalance(supabase, clientId) {
  const { data, error } = await supabase
    .from('debts')
    .select('remaining')
    .eq('client_id', clientId)
    .eq('status', 'pendiente');
  if (error) return null;
  const sum = (data || []).reduce((a, d) => a + Number(d.remaining), 0);
  const { error: errUpd } = await supabase.from('clients').update({ balance: sum }).eq('id', clientId);
  if (errUpd) return null;
  return sum;
}

/* ============================================================
 * PROCESADORES POR TIPO DE OPERACIÓN
 * Cada uno devuelve { ok, error?, data? }
 * ============================================================ */

const processors = {
  /* Venta de mostrador (contado o fiado) */
  async sale(supabase, ctx, op) {
    const p = op.payload;
    const row = {
      id: p.localId,
      total: p.total,
      items_count: p.itemsCount,
      channel: p.channel || 'mostrador',
      payment_method: p.paymentMethod,
      client_name: p.clientName || null,
      notes: p.notes || null,
      store_id: ctx.storeId,
      user_id: ctx.userId,
    };
    const res = await insertWithId(supabase, 'sales', row);
    if (!res.ok) return res;

    if (p.paymentMethod === 'fiado') {
      // Fiado: buscar/crear cliente + deuda ligada a la venta
      let client = await findClient(supabase, ctx.storeId, p.clientName);
      if (!client) {
        const { data: created, error } = await supabase
          .from('clients')
          .insert({ name: p.clientName, balance: 0, store_id: ctx.storeId })
          .select('id, name, balance')
          .single();
        if (error) return { ok: false, error };
        client = created;
      }
      const { error: errDebt } = await supabase.from('debts').insert({
        client_id: client.id,
        original_amount: p.total,
        remaining: p.total,
        description: (p.notes || 'Fiado mostrador').slice(0, 100),
        status: 'pendiente',
        sale_id: p.localId,
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (errDebt) return { ok: false, error: errDebt };
      const balance = await recomputeBalance(supabase, client.id);
      if (balance === null) return { ok: false, error: new Error('No se pudo actualizar el saldo') };
      return { ok: true, data: { clientId: client.id, balance } };
    }

    // Contado: payment de la venta con id pre-generado
    const { error: errPay } = await supabase.from('payments').insert({
      id: p.paymentLocalId,
      sale_id: p.localId,
      amount: p.total,
      method: p.method || 'efectivo',
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
    if (errPay && errPay.code !== '23505') return { ok: false, error: errPay };

    // Stock y contadores de productos
    for (const it of p.items || []) {
      await supabase
        .from('products')
        .update({ sold_count: it.soldCount })
        .eq('id', it.productId);
      if (it.lotId) {
        await supabase.from('lots').update({ pieces_left: it.piecesLeft }).eq('id', it.lotId);
      }
    }
    return { ok: true };
  },

  /* Apartado de Live (pendiente) */
  async live_hold(supabase, ctx, op) {
    const p = op.payload;
    return insertWithId(supabase, 'sales', {
      id: p.localId,
      total: p.total,
      items_count: 1,
      channel: 'tiktok_live',
      payment_method: 'fiado',
      client_name: p.clientName,
      notes: p.notes || null,
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
  },

  /* Cobrar apartado de Live (venta local → efectivo + payment) */
  async live_collect(supabase, ctx, op) {
    const p = op.payload;
    const { error: errUpd } = await supabase
      .from('sales')
      .update({ payment_method: 'efectivo' })
      .eq('id', p.saleLocalId);
    if (errUpd) return { ok: false, error: errUpd };
    const { error: errPay } = await supabase.from('payments').insert({
      id: p.paymentLocalId,
      sale_id: p.saleLocalId,
      amount: p.amount,
      method: 'efectivo',
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
    if (errPay && errPay.code !== '23505') return { ok: false, error: errPay };
    return { ok: true };
  },

  /* Fiar apartado de Live (deuda ligada a la venta local) */
  async live_fiado(supabase, ctx, op) {
    const p = op.payload;
    // Verificar que la venta no esté ya fiada (anti doble-fiado)
    const { data: existingDebt } = await supabase
      .from('debts')
      .select('id')
      .eq('sale_id', p.saleLocalId)
      .limit(1);
    if (existingDebt && existingDebt.length > 0) return { ok: true }; // ya estaba fiada

    let client = await findClient(supabase, ctx.storeId, p.clientName);
    if (!client) {
      const { data: created, error } = await supabase
        .from('clients')
        .insert({ name: p.clientName, is_live_client: true, balance: 0, store_id: ctx.storeId })
        .select('id, name, balance')
        .single();
      if (error) return { ok: false, error };
      client = created;
    }
    const { error: errDebt } = await supabase.from('debts').insert({
      client_id: client.id,
      original_amount: p.amount,
      remaining: p.amount,
      description: p.notes || 'Prenda de Live',
      status: 'pendiente',
      sale_id: p.saleLocalId,
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
    if (errDebt) return { ok: false, error: errDebt };
    const balance = await recomputeBalance(supabase, client.id);
    if (balance === null) return { ok: false, error: new Error('No se pudo actualizar el saldo') };
    return { ok: true, data: { clientId: client.id, balance } };
  },

  /* Edición de apartado pendiente (cliente/prenda/precio) */
  async live_edit(supabase, ctx, op) {
    const p = op.payload;
    const { error } = await supabase
      .from('sales')
      .update({
        client_name: p.clientName,
        notes: p.notes || null,
        total: p.total,
      })
      .eq('id', p.saleLocalId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Eliminar apartado pendiente */
  async live_delete(supabase, ctx, op) {
    const p = op.payload;
    // Verificar que no tenga deuda ligada (no borrar ventas ya fiadas)
    const { data: existingDebt } = await supabase
      .from('debts')
      .select('id')
      .eq('sale_id', p.saleLocalId)
      .limit(1);
    if (existingDebt && existingDebt.length > 0) {
      return { ok: false, error: new Error('El apartado ya está fiado, no se puede eliminar') };
    }
    const { error } = await supabase.from('sales').delete().eq('id', p.saleLocalId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Abono de deuda (Clientes o Inicio) */
  async abono(supabase, ctx, op) {
    return upsertAbono(supabase, op);
  },

  /* Fiado directo desde la hoja de cliente */
  async fiado_directo(supabase, ctx, op) {
    const p = op.payload;
    // Idempotente: si ya existe deuda con el id local, listo
    const { data: existing } = await supabase.from('debts').select('id').eq('id', p.localId).limit(1);
    if (existing && existing.length > 0) return { ok: true };
    const { error: errDebt } = await supabase.from('debts').insert({
      id: p.localId,
      client_id: p.clientId,
      original_amount: p.amount,
      remaining: p.amount,
      description: 'Fiado directo',
      status: 'pendiente',
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
    if (errDebt && errDebt.code !== '23505') return { ok: false, error: errDebt };
    const balance = await recomputeBalance(supabase, p.clientId);
    if (balance === null) return { ok: false, error: new Error('No se pudo actualizar el saldo') };
    return { ok: true, data: { balance } };
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

  /* Gasto (Más → Gastos) */
  async expense(supabase, ctx, op) {
    const p = op.payload;
    return insertWithId(supabase, 'expenses', {
      id: p.localId,
      concept: p.concept,
      amount: p.amount,
      category: p.category || 'otro',
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
  },

  /* Edición de gasto (concepto/monto/categoría) */
  async expense_edit(supabase, ctx, op) {
    const p = op.payload;
    const { error } = await supabase
      .from('expenses')
      .update({ concept: p.concept, amount: p.amount, category: p.category })
      .eq('id', p.expenseId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Eliminación de gasto */
  async expense_delete(supabase, ctx, op) {
    const p = op.payload;
    const { error } = await supabase.from('expenses').delete().eq('id', p.expenseId);
    if (error) return { ok: false, error };
    return { ok: true };
  },

  /* Corte de caja */
  async cash_cut(supabase, ctx, op) {
    const p = op.payload;
    // Idempotente: no dos cortes el mismo día
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from('cash_cuts')
      .select('id')
      .gte('created_at', start.toISOString())
      .limit(1);
    if (existing && existing.length > 0) return { ok: true, data: { skipped: true } };
    return insertWithId(supabase, 'cash_cuts', {
      id: p.localId,
      sales_total: p.salesTotal,
      collected_total: p.collectedTotal,
      credit_total: 0,
      expenses_total: p.expensesTotal,
      notes: p.notes,
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
  },

  /* Producto nuevo (Inventario → Ingresar producto) */
  async product_new(supabase, ctx, op) {
    const p = op.payload;
    // Idempotente por id de lote local
    const { data: existingLot } = await supabase.from('lots').select('id').eq('id', p.lotLocalId).limit(1);
    if (existingLot && existingLot.length > 0) return { ok: true };
    // Calcular códigos reales ahora que hay conexión
    const { count: lotCount } = await supabase.from('lots').select('id', { count: 'exact', head: true });
    const { count: prodCount } = await supabase.from('products').select('id', { count: 'exact', head: true });
    const res = await insertWithId(supabase, 'lots', {
      id: p.lotLocalId,
      code: 'Paca #' + ((lotCount || 0) + 1),
      name: p.name,
      pieces_total: p.pieces,
      pieces_left: p.pieces,
      total_cost: p.cost,
      avg_sale_price: p.price,
      store_id: ctx.storeId,
      user_id: ctx.userId,
    });
    if (!res.ok) return res;
    const { error: errProd } = await supabase.from('products').insert({
      id: p.productLocalId,
      code: 'P-' + String((prodCount || 0) + 1).padStart(3, '0'),
      name: p.name,
      sale_price: p.price,
      lot_id: p.lotLocalId,
      store_id: ctx.storeId,
    });
    if (errProd && errProd.code !== '23505') {
      // Rollback del lote: evita stock huérfano sin producto
      await supabase.from('lots').delete().eq('id', p.lotLocalId);
      return { ok: false, error: errProd };
    }
    return { ok: true };
  },

  /* Edición de producto (nombre/precio) */
  async product_edit(supabase, ctx, op) {
    const p = op.payload;
    const { error } = await supabase
      .from('products')
      .update({ name: p.name, sale_price: p.price })
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
