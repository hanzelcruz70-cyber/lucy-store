'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';

export default function NuevoProductoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', pieces: '', cost: '', price: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pieces = parseInt(form.pieces) || 0;
  const cost = parseFloat(form.cost) || 0;
  const price = parseFloat(form.price) || 0;
  const unit = pieces > 0 && cost > 0 ? (cost / pieces).toFixed(2) : '0.00';
  const profit = price > 0 && pieces > 0 && cost > 0 ? (price - cost / pieces).toFixed(0) : null;

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      if (!form.name.trim() || pieces <= 0 || price <= 0) {
        throw new Error('Completa nombre, cantidad y precio de venta');
      }

      // 1) Lote interno (controla las piezas y el costo; la dueña solo ve "el producto")
      const { count: lotCount } = await supabase.from('lots').select('id', { count: 'exact', head: true });
      const { data: lot, error: errLot } = await supabase
        .from('lots')
        .insert({
          code: 'Paca #' + ((lotCount || 0) + 1),
          name: form.name.trim(),
          pieces_total: pieces,
          pieces_left: pieces,
          total_cost: cost,
          avg_sale_price: price,
          store_id: ctx.storeId,
          user_id: ctx.userId,
        })
        .select('id')
        .single();
      if (errLot) throw errLot;

      // 2) Producto vinculado (sale directo en Vender con su stock)
      const { count: prodCount } = await supabase.from('products').select('id', { count: 'exact', head: true });
      const { error: errProd } = await supabase.from('products').insert({
        code: 'P-' + String((prodCount || 0) + 1).padStart(3, '0'),
        name: form.name.trim(),
        sale_price: price,
        lot_id: lot.id,
        store_id: ctx.storeId,
      });
      if (errProd) {
        // rollback del lote si el producto falla
        await supabase.from('lots').delete().eq('id', lot.id);
        throw errProd;
      }

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
    <div className="px-3.5 py-3.5">
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-4 space-y-3 max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 12h18" />
            </svg>
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-on-surface">Ingresar producto</h1>
            <p className="text-[12px] text-on-surface-variant">Sale directo a Vender con su stock</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-2.5">
          <div>
            <label className="block text-[12px] font-semibold text-on-surface mb-1">Nombre del producto</label>
            <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Ej. Blusa rosa" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[12px] font-semibold text-on-surface mb-1">Cantidad de prendas</label>
              <input required type="number" min="1" value={form.pieces} onChange={set('pieces')} className={inputCls} placeholder="100" inputMode="numeric" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-on-surface mb-1">Costo total (C$)</label>
              <input type="number" min="0" value={form.cost} onChange={set('cost')} className={inputCls} placeholder="6000" inputMode="decimal" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-on-surface mb-1">Precio de venta por prenda (C$)</label>
            <input required type="number" min="1" value={form.price} onChange={set('price')} className={inputCls} placeholder="150" inputMode="decimal" />
          </div>

          <div className="bg-surface-container-low rounded-[10px] px-3.5 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-on-surface-variant block">Costo por pieza:</span>
              <span className="text-[20px] font-bold text-primary leading-tight">C${unit} c/u</span>
            </div>
            {profit !== null && Number(profit) >= 0 && (
              <div className="text-right">
                <span className="text-[11px] text-on-surface-variant block">Ganancias por pieza:</span>
                <span className="text-[16px] font-bold text-primary leading-tight">+C${profit}</span>
              </div>
            )}
          </div>

          {error && <p className="text-[12px] text-error font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 bg-primary text-on-primary text-[14px] font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zM8 12.5l2.5 2.5L16 9" />
            </svg>
            <span>{busy ? 'Guardando...' : 'Dar entrada a un producto'}</span>
          </button>
          <a href="/app/inventario" prefetch className="w-full py-2.5 bg-surface-container-low border border-outline text-on-surface rounded-xl text-[13px] font-semibold text-center block">
            Cancelar
          </a>
        </form>
      </div>
    </div>
  );
}
