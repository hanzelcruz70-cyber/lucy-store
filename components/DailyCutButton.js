'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

export default function DailyCutButton({ collected, credit, expenses, cutDone }) {
  const [done, setDone] = useState(cutDone);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const doCut = async () => {
    if (done || busy) return;
    const ok = confirm(
      `¿Cerrar el turno de hoy?\n\nCobrado: ${money(collected)}\nFiado: ${money(credit)}\nGastos: ${money(expenses)}\n\nEl corte queda guardado en el historial.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      const { error } = await supabase.from('cash_cuts').insert({
        sales_total: Number(collected) + Number(credit),
        collected_total: Number(collected),
        credit_total: Number(credit),
        expenses_total: Number(expenses),
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (error) throw error;
      setDone(true);
      showToast('Corte de caja guardado en el historial');
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={doCut}
        disabled={done || busy}
        className={`flex-1 h-12 rounded-xl px-space-md flex items-center justify-center gap-space-xs font-headline-sm text-body-md transition-colors ${
          done
            ? 'bg-secondary/20 text-secondary cursor-default'
            : 'bg-surface-container-high text-on-surface active:bg-surface-container-highest'
        }`}
        id="btnDailyCut"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={done ? '' : 'text-primary'}>
          {done
            ? <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zM8 12.5l2.5 2.5L16 9" />
            : <path d="M7 3h10a1 1 0 0 1 1 1v3H6V4a1 1 0 0 1 1-1zM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM10 11h4" />}
        </svg>
        <span>{done ? 'Corte ya realizado hoy' : busy ? 'Guardando...' : 'Realizar Corte Diario'}</span>
      </button>

      {toast && (
        <div className="fixed top-20 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 font-body-sm text-body-sm font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 14l5 5L21 6M8 14l5 5" />
            </svg>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}
