'use client';

import { useState } from 'react';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';
import { rpcRegistrarVenta } from '@/lib/rpc-helpers';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const norm = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

export default function VenderClient({ products: initialProducts, lots: initialLots, clients }) {
  const [products, setProducts] = useState(initialProducts);
  const [lotsState, setLotsState] = useState(initialLots);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [payMethod, setPayMethod] = useState('efectivo');
  const [fiadoClient, setFiadoClient] = useState('');
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    // Los errores duran más: un fallo de dinero no puede desaparecer antes
    // de que la dueña lo lea (QA 2026-09-14: C-7).
    setTimeout(() => setToast(null), ok ? 2600 : 4500);
  };

  const lotById = {};
  lotsState.forEach((l) => (lotById[l.id] = l));

  // Stock REAL del lote (piezas que quedan). El chequeo de sobreventa usa
  // SIEMPRE este — nunca resta el carrito aquí o bloquea de más (bug visto
  // en prueba manual: pedía 5 de 5 y se trababa en el 3.º).
  const stockOf = (p) => {
    if (!p.lot_id || !lotById[p.lot_id]) return null;
    return lotById[p.lot_id].pieces_left;
  };
  const inCart = (productId) => cart.find((i) => i.productId === productId)?.qty || 0;

  // Detectar si el nombre escrito coincide con un cliente existente (para sugerir/buscar al fiar)
  const fiadoSugerencia = (() => {
    const q = fiadoClient.trim().toLowerCase();
    if (!q) return null;
    const exact = clients.find((c) => c.name.toLowerCase() === q);
    if (exact) return { ...exact, debe: Number(exact.balance) > 0 };
    return null;
  })();

  // Sugerencias de cliente al fiar: filtradas por lo escrito, máximo 6 (la lista puede ser muy larga)
  const clientMatches = (() => {
    const q = norm(fiadoClient);
    if (!q) return [];
    return clients
      .filter((c) => norm(c.name).includes(q))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 6);
  })();

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((a, i) => a + i.price * i.qty, 0);

  const addToCart = (p) => {
    const stock = stockOf(p);
    setCart((c) => {
      const found = c.find((i) => i.productId === p.id);
      // No agregar más de las piezas disponibles (si el producto tiene lote)
      if (stock !== null) {
        const enCarrito = found ? found.qty : 0;
        if (enCarrito >= stock) {
          showToast(stock <= 0 ? `"${p.name}" está agotado` : `Solo quedan ${stock} de "${p.name}"`, false);
          return c;
        }
      }
      if (found) {
        return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { productId: p.id, name: p.name, price: Number(p.sale_price), qty: 1, lotId: p.lot_id }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart((c) => {
      const item = c.find((i) => i.productId === productId);
      // Sobreventa bloqueada también desde los botones +/− del carrito
      // (QA 2026-09-14: D-4): no se puede pedir más de las piezas que
      // quedan en el lote del producto.
      if (item && delta > 0 && item.lotId) {
        const lote = lotById[item.lotId];
        if (lote && item.qty + delta > lote.pieces_left) {
          showToast(
            lote.pieces_left <= 0 ? `"${item.name}" está agotado` : `Solo quedan ${lote.pieces_left} de "${item.name}"`,
            false
          );
          return c;
        }
      }
      return c
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
    });
  };

  const applyLocalStock = (items) => {
    // Estado local de stock SIN mutar props: crea copias nuevas de lots
    setLotsState((list) =>
      list.map((l) => {
        const item = items.find((i) => i.lotId === l.id);
        return item ? { ...l, pieces_left: l.pieces_left - item.qty } : l;
      })
    );
    setProducts((list) =>
      list.map((p) => {
        const item = items.find((i) => i.productId === p.id);
        return item ? { ...p, sold_count: p.sold_count + item.qty } : p;
      })
    );
  };

  const confirmSale = async () => {
    if (busy || cart.length === 0) return;
    if (payMethod === 'fiado' && !fiadoClient.trim()) {
      showToast('Escribe el nombre del cliente para el crédito', false);
      return;
    }
    setBusy(true);
    try {
      const itemsCount = cart.reduce((a, i) => a + i.qty, 0);
      const clientName = payMethod === 'fiado' ? fiadoClient.trim() : null;

      if (isOffline()) {
        // ===== MODO OFFLINE: guardar en la cola local =====
        const localId = uuid();
        enqueueOp({
          type: 'sale',
          payload: {
            localId,
            createdAt: new Date().toISOString(),
            total,
            itemsCount,
            channel: 'mostrador',
            paymentMethod: payMethod === 'fiado' ? 'fiado' : payMethod,
            clientName,
            notes: cart.map((i) => `${i.qty}x ${i.name}`).join(', ').slice(0, 200),
            paymentLocalId: payMethod === 'fiado' ? null : uuid(),
            items: cart.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              lotId: i.lotId,
            })),
          },
        });
        applyLocalStock(cart);
        setCart([]);
        setFiadoClient('');
        showToast(
          payMethod === 'fiado'
            ? `Crédito de ${money(total)} guardado (se sincroniza solo)`
            : `Venta de ${money(total)} guardada (se sincroniza sola)`
        );
        return;
      }

      // IDs REUSABLES durante el intento actual: si el RPC llega al servidor
      // pero la respuesta se pierde, el reintento con los MISMOS ids no
      // duplica ni la venta ni el pago (idempotencia por id en la BD).
      const saleId = uuid();
      const paymentId = payMethod === 'fiado' ? null : uuid();

      // RPC TRANSACCIONAL ÚNICO: venta + payment/deuda + stock + vendidos
      // en UNA llamada atómica (migración 10). Si algo falla, no entra
      // nada a medias — el carrito NO se vacía y el reintento es seguro.
      const { error: errRpc } = await rpcRegistrarVenta({
        saleId,
        total,
        itemsCount,
        channel: 'mostrador',
        paymentMethod: payMethod,
        clientName,
        notes: cart.map((i) => `${i.qty}x ${i.name}`).join(', ').slice(0, 200),
        paymentId,
        items: cart.map((i) => ({ productId: i.productId, lotId: i.lotId, qty: i.qty })),
      });
      if (errRpc) throw new Error('No se registró la venta: ' + errRpc.message);

      applyLocalStock(cart);

      setCart([]);
      setFiadoClient('');
      showToast(
        payMethod === 'fiado'
          ? `Crédito de ${money(total)} registrado`
          : `Venta de ${money(total)} registrada`
      );
    } catch (err) {
      showToast('Error: ' + err.message + ' — puedes reintentar, no se duplica', false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Buscador */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto en inventario…"
          className="flex-1 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant bg-transparent"
          type="search"
        />
      </div>

      {products.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">
            No hay productos. Agrégalos en Inventario → Productos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map((p) => {
          const stock = stockOf(p);
          return (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-left active:bg-surface-container-low transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4a7 7 0 0 1 7 7c0 2-1 3-2 4l-.5 4h-9L7 15c-1-1-2-2-2-4a7 7 0 0 1 7-7z" />
                  </svg>
                </div>
                {stock !== null ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap ${
                      stock <= 0 ? 'bg-inverse-surface text-inverse-on-surface'
                        : stock <= 5 ? 'bg-primary text-on-primary'
                        : 'bg-primary-fixed text-primary'
                    }`}
                  >
                    {stock <= 0 ? 'Agotado' : `Quedan ${stock}`}
                    {inCart(p.id) > 0 && stock > 0 ? ` · llevas ${inCart(p.id)}` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full bg-surface-container-low border border-outline text-on-surface-variant whitespace-nowrap">
                    Sin lote
                  </span>
                )}
              </div>
              <p className="text-[13px] font-semibold text-on-surface truncate leading-tight">{p.name}</p>
              <p className="text-[14px] font-bold text-primary mt-0.5">{money(p.sale_price)}</p>
            </button>
          );
        })}
      </div>

      {/* Carrito */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 md:bottom-4 inset-x-0 md:inset-x-auto md:right-6 md:w-96 z-40 bg-surface rounded-t-2xl md:rounded-2xl border-t-2 border-primary md:border outline-none p-3.5">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[14px] text-on-surface">Venta en curso</b>
            <button onClick={() => setCart([])} className="text-[12px] text-error font-semibold">
              Vaciar
            </button>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto">
            {cart.map((i) => (
              <div key={i.productId} className="flex items-center justify-between bg-surface-container-low border border-outline rounded-[10px] px-3 py-1.5">
                <span className="text-[12.5px] text-on-surface truncate flex-1">{i.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <button onClick={() => changeQty(i.productId, -1)} className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center text-[15px]">−</button>
                  <span className="text-[13px] font-bold text-on-surface w-5 text-center">{i.qty}</span>
                  <button onClick={() => changeQty(i.productId, 1)} className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center text-[15px]">+</button>
                  <span className="text-[13px] font-bold text-primary w-16 text-right">{money(i.price * i.qty)}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline">
            <span className="text-[13px] text-on-surface-variant">Total</span>
            <span className="text-[20px] font-bold text-on-surface">{money(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <button
              onClick={() => setPayMethod('efectivo')}
              className={`h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                payMethod === 'efectivo' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
              }`}
            >
              Al contado
            </button>
            <button
              onClick={() => setPayMethod('transferencia')}
              className={`h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                payMethod === 'transferencia' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
              }`}
            >
              Transferencia
            </button>
            <button
              onClick={() => setPayMethod('fiado')}
              className={`h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                payMethod === 'fiado' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
              }`}
            >
              Crédito
            </button>
          </div>

          {payMethod === 'fiado' && (
            <div className="mt-2 relative">
              <input
                value={fiadoClient}
                onChange={(e) => {
                  setFiadoClient(e.target.value);
                  setClientPickerOpen(true);
                }}
                onFocus={() => setClientPickerOpen(true)}
                onBlur={() => setTimeout(() => setClientPickerOpen(false), 150)}
                placeholder="Buscar o escribir nombre del cliente"
                autoComplete="off"
                className="w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary"
              />
              {clientPickerOpen && clientMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-outline rounded-[10px] shadow-lg max-h-48 overflow-y-auto">
                  {clientMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFiadoClient(c.name);
                        setClientPickerOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left active:bg-surface-container-low"
                    >
                      <span className="text-[13px] font-semibold text-on-surface truncate">{c.name}</span>
                      <span className={`text-[10.5px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap ${Number(c.balance) > 0 ? 'bg-primary-fixed text-primary' : 'bg-surface-container-low border border-outline text-on-surface-variant'}`}>
                        {Number(c.balance) > 0 ? `Debe ${money(c.balance)}` : 'Al día'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {fiadoSugerencia && (
                <p className={`text-[11px] font-semibold mt-1 ${fiadoSugerencia.debe ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {fiadoSugerencia.debe
                    ? `Ya existe: ${fiadoSugerencia.name} · debe ${money(fiadoSugerencia.balance)}`
                    : `Ya existe: ${fiadoSugerencia.name} · al día`}
                </p>
              )}
              {/* Si el nombre no coincide con NADIE, avisar que se va a crear
                  uno nuevo — la dueña sabe si hace un cliente duplicado
                  (ha pasado escribiendo con tildes o con typo) */}
              {!fiadoSugerencia && fiadoClient.trim() && clientMatches.length === 0 && (
                <p className="text-[11px] font-semibold mt-1 text-on-surface-variant flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="10" cy="8" r="3.4" />
                    <path d="M4 20c1.4-3.4 3.6-5 6-5 1.6 0 3 .6 4.2 1.7M18 8v6M15 11h6" />
                  </svg>
                  Se creará cliente nuevo: <b className="text-on-surface">{fiadoClient.trim()}</b>
                </p>
              )}
            </div>
          )}

          <button
            onClick={confirmSale}
            disabled={busy}
            className="w-full h-13 py-3 mt-2.5 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 active:bg-primary-deep transition-colors disabled:opacity-60"
          >
            {busy ? 'Registrando…' : payMethod === 'fiado' ? `Dar crédito ${money(total)}` : `Cobrar ${money(total)}`}
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 inset-x-4 z-[60] flex justify-center pointer-events-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]">
          <div className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-[13px] font-semibold ${toast.ok ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {toast.ok ? <path d="M4 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
            <span>{toast.m}</span>
          </div>
        </div>
      )}
    </div>
  );
}
