'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

export default function ProductsSection({ initialProducts, lots }) {
  const [products, setProducts] = useState(initialProducts);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const lotById = {};
  (lots || []).forEach((l) => (lotById[l.id] = l));
  const stockOf = (p) => (p.lot_id && lotById[p.lot_id] ? lotById[p.lot_id].pieces_left : null);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
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

      {products.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Sin productos aún. Ingresa el primero con el botón rosa de arriba.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
          {products.map((p) => {
            const stock = stockOf(p);
            return (
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
