'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

export default function CierreCaja({ contadoEfectivo, contadoTransferencia, gastos, abonosEfectivo = 0, fondoInicial = 0, cutDone }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(cutDone);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const contadoTotal = Number(contadoEfectivo) + Number(contadoTransferencia);
  // El efectivo esperado incluye los abonos de deudas recibidos en efectivo
  const esperadoEnCaja = Number(contadoEfectivo) + Number(abonosEfectivo) - Number(gastos) + Number(fondoInicial);
  const contadoFisico = DENOMS.reduce((a, d) => a + d * (parseInt(counts[d]) || 0), 0);
  const diferencia = contadoFisico - esperadoEnCaja;

  const setCount = (d) => (e) => {
    const v = e.target.value.replace(/[^0-9]/g, '');
    setCounts((c) => ({ ...c, [d]: v }));
  };

  const bumpCount = (d, delta) => {
    setCounts((c) => {
      const cur = parseInt(c[d]) || 0;
      const next = Math.max(0, Math.min(999, cur + delta));
      return { ...c, [d]: next === 0 ? '' : String(next) };
    });
  };

  const doCierre = async () => {
    if (done || busy) return;
    setBusy(true);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: corte local (se sube al volver la conexión) =====
        enqueueOp({
          type: 'cash_cut',
          payload: {
            localId: uuid(),
            salesTotal: contadoTotal,
            collectedTotal: Number(contadoEfectivo),
            expensesTotal: Number(gastos),
            notes: `Contado físico: ${money(contadoFisico)}. Diferencia: ${money(diferencia)}. Transferencias: ${money(contadoTransferencia)}. Abonos en efectivo: ${money(abonosEfectivo)}`,
          },
        });
        setDone(true);
        setOpen(false);
        showToast('Corte guardado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const ctx = await getMyContext();
      const { error } = await supabase.from('cash_cuts').insert({
        sales_total: contadoTotal,
        collected_total: contadoEfectivo,
        credit_total: 0,
        expenses_total: gastos,
        notes: `Contado físico: ${money(contadoFisico)}. Diferencia: ${money(diferencia)}. Transferencias: ${money(contadoTransferencia)}. Abonos en efectivo: ${money(abonosEfectivo)}`,
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (error) throw error;
      setDone(true);
      setOpen(false);
      showToast('Cierre de caja guardado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Statusbar estilo v2 */}
      <div
        className={`flex items-center justify-center gap-1.5 rounded-[10px] py-2 text-[12.5px] font-semibold ${
          done ? 'bg-surface-variant text-on-surface' : 'bg-primary text-on-primary cursor-pointer active:bg-primary-deep transition-colors'
        }`}
        onClick={() => (done ? null : setOpen(true))}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
        </svg>
        {done ? 'Corte ya realizado hoy' : 'Realizar cierre de caja'}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <b className="text-[16px] text-on-surface">Cierre de caja</b>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-[0.06em]">Arqueo con conteo de billetes</span>

            {/* Resumen esperado */}
            <div className="bg-surface-container-low border border-outline rounded-[14px] p-3.5 mt-3 space-y-1">
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">Ventas al contado hoy</span>
                <b className="text-on-surface">{money(contadoTotal)}</b>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">De esas, por transferencia</span>
                <b className="text-on-surface-variant">{money(contadoTransferencia)}</b>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">Gastos del día</span>
                <b className="text-on-surface">−{money(gastos)}</b>
              </div>
              {Number(abonosEfectivo) > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-on-surface-variant">Abonos en efectivo recibidos</span>
                  <b className="text-primary">+{money(abonosEfectivo)}</b>
                </div>
              )}
              <hr className="divider-d" />
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold">Efectivo esperado en cajón</span>
                <b className="text-primary">{money(esperadoEnCaja)}</b>
              </div>
            </div>

            {/* Conteo */}
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-[0.06em] mt-4 mb-1.5">
              Cuenta tus billetes y monedas
            </p>
            <p className="text-[11px] text-on-surface-variant -mt-1 mb-1.5">
              Toca + para sumar un billete o escríbelo a mano.
            </p>
            <div className="space-y-1">
              {DENOMS.map((d) => {
                const qty = parseInt(counts[d]) || 0;
                return (
                  <div key={d} className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-1.5">
                    <span className="text-[13px] font-bold text-on-surface w-14">{money(d)}</span>
                    <span className="text-on-surface-variant text-[12px]">×</span>
                    <button
                      type="button"
                      onClick={() => bumpCount(d, -1)}
                      disabled={qty <= 0}
                      aria-label={`Quitar un billete de ${money(d)}`}
                      className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center text-[15px] leading-none active:opacity-70 transition-opacity disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      value={counts[d] || ''}
                      onChange={setCount(d)}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Cantidad de billetes de ${money(d)}`}
                      className="w-16 bg-surface border border-outline rounded-lg px-2 py-1 text-[13px] font-semibold text-on-surface text-center outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => bumpCount(d, 1)}
                      aria-label={`Agregar un billete de ${money(d)}`}
                      className="w-7 h-7 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-[15px] font-bold leading-none active:opacity-70 transition-opacity"
                    >
                      +
                    </button>
                    <span className="text-on-surface-variant text-[12px]">=</span>
                    <span className="text-[13px] font-bold text-primary ml-auto">
                      {money(d * qty)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Verificación */}
            <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[14px] p-3.5 mt-3 space-y-1">
              <div className="flex justify-between text-[13px]">
                <span className="text-on-surface-variant">Contado físicamente</span>
                <b className="text-on-surface">{money(contadoFisico)}</b>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-semibold">
                  {diferencia === 0 ? '¡Cuadra perfecto!' : diferencia > 0 ? 'Sobra' : 'Falta'}
                </span>
                <b className={`text-[18px] font-bold ${diferencia === 0 ? 'text-primary' : diferencia > 0 ? 'text-on-surface' : 'text-error'}`}>
                  {diferencia === 0 ? '✓' : (diferencia > 0 ? '+' : '') + money(diferencia)}
                </b>
              </div>
            </div>

            <button
              onClick={doCierre}
              disabled={busy}
              className="w-full py-3 mt-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold flex items-center justify-center gap-2 active:bg-primary-deep transition-colors disabled:opacity-60"
            >
              {busy ? 'Guardando…' : 'Cerrar caja del día'}
            </button>
            {diferencia !== 0 && (
              <p className="text-center text-[11px] text-on-surface-variant mt-1.5">
                Hay diferencia con lo esperado. Puedes cerrar igual y queda anotada.
              </p>
            )}
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
    </>
  );
}
