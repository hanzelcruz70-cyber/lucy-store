'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { sanitizeNumber } from '@/lib/validation';

/* Caja inicial del día: con cuánto dinero se abre el turno.
 * Una fila por tienda/día (upsert). Se suma al esperado del arqueo. */
export default function CajaInicial({ initial = 0, editable = true }) {
  const [value, setValue] = useState(initial > 0 ? String(initial) : '');
  const [saved, setSaved] = useState(initial > 0 ? Number(initial) : 0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const save = async () => {
    if (busy) return;
    const monto = sanitizeNumber(value, { min: 0 });
    if (monto === null) {
      showToast('Escribe un monto válido', false);
      return;
    }
    setBusy(true);
    try {
      // Día de negocio en Nicaragua (UTC-6): YYYY-MM-DD local
      const hoy = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const supabase = createClient();
      const ctx = await getMyContext();
      const { error } = await supabase
        .from('cash_openings')
        .upsert(
          { store_id: ctx.storeId, user_id: ctx.userId, day: hoy, amount: monto },
          { onConflict: 'store_id,day' }
        );
      if (error) throw error;
      setSaved(monto);
      showToast(monto > 0 ? `Caja inicial: ${money(monto)}` : 'Caja inicial en C$0');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline rounded-[14px] p-3.5">
      <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">
        Caja inicial de hoy
      </div>
      <p className="text-[11.5px] text-on-surface-variant mt-0.5 mb-2">
        ¿Con cuánto abriste el día? Se suma al efectivo esperado del cierre.
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="C$ 0"
          inputMode="decimal"
          disabled={!editable || busy}
          className="flex-1 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-on-surface outline-none focus:border-primary disabled:opacity-60"
        />
        <button
          onClick={save}
          disabled={!editable || busy}
          className="bg-primary text-on-primary text-[12.5px] font-semibold px-5 rounded-[10px] active:bg-primary-deep transition-colors disabled:opacity-40"
        >
          {busy ? '…' : saved > 0 && value === String(saved) ? 'Guardado' : 'Guardar'}
        </button>
      </div>
      {toast && (
        <p className={`text-[11.5px] font-semibold mt-1.5 ${toast.ok ? 'text-primary' : 'text-error'}`}>{toast.m}</p>
      )}
    </div>
  );
}
