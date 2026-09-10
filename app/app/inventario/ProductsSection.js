'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const inputCls =
  'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary';

export default function ProductsSection({ initialProducts, lots }) {
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', lot_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProduct = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      const price = parseFloat(form.price);
      if (!form.name.trim() || !price || price <= 0) throw new Error('Completa nombre y precio');
      const count = products.length + 1;
      const { data, error: err } = await supabase
        .from('products')
        .insert({
          code: 'P-' + String(count).padStart(3, '0'),
          name: form.name.trim(),
          sale_price: price,
          lot_id: form.lot_id || null,
          store_id: ctx.storeId,
        })
        .select('id, code, name, sale_price, sold_count, lot_id, is_active')
        .single();
      if (err) {
        // Si el código chocó con uno existente (producto eliminado antes), reintentar con sufijo
        if (String(err.message || '').includes('duplicate key')) {
          const { data: retry, error: err2 } = await supabase
            .from('products')
            .insert({
              code: 'P-' + Date.now().toString().slice(-6),
              name: form.name.trim(),
              sale_price: price,
              lot_id: form.lot_id || null,
              store_id: ctx.storeId,
            })
            .select('id, code, name, sale_price, sold_count, lot_id, is_active')
            .single();
          if (err2) throw err2;
          setProducts((list) => [retry, ...list]);
        } else {
          throw err;
        }
      } else {
        setProducts((list) => [data, ...list]);
      }
      setForm({ name: '', price: '', lot_id: '' });
      setOpen(false);
      showToast('Producto agregado. Ya visible en Vender.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async (p) => {
    if (!confirm(`¿Eliminar "${p.name}" del inventario?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      setProducts((list) => list.filter((x) => x.id !== p.id));
      showToast('Producto eliminado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
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
        Los que agregues aquí aparecen en el apartado Vender.
      </p>

      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl bg-inverse-surface text-inverse-on-surface text-[13.5px] font-semibold flex items-center justify-center gap-2 active:opacity-85 transition-opacity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 3v18M3 12h18" />
        </svg>
        Agregar producto
      </button>

      {products.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Sin productos aún.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
              <div className="flex-1 min-w-0">
                <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                  <span className="inline-block bg-primary-fixed text-primary text-[10px] font-bold px-1.5 py-[2px] rounded-md mr-1.5 align-middle">
                    {p.code}
                  </span>
                  {p.name}
                </b>
                <span className="block text-[11.5px] text-on-surface-variant">{p.sold_count} vendidos</span>
              </div>
              <span className="text-[14px] font-bold text-primary">{money(p.sale_price)}</span>
              <button
                onClick={() => deleteProduct(p)}
                className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity"
                title="Eliminar"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="text-[16px] text-on-surface">Nuevo producto</b>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <form className="space-y-2.5" onSubmit={saveProduct}>
              <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Nombre del producto *" />
              <input required type="number" min="1" value={form.price} onChange={set('price')} className={inputCls} placeholder="Precio de venta C$ *" />
              <select value={form.lot_id} onChange={set('lot_id')} className={inputCls}>
                <option value="">Sin lote</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
              {error && <p className="text-[12px] text-error font-semibold">{error}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                {busy ? 'Guardando…' : 'Guardar producto'}
              </button>
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
