'use client';

/* ============================================================
 * Mi Prenda · helpers para RPCs transaccionales de Supabase
 * Toda operación de dinero del cliente pasa por aquí:
 *  - valida montos (sanitizeNumber) antes de tocar la BD
 *  - las re-ejecuciones (reintentos de red) NO duplican dinero
 * ============================================================ */

import { createClient } from '@/lib/supabase-browser';
import { sanitizeNumber } from '@/lib/validation';

/* Mensaje de "ya procesado" (sale_id con deuda / payment existente) */
export function isAlreadyProcessed(res) {
  return Boolean(res && res.alreadyProcessed);
}

/* Registro de venta completo (transaccional e idempotente).
 * channel: 'mostrador' ('tiktok_live' solo existe en ventas históricas;
 * el módulo Live se eliminó en la migración 12).
 * total_cost: el RPC calcula el costo de las prendas desde los lotes
 *        (migración 12) → ganancia real = total − total_cost.
 * clientName: obligatorio en 'fiado' (se valida en BD), opcional en
 *        contado/transferencia (queda en la venta, sin crear cliente).
 * paymentMethod: 'efectivo' | 'transferencia' | 'fiado'
 * total: TOTAL FINAL (rebaja ya restada). discount: rebaja manual
 *        (migración 11) — queda en sales.discount y el original se
 *        recupera como total + discount. La contabilidad no cambia.
 * items: [{productId, lotId, qty}] — el RPC descuenta stock/vendidos
 *        DENTRO de la transacción (migración 10): una llamada, todo o nada.
 * createdAt: fecha original del negocio (modo offline), opcional.
 * Devuelve { data, error } estilo supabase. */
export async function rpcRegistrarVenta({
  saleId,
  total,
  itemsCount,
  channel,
  paymentMethod,
  clientName,
  notes,
  paymentId,
  items,
  createdAt,
  discount,
}) {
  const monto = sanitizeNumber(total, { min: 0.01 });
  if (monto === null) return { data: null, error: new Error('Monto de venta inválido') };
  const rebaja = sanitizeNumber(discount ?? 0, { min: 0 }) ?? 0;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_sale_id: saleId,
    p_total: monto,
    p_items_count: itemsCount,
    p_channel: channel,
    p_payment_method: paymentMethod,
    p_client_name: clientName || null,
    p_notes: notes || null,
    p_payment_id: paymentId || null,
    p_items: Array.isArray(items) && items.length > 0 ? items : null,
    p_created_at: createdAt || null,
    p_discount: rebaja,
  });
  return { data, error };
}

/* Abono FIFO con bloqueo de filas (FOR UPDATE). Idempotente por paymentId.
 * createdAt: fecha original del negocio (modo offline), opcional.
 * Devuelve { applied, balance, alreadyProcessed } o error. */
export async function rpcAplicarAbono({ paymentId, clientId, amount, method, createdAt }) {
  const monto = sanitizeNumber(amount, { min: 0.01 });
  if (monto === null) return { data: null, error: new Error('Monto de abono inválido') };
  const supabase = createClient();
  const { data, error } = await supabase.rpc('aplicar_abono', {
    p_payment_id: paymentId,
    p_client_id: clientId,
    p_amount: monto,
    p_method: method || 'efectivo',
    p_created_at: createdAt || null,
  });
  return { data, error };
}

/* Decremento de stock atómico (relativo, no absoluto). */
export async function rpcDecrementStock({ lotId, qty }) {
  const supabase = createClient();
  const { error } = await supabase.rpc('decrement_stock', {
    p_lot_id: lotId,
    p_qty: Math.max(1, parseInt(qty, 10) || 1),
  });
  return { error };
}

/* Incremento de vendidos atómico. */
export async function rpcIncrementSold({ productId, qty }) {
  const supabase = createClient();
  const { error } = await supabase.rpc('increment_sold', {
    p_product_id: productId,
    p_qty: Math.max(1, parseInt(qty, 10) || 1),
  });
  return { error };
}

/* Producto + lote en una transacción, códigos por contador. */
export async function rpcRegistrarProducto({ lotId, productId, name, pieces, cost, price }) {
  const cant = parseInt(pieces, 10);
  if (!cant || cant <= 0) return { data: null, error: new Error('Cantidad inválida') };
  const precio = sanitizeNumber(price, { min: 0.01 });
  if (precio === null) return { data: null, error: new Error('Precio inválido') };
  const costo = sanitizeNumber(cost, { min: 0 }) || 0;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('registrar_producto', {
    p_lot_id: lotId,
    p_product_id: productId,
    p_name: name,
    p_pieces: cant,
    p_cost: costo,
    p_price: precio,
  });
  return { data, error };
}
