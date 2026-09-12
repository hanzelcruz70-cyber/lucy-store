'use client';

import { useState } from 'react';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 15, label: '15 días' },
  { days: 30, label: '30 días' },
];

export default function CutsHistory({ cuts }) {
  const [range, setRange] = useState(30);
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  const filtered = (cuts || []).filter((c) => new Date(c.created_at) >= since);

  return (
    <section className="space-y-2.5">
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Historial de cortes</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">
          {filtered.length}
        </span>
      </div>

      {/* Filtro por rango (máximo 30 días) */}
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`flex-1 py-2 rounded-[10px] text-[12.5px] font-semibold border transition-colors ${
              range === r.days ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Sin cortes en los últimos {range} días.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
          {filtered.map((c) => {
            const fisicoMatch = (c.notes || '').match(/Contado físico: C\$(-?[\d.,]+)/);
            const difMatch = (c.notes || '').match(/Diferencia: C\$(-?[\d.,]+)/);
            const fisico = fisicoMatch ? parseInt(fisicoMatch[1].replace(/[.,]/g, ''), 10) : null;
            const dif = difMatch ? parseInt(difMatch[1].replace(/[.,]/g, ''), 10) : null;
            const fecha = new Date(c.created_at);
            return (
              <div key={c.id} className="py-2.5 border-b border-surface-container last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[13px] font-semibold text-on-surface capitalize">
                    {fecha.toLocaleDateString('es-NI', { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className="text-on-surface-variant font-normal"> · {fecha.toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' })}</span>
                  </b>
                  {dif !== null && (
                    <span
                      className={`text-[10px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap ${
                        dif === 0 ? 'bg-primary-fixed text-primary' : dif > 0 ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'
                      }`}
                    >
                      {dif === 0 ? '✓ Cuadró' : dif > 0 ? `Sobró ${money(dif)}` : `Faltó ${money(Math.abs(dif))}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11.5px] text-on-surface-variant flex-wrap">
                  <span>
                    Contado <b className="text-on-surface">{money(c.sales_total)}</b>
                  </span>
                  <span>
                    Gastos <b className="text-on-surface">{money(c.expenses_total)}</b>
                  </span>
                  {fisico !== null && (
                    <span>
                      Físico <b className="text-primary">{money(fisico)}</b>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
