'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';

export default function NuevoLotePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', pieces: '', cost: '', avgPrice: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pieces = parseFloat(form.pieces) || 0;
  const cost = parseFloat(form.cost) || 0;
  const unit = pieces > 0 && cost > 0 ? (cost / pieces).toFixed(2) : '0.00';

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      // Código de paca: contar existentes en UNA consulta head (rápida)
      const { count } = await supabase.from('lots').select('id', { count: 'exact', head: true });
      const { error } = await supabase.from('lots').insert({
        code: 'Paca #' + ((count || 0) + 1),
        name: form.name.trim(),
        pieces_total: pieces,
        pieces_left: pieces,
        total_cost: cost,
        avg_sale_price: parseFloat(form.avgPrice) || 0,
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (error) throw error;
      router.push('/app/inventario');
      router.refresh();
    } catch (err) {
      setError('No se pudo guardar: ' + err.message);
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary';

  return (
    <div className="px-gutter-mobile py-space-md">
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg space-y-space-md max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[28px]">add_shopping_cart</span>
          <div>
            <h1 className="text-[16px] font-bold text-on-surface">Nueva Paca / Lote</h1>
            <p className="text-[12px] text-on-surface-variant">Ropa americana sin desglose de tallas</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-space-sm">
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Nombre o Categoría del Lote
            </label>
            <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Ej. Paca Blusas Casuales Mixtas" />
          </div>
          <div className="grid grid-cols-2 gap-space-sm">
            <div>
              <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
                Total Prendas (Pzas)
              </label>
              <input required type="number" min="1" value={form.pieces} onChange={set('pieces')} className={inputCls} placeholder="100" />
            </div>
            <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Costo Total Paca (C$)
            </label>
              <input required type="number" min="1" value={form.cost} onChange={set('cost')} className={inputCls} placeholder="6000" />
            </div>
          </div>
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Precio promedio de venta por pieza (C$)
            </label>
            <input type="number" min="0" value={form.avgPrice} onChange={set('avgPrice')} className={inputCls} placeholder="150" />
          </div>

          <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between">
            <div>
              <span className="text-body-sm font-body-sm text-on-surface-variant block">Costo calculado por pieza:</span>
              <span className="font-display-pos-mobile text-[24px] font-bold text-secondary">C${unit} c/u</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-[32px]">calculate</span>
          </div>

          {error && <p className="font-body-sm text-body-sm text-error font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined">check_circle</span>
            <span>{busy ? 'Guardando...' : 'Dar Entrada al Lote'}</span>
          </button>
          <a href="/app/inventario" className="w-full py-2.5 bg-surface-container-low border border-outline text-on-surface rounded-xl text-[13px] font-semibold py-2.5 text-center block">
            Cancelar
          </a>
        </form>
      </div>
    </div>
  );
}
