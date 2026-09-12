'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

/* Acciones para un lote huérfano (sin producto ligado):
   - "Crear producto": genera el producto que le falta al lote
   - "Eliminar": borra el lote (el stock nunca existió o ya se vendió afuera) */
export default function OrphanLotActions({ lot }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askPrice, setAskPrice] = useState(false); // modal de precio
  const [price, setPrice] = useState('');
  const [confirmDel, setConfirmDel] = useState(false); // confirmación inline

  const crearProducto = async (e) => {
    e.preventDefault();
    if (busy) return;
    const precio = parseFloat(price);
    if (!precio || precio <= 0) {
      setError('Escribe un precio válido');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { count: prodCount } = await supabase.from('products').select('id', { count: 'exact', head: true });
      const { error: errProd } = await supabase.from('products').insert({
        code: 'P-' + String((prodCount || 0) + 1).padStart(3, '0'),
        name: lot.name,
        sale_price: precio,
        lot_id: lot.id,
        store_id: lot.store_id,
      });
      if (errProd) throw errProd;
      setAskPrice(false);
      router.refresh();
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const eliminarLote = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('lots').delete().eq('id', lot.id);
      if (error) throw error;
      setConfirmDel(false);
      router.refresh();
    } catch (err) {
      setError('Error: ' + err.message);
      setConfirmDel(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {error && !askPrice && !confirmDel && (
          <span className="text-[10px] text-error font-semibold max-w-[90px] text-right leading-tight">{error}</span>
        )}
        <button
          onClick={() => {
            setPrice('');
            setError('');
            setAskPrice(true);
          }}
          disabled={busy}
          className="text-[11px] font-bold text-on-primary bg-primary px-2.5 py-1.5 rounded-[8px] whitespace-nowrap active:bg-primary-deep disabled:opacity-50 transition-colors"
        >
          Crear producto
        </button>
        <button
          onClick={() => {
            setError('');
            setConfirmDel(true);
          }}
          disabled={busy}
          className="text-[11px] font-bold text-error bg-surface-container-lowest border border-outline px-2.5 py-1.5 rounded-[8px] whitespace-nowrap active:opacity-70 disabled:opacity-50 transition-opacity"
        >
          Eliminar
        </button>
      </div>

      {/* Modal: pedir precio para crear el producto */}
      {askPrice && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setAskPrice(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="text-[16px] text-on-surface">Crear producto</b>
              <button onClick={() => setAskPrice(false)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <p className="text-[12.5px] text-on-surface-variant mb-3">
              ¿A cuánto vendes cada prenda de <b className="text-on-surface">«{lot.name}»</b>?
              Hay {lot.pieces_left} prendas en el lote {lot.code}.
            </p>
            <form className="space-y-2.5" onSubmit={crearProducto}>
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Precio por prenda (C$)</label>
                <input
                  required
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="150"
                  autoFocus
                  className="w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary"
                />
              </div>
              {error && <p className="text-[12px] text-error font-semibold">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                  {busy ? 'Creando…' : 'Crear y vender'}
                </button>
                <button type="button" onClick={() => setAskPrice(false)} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación inline de eliminar */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setConfirmDel(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2.5 mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M12 8v5M12 16.5h.01" />
                <path d="M10.3 3.8L1.8 18.4a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
              </svg>
              <div>
                <b className="block text-[15px] text-on-surface">¿Eliminar {lot.code}?</b>
                <p className="text-[12.5px] text-on-surface-variant mt-1 leading-relaxed">
                  Se quitarán <b className="text-on-surface">{lot.pieces_left} prendas</b> y{' '}
                  <b className="text-on-surface">C${Number(lot.total_cost).toLocaleString('es-NI', { maximumFractionDigits: 0 })}</b> de tu inversión total.
                  Úsalo solo si ese stock ya no existe. No se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={eliminarLote}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-error text-on-error text-[13.5px] font-semibold active:opacity-80 transition-opacity disabled:opacity-60"
              >
                {busy ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13.5px] font-semibold active:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
