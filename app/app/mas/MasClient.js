'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

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

export default function MasClient({ expenses: initialExpenses, sales }) {
  const [tab, setTab] = useState('gastos');
  const [expenses, setExpenses] = useState(initialExpenses);
  const [form, setForm] = useState({ concept: '', amount: '', category: 'operativo' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

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
      setForm({ concept: '', amount: '', category: 'operativo' });
      showToast('Gasto registrado');
    } catch (err) {
      showToast(err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    try {
      const today = new Date().toLocaleDateString('es-NI');
      const contado = sales.filter((s) => s.payment_method !== 'fiado').reduce((a, s) => a + Number(s.total), 0);
      const fiado = sales.filter((s) => s.payment_method === 'fiado').reduce((a, s) => a + Number(s.total), 0);
      const gastos = expenses.reduce((a, e) => a + Number(e.amount), 0);

      const rows = [
        ['REPORTE DE VENTAS - ' + today],
        [],
        ['RESUMEN'],
        ['Ventas al contado', contado],
        ['Ventas fiado', fiado],
        ['Gastos', gastos],
        ['Caja neta', contado - gastos],
        [],
        ['VENTAS'],
        ['Fecha', 'Cliente', 'Canal', 'Método', 'Productos', 'Total'],
        ...sales.map((s) => [
          new Date(s.created_at).toLocaleString('es-NI'),
          s.client_name || 'Mostrador',
          s.channel,
          s.payment_method,
          s.notes || s.items_count,
          Number(s.total),
        ]),
        [],
        ['GASTOS'],
        ['Fecha', 'Concepto', 'Categoría', 'Monto'],
        ...expenses.map((e) => [
          new Date(e.created_at).toLocaleString('es-NI'),
          e.concept,
          e.category,
          Number(e.amount),
        ]),
      ];

      let csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      csv = '\uFEFF' + csv;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-pacapos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Reporte descargado');
    } catch (err) {
      showToast('Error al exportar: ' + err.message, false);
    }
  };

  const productos = extraerProductos(sales);
  const top = productos.filter((p) => p.count > 0).slice(0, 8);
  const bottom = productos.slice(-8).reverse();
  const maxCount = productos.length > 0 ? productos[0].count : 1;

  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary';

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Header con export (cinta rosa) */}
      <div className="bg-primary rounded-[14px] px-3.5 py-3 text-on-primary flex items-center gap-2.5 cursor-pointer active:bg-primary-deep transition-colors" onClick={exportExcel}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 10h16M10 10v10" />
        </svg>
        <div className="flex-1">
          <b className="text-[13.5px]">
            Exportar reporte <span className="bg-white/20 text-[10px] font-bold px-1.5 py-[1px] rounded-md ml-1">.XLSX</span>
          </b>
          <small className="block text-[11px] opacity-85">Resumen, ventas y gastos del negocio</small>
        </div>
        <span className="text-[16px]">›</span>
      </div>

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
                  <option value="operativo">Operativo</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="renta">Renta</option>
                  <option value="otro">Otro</option>
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
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-surface-container last:border-0">
                <div className="min-w-0">
                  <b className="block text-[13.5px] font-semibold text-on-surface truncate">{e.concept}</b>
                  <span className="block text-[11.5px] text-on-surface-variant capitalize">
                    {e.category} · {new Date(e.created_at).toLocaleDateString('es-NI')}
                  </span>
                </div>
                <span className="text-[14px] font-bold text-on-surface">−{money(e.amount)}</span>
              </div>
            ))}
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

          {top.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-2.5">
              <b className="text-[14px] text-on-surface">Más vendidos · invierte en esto</b>
              {top.map((p, i) => (
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

          {bottom.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-1.5">
              <b className="text-[14px] text-on-surface">Menos vendidos · remata o no recompres</b>
              {bottom.map((p) => (
                <div key={p.name} className="bg-surface-container-low border border-outline rounded-[10px] p-2.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-on-surface truncate">{p.name}</span>
                  <span className="bg-primary-fixed text-primary-deep text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap">
                    {p.count} vendidos
                  </span>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
}
