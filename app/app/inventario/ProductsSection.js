'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { isOffline, enqueueOp } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const norm = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

export default function ProductsSection({ initialProducts, lots }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [editOpen, setEditOpen] = useState(null); // producto en edición
  const [editForm, setEditForm] = useState({ name: '', price: '' });

  const lotById = {};
  (lots || []).forEach((l) => (lotById[l.id] = l));
  const stockOf = (p) => (p.lot_id && lotById[p.lot_id] ? lotById[p.lot_id].pieces_left : null);
  // Métricas de costo/ganancia por pieza (solo productos con lote interno)
  const unitCostOf = (p) => {
    const l = p.lot_id ? lotById[p.lot_id] : null;
    if (!l || !l.pieces_total) return null;
    return Number(l.total_cost) / l.pieces_total;
  };
  const profitOf = (p) => {
    const c = unitCostOf(p);
    return c === null ? null : Number(p.sale_price) - c;
  };
  const money2 = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const q = norm(search);
  const filtered = q
    ? products.filter((p) => norm(p.name).includes(q) || norm(p.code).includes(q))
    : products;

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const openEdit = (p) => {
    setEditForm({ name: p.name, price: String(Number(p.sale_price)) });
    setEditOpen(p);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editOpen || busy) return;
    const name = editForm.name.trim();
    const price = parseFloat(editForm.price);
    if (!name || !price || price <= 0) {
      showToast('Completa nombre y precio válido', false);
      return;
    }
    setBusy(true);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: edición local =====
        enqueueOp({
          type: 'product_edit',
          payload: { productId: editOpen.id, name, price },
        });
        setProducts((list) => list.map((p) => (p.id === editOpen.id ? { ...p, name, sale_price: price } : p)));
        setEditOpen(null);
        showToast('Producto actualizado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .update({ name, sale_price: price })
        .eq('id', editOpen.id);
      if (error) throw error;
      setProducts((list) => list.map((p) => (p.id === editOpen.id ? { ...p, name, sale_price: price } : p)));
      setEditOpen(null);
      showToast('Producto actualizado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async (p) => {
    if (busy) return;
    const stock = stockOf(p);
    const ok = confirm(
      `¿Eliminar "${p.name}"${stock !== null ? ` (quedaban ${stock} prendas)` : ''}?\n\n` +
        `Dejará de aparecer en Vender. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      setProducts((list) => list.filter((x) => x.id !== p.id));
      showToast('Producto eliminado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2.5">
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Productos</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">
          {products.length}
        </span>
      </div>
      <p className="text-[12px] text-on-surface-variant px-0.5 -mt-1.5">
        Los que agregues arriba aparecen en el apartado Vender.
      </p>

      {/* Buscador de productos */}
      {products.length > 0 && (
        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto por nombre o código…"
            className="flex-1 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant bg-transparent"
            type="search"
          />
          {search && (
            <span className="text-[10.5px] font-semibold text-on-surface-variant whitespace-nowrap">
              {filtered.length} de {products.length}
            </span>
          )}
        </div>
      )}

      {products.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Sin productos aún. Ingresa el primero con el botón rosa de arriba.</p>
        </div>
      )}

      {products.length > 0 && filtered.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Ningún producto coincide con «{search}».</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1 max-h-[55vh] overflow-y-auto scroll-box">
          {filtered.map((p) => {
            const stock = stockOf(p);
            const lot = p.lot_id ? lotById[p.lot_id] : null;
            const unitCost = unitCostOf(p);
            const profit = profitOf(p);
            return (
              <div key={p.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
                <div className="flex-1 min-w-0">
                  <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                    <span className="inline-block bg-primary-fixed text-primary text-[10px] font-bold px-1.5 py-[2px] rounded-md mr-1.5 align-middle">
                      {p.code}
                    </span>
                    {p.name}
                  </b>
                  <span className="block text-[11.5px] text-on-surface-variant">
                    {p.sold_count} vendidos
                    {unitCost !== null && (
                      <>
                        {' · '}costo <b className="text-on-surface-variant">{money2(unitCost)}</b> c/u
                      </>
                    )}
                    {profit !== null && profit > 0 && (
                      <>
                        {' · '}ganas <b className="text-primary">{money2(profit)}</b> c/u
                      </>
                    )}
                  </span>
                  {lot && (
                    <span className="block text-[11px] text-on-surface-variant">
                      Inversión <b className="text-on-surface-variant">{money(lot.total_cost)}</b>
                    </span>
                  )}
                </div>
                {stock !== null && (
                  <span
                    className={`text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap ${
                      stock <= 0 ? 'bg-inverse-surface text-inverse-on-surface'
                        : stock <= 5 ? 'bg-primary text-on-primary'
                        : 'bg-primary-fixed text-primary'
                    }`}
                  >
                    {stock <= 0 ? 'Agotado' : `Quedan ${stock}`}
                  </span>
                )}
                <span className="text-[14px] font-bold text-primary">{money(p.sale_price)}</span>
                <button
                  onClick={() => openEdit(p)}
                  disabled={busy}
                  title={`Editar ${p.name}`}
                  aria-label={`Editar ${p.name}`}
                  className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-50"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteProduct(p)}
                  disabled={busy}
                  title={`Eliminar ${p.name}`}
                  className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-50"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal editar producto */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setEditOpen(null)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="text-[16px] text-on-surface">Editar producto</b>
              <button onClick={() => setEditOpen(null)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="text-[11.5px] text-on-surface-variant mb-3">
              <span className="inline-block bg-primary-fixed text-primary text-[10px] font-bold px-1.5 py-[2px] rounded-md mr-1.5">{editOpen.code}</span>
              {editOpen.sold_count} vendidos
              {(() => { const st = stockOf(editOpen); return st !== null ? ` · quedan ${st}` : ''; })()}
            </div>
            {(() => {
              const l = editOpen.lot_id ? lotById[editOpen.lot_id] : null;
              if (!l) return null;
              const unitCost = l.pieces_total ? Number(l.total_cost) / l.pieces_total : null;
              const profit = unitCost !== null ? Number(editOpen.sale_price) - unitCost : null;
              const margin = profit !== null && Number(editOpen.sale_price) > 0 ? (profit / Number(editOpen.sale_price)) * 100 : null;
              const sold = l.pieces_total - l.pieces_left;
              const soldValue = sold * Number(editOpen.sale_price);
              const soldCost = unitCost !== null ? sold * unitCost : null;
              const stockValue = unitCost !== null ? l.pieces_left * unitCost : null;
              return (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Costo total</div>
                    <div className="text-[15px] font-bold text-on-surface mt-0.5">{money(l.total_cost)}</div>
                    <div className="text-[10.5px] text-on-surface-variant">{l.pieces_total} prendas ingresadas</div>
                  </div>
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Costo por pieza</div>
                    <div className="text-[15px] font-bold text-on-surface mt-0.5">{unitCost !== null ? money2(unitCost) : '—'}</div>
                    <div className="text-[10.5px] text-on-surface-variant">lo que te costó cada una</div>
                  </div>
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Ganancia por pieza</div>
                    <div className={`text-[15px] font-bold mt-0.5 ${profit !== null && profit >= 0 ? 'text-primary' : 'text-error'}`}>
                      {profit !== null ? (profit >= 0 ? '+' : '') + money2(profit) : '—'}
                    </div>
                    {margin !== null && (
                      <div className="text-[10.5px] text-on-surface-variant">margen {margin.toFixed(0)}%</div>
                    )}
                  </div>
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Precio de venta</div>
                    <div className="text-[15px] font-bold text-on-surface mt-0.5">{money(editOpen.sale_price)}</div>
                    <div className="text-[10.5px] text-on-surface-variant">por prenda</div>
                  </div>
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Vendidas</div>
                    <div className="text-[15px] font-bold text-on-surface mt-0.5">{sold} de {l.pieces_total}</div>
                    <div className="text-[10.5px] text-on-surface-variant">
                      {soldCost !== null ? `costo C${soldCost.toLocaleString('es-NI', { maximumFractionDigits: 0 })} · ventas ${money(soldValue)}` : `ventas ${money(soldValue)}`}
                    </div>
                  </div>
                  <div className="bg-surface-container-low rounded-[10px] px-3 py-2.5">
                    <div className="text-[10.5px] font-semibold text-on-surface-variant uppercase tracking-[0.05em]">Valor en stock</div>
                    <div className="text-[15px] font-bold text-on-surface mt-0.5">
                      {stockValue !== null ? money(stockValue) : '—'}
                      <span className="text-[10.5px] font-normal text-on-surface-variant"> en costo</span>
                    </div>
                    <div className="text-[10.5px] text-on-surface-variant">
                      vendible en {money(l.pieces_left * Number(editOpen.sale_price))}
                    </div>
                  </div>
                </div>
              );
            })()}
            <form className="space-y-2.5" onSubmit={saveEdit}>
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Nombre</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Precio de venta (C$)</label>
                <input
                  required
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditOpen(null)} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-16 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-[13px] font-semibold ${toast.ok ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {toast.ok ? <path d="M4 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
            <span>{toast.m}</span>
          </div>
        </div>
      )}
    </section>
  );
}
