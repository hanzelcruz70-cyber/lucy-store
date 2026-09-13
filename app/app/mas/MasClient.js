'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

// Categorías de gastos de una tienda de ropa (con emoji para lista visual)
const EXPENSE_CATEGORIES = [
  { value: 'luz', label: 'Luz', emoji: '💡' },
  { value: 'agua', label: 'Agua', emoji: '💧' },
  { value: 'internet', label: 'Internet / WiFi', emoji: '📶' },
  { value: 'renta', label: 'Renta del local', emoji: '🏠' },
  { value: 'proveedor', label: 'Compra de mercadería', emoji: '👕' },
  { value: 'transporte', label: 'Transporte / Flete', emoji: '🚚' },
  { value: 'empaque', label: 'Bolsas / Empaque', emoji: '🛍️' },
  { value: 'publicidad', label: 'Publicidad / Lives', emoji: '📣' },
  { value: 'telefono', label: 'Teléfono / Datos', emoji: '📱' },
  { value: 'salario', label: 'Salario / Ayuda', emoji: '🤝' },
  { value: 'limpieza', label: 'Limpieza', emoji: '🧹' },
  { value: 'mantenimiento', label: 'Mantenimiento', emoji: '🔧' },
  { value: 'impuestos', label: 'Impuestos / Permiso', emoji: '🧾' },
  { value: 'otro', label: 'Otro', emoji: '📦' },
];

const catInfo = (value) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value) || { value, label: value, emoji: '📦' };

function extraerProductos(sales) {
  const conteo = {};
  const ingresos = {};
  for (const s of sales) {
    if (!s.notes) continue;
    const matches = [...s.notes.matchAll(/(\d+)\s*x\s*([^,]+)/gi)];
    if (matches.length > 0) {
      for (const m of matches) {
        const qty = parseInt(m[1]) || 1;
        const name = m[2].trim();
        conteo[name] = (conteo[name] || 0) + qty;
        ingresos[name] = (ingresos[name] || 0) + (Number(s.total) / Math.max(1, s.items_count || 1)) * qty;
      }
    } else if (s.items_count === 1) {
      const name = s.notes.trim();
      conteo[name] = (conteo[name] || 0) + 1;
      ingresos[name] = (ingresos[name] || 0) + Number(s.total);
    }
  }
  return Object.entries(conteo)
    .map(([name, count]) => ({ name, count, ingreso: ingresos[name] || 0 }))
    .sort((a, b) => b.count - a.count);
}

// Une las ventas por notas (ingresos reales) con el sold_count real de la BD.
// Prioriza sold_count (fuente de verdad del trigger) y siempre incluye
// TODOS los productos activos, aunque tengan 0 ventas.
// Si un producto fue ELIMINADO del inventario, deja de mostrarse aquí:
// la lista la define la tabla products, no las notas históricas.
function mergeStats(sales, products) {
  const byNotes = extraerProductos(sales);
  const byName = {};
  byNotes.forEach((p) => (byName[p.name] = p));

  const merged = (products || []).map((prod) => {
    const note = byName[prod.name];
    const count = Math.max(prod.sold_count || 0, note ? note.count : 0);
    return {
      name: prod.name,
      code: prod.code,
      count,
      ingreso: note ? note.ingreso : (prod.sold_count || 0) * Number(prod.sale_price),
      price: Number(prod.sale_price),
    };
  });

  return merged.sort((a, b) => b.count - a.count);
}

export default function MasClient({ expenses: initialExpenses, sales, products }) {
  const [tab, setTab] = useState('gastos');
  const [expenses, setExpenses] = useState(initialExpenses);
  const [form, setForm] = useState({ concept: '', amount: '', category: 'luz' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [prodSearch, setProdSearch] = useState('');
  const [editExpense, setEditExpense] = useState(null);
  const [editForm, setEditForm] = useState({ concept: '', amount: '', category: 'luz' });

  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const productos = mergeStats(sales, products);
  // Top: los más vendidos. Bottom: el resto (incluye 0 ventas), los más fríos primero.
  const top = productos.filter((p) => p.count > 0).slice(0, 8);
  const topNames = new Set(top.map((p) => p.name));
  const bottom = productos
    .filter((p) => !topNames.has(p.name))
    .sort((a, b) => a.count - b.count)
    .slice(0, 8);
  const maxCount = productos.length > 0 ? productos[0].count : 1;

  const q = norm(prodSearch);
  const filterList = (list) => (q ? list.filter((p) => norm(p.name).includes(q)) : list);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      const amt = parseFloat(form.amount);
      if (!form.concept.trim() || !amt || amt <= 0) throw new Error('Completa concepto y monto');

      if (isOffline()) {
        // ===== MODO OFFLINE: gasto local =====
        const localId = uuid();
        enqueueOp({
          type: 'expense',
          payload: { localId, concept: form.concept.trim(), amount: amt, category: form.category },
        });
        setExpenses((list) => [
          { id: localId, concept: form.concept.trim(), amount: amt, category: form.category, created_at: new Date().toISOString() },
          ...list,
        ]);
        setForm({ concept: '', amount: '', category: 'luz' });
        showToast('Gasto guardado (se sincroniza solo)');
        return;
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          concept: form.concept.trim(),
          amount: amt,
          category: form.category,
          store_id: ctx.storeId,
          user_id: ctx.userId,
        })
        .select('id, concept, amount, category, created_at')
        .single();
      if (error) throw error;
      setExpenses((list) => [data, ...list]);
      setForm({ concept: '', amount: '', category: 'luz' });
      showToast('Gasto registrado');
    } catch (err) {
      showToast(err.message, false);
    } finally {
      setBusy(false);
    }
  };

  // ---------- EDITAR GASTO ----------
  const openEditExpense = (e) => {
    setEditForm({ concept: e.concept, amount: String(Number(e.amount)), category: e.category });
    setEditExpense(e);
  };

  const saveEditExpense = async (ev) => {
    ev.preventDefault();
    if (!editExpense || busy) return;
    const concept = editForm.concept.trim();
    const amount = parseFloat(editForm.amount);
    if (!concept || !amount || amount <= 0) {
      showToast('Completa concepto y monto válido', false);
      return;
    }
    setBusy(true);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: edición local =====
        enqueueOp({
          type: 'expense_edit',
          payload: { expenseId: editExpense.id, concept, amount, category: editForm.category },
        });
        setExpenses((list) =>
          list.map((x) => (x.id === editExpense.id ? { ...x, concept, amount, category: editForm.category } : x))
        );
        setEditExpense(null);
        showToast('Gasto actualizado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase
        .from('expenses')
        .update({ concept, amount, category: editForm.category })
        .eq('id', editExpense.id);
      if (error) throw error;
      setExpenses((list) =>
        list.map((x) => (x.id === editExpense.id ? { ...x, concept, amount, category: editForm.category } : x))
      );
      setEditExpense(null);
      showToast('Gasto actualizado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  // ---------- ELIMINAR GASTO ----------
  const deleteExpense = async (e) => {
    if (busy) return;
    const ok = confirm(
      `¿Eliminar el gasto "${e.concept}" de ${money(e.amount)} (${catInfo(e.category).label})?`
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: eliminación local =====
        enqueueOp({ type: 'expense_delete', payload: { expenseId: e.id } });
        setExpenses((list) => list.filter((x) => x.id !== e.id));
        showToast('Gasto eliminado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from('expenses').delete().eq('id', e.id);
      if (error) throw error;
      setExpenses((list) => list.filter((x) => x.id !== e.id));
      showToast('Gasto eliminado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary';

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab('gastos')}
          className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold border transition-colors ${
            tab === 'gastos' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
          }`}
        >
          Gastos
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold border transition-colors ${
            tab === 'stats' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
          }`}
        >
          Estadísticas
        </button>
      </div>

      {/* GASTOS */}
      {tab === 'gastos' && (
        <div className="space-y-2.5">
          <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-2.5">
            <b className="text-[14px] text-on-surface">Agregar gasto</b>
            <form className="space-y-2" onSubmit={saveExpense}>
              <input
                required
                value={form.concept}
                onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
                className={inputCls}
                placeholder="Concepto (bolsas, renta…)"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className={inputCls}
                  placeholder="Monto C$"
                />
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inputCls}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60"
              >
                {busy ? 'Guardando…' : 'Registrar gasto'}
              </button>
            </form>
          </div>

          <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
            {expenses.length === 0 && (
              <p className="py-5 text-center text-[13px] text-on-surface-variant">Sin gastos todavía.</p>
            )}
            {expenses.map((e) => {
              const info = catInfo(e.category);
              return (
                <div key={e.id} className="flex items-center gap-2 py-2.5 border-b border-surface-container last:border-0">
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13.5px] font-semibold text-on-surface truncate">{e.concept}</b>
                    <span className="block text-[11.5px] text-on-surface-variant">
                      {info.emoji} {info.label} · {new Date(e.created_at).toLocaleDateString('es-NI')}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-on-surface">−{money(e.amount)}</span>
                  <button
                    onClick={() => openEditExpense(e)}
                    disabled={busy}
                    title={`Editar ${e.concept}`}
                    aria-label={`Editar ${e.concept}`}
                    className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteExpense(e)}
                    disabled={busy}
                    title={`Eliminar ${e.concept}`}
                    aria-label={`Eliminar ${e.concept}`}
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
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div className="space-y-2.5">
          <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[10px] p-2.5 text-[12.5px] text-primary-deep flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
            </svg>
            Calculado automáticamente con tus ventas (Live, Vender y mostrador)
          </div>

          {productos.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
              <p className="text-[13px] text-on-surface-variant">
                Aún no hay ventas con productos. Los apartados del Live aparecen aquí solos.
              </p>
            </div>
          )}

          {productos.length > 0 && (
            <>
              {/* Buscador de productos */}
              <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M20 20l-4-4" />
                </svg>
                <input
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="Buscar producto en las listas…"
                  className="flex-1 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant bg-transparent"
                  type="search"
                />
                {prodSearch && (
                  <span className="text-[10.5px] font-semibold text-on-surface-variant whitespace-nowrap">
                    {filterList(productos).length} de {productos.length}
                  </span>
                )}
              </div>

              {/* Contenedor con scroll: la página no crece al infinito */}
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto scroll-box pr-0.5 -mr-1.5 pl-0.5">
                {top.length > 0 && filterList(top).length > 0 && (
                  <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-2.5">
                    <b className="text-[14px] text-on-surface">Más vendidos · invierte en esto</b>
                    {filterList(top).map((p, i) => (
                      <div key={p.name} className="bg-surface-container-low border border-outline rounded-[10px] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-on-surface truncate">
                            {i + 1}. {p.name}
                          </span>
                          <span className="bg-primary text-on-primary text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap">
                            {p.count} vendidos
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (p.count / maxCount) * 100)}%` }} />
                          </div>
                          <span className="text-[11.5px] text-on-surface-variant">{money(p.ingreso)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {bottom.length > 0 && filterList(bottom).length > 0 && (
                  <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-1.5">
                    <b className="text-[14px] text-on-surface">Menos vendidos · remata o no recompres</b>
                    <p className="text-[11.5px] text-on-surface-variant -mt-1">
                      Incluye productos sin ventas. Con 0 ventas el stock no se mueve.
                    </p>
                    {filterList(bottom).map((p) => (
                      <div key={p.name} className="bg-surface-container-low border border-outline rounded-[10px] p-2.5 flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-on-surface truncate">
                          {p.name}
                          {p.count === 0 && (
                            <span className="ml-1.5 inline-block bg-inverse-surface text-inverse-on-surface text-[9.5px] font-bold px-1.5 py-[1px] rounded-md align-middle">
                              sin ventas
                            </span>
                          )}
                        </span>
                        <span className="bg-primary-fixed text-primary-deep text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap">
                          {p.count} vendidos
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {filterList(top).length === 0 && filterList(bottom).length === 0 && (
                  <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
                    <p className="text-[13px] text-on-surface-variant">Ningún producto coincide con «{prodSearch}».</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal editar gasto */}
      {editExpense && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setEditExpense(null)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="text-[16px] text-on-surface">Editar gasto</b>
              <button onClick={() => setEditExpense(null)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <form className="space-y-2.5" onSubmit={saveEditExpense}>
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Concepto</label>
                <input
                  required
                  value={editForm.concept}
                  onChange={(e) => setEditForm((f) => ({ ...f, concept: e.target.value }))}
                  className={inputCls}
                  placeholder="Concepto (bolsas, renta…)"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface mb-1">Monto (C$)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface mb-1">Categoría</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className={inputCls}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditExpense(null)} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
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
