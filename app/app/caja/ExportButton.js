'use client';

import { useState } from 'react';
import { buildReportWorkbook, workbookToBlob } from '@/lib/excel-report';

export default function ExportButton({ sales, expenses, storeName = 'Mi Prenda' }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const exportReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const contado = sales.filter((s) => s.payment_method !== 'fiado').reduce((a, s) => a + Number(s.total), 0);
      const fiado = sales.filter((s) => s.payment_method === 'fiado').reduce((a, s) => a + Number(s.total), 0);
      const gastos = expenses.reduce((a, e) => a + Number(e.amount), 0);

      const wb = await buildReportWorkbook({
        storeName,
        fechaCorte: new Date().toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' }),
        contado,
        fiado,
        gastos,
        cajaNeta: contado - gastos,
        sales,
        expenses,
      });
      const blob = await workbookToBlob(wb);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-miprenda-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Reporte Excel descargado');
    } catch (err) {
      showToast('Error al exportar: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`bg-primary rounded-[14px] px-3.5 py-3 text-on-primary flex items-center gap-2.5 cursor-pointer active:bg-primary-deep transition-colors ${busy ? 'opacity-70' : ''}`}
        onClick={busy ? undefined : exportReport}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 10h16M10 10v10" />
        </svg>
        <div className="flex-1">
          <b className="text-[13.5px]">
            Exportar reporte <span className="bg-white/20 text-[10px] font-bold px-1.5 py-[1px] rounded-md ml-1">.XLSX</span>
          </b>
          <small className="block text-[11px] opacity-85">{busy ? 'Generando Excel…' : 'Resumen, ventas y gastos del negocio'}</small>
        </div>
        <span className="text-[16px]">›</span>
      </div>

      {toast && (
        <div className="fixed top-20 inset-x-4 z-[60] flex justify-center pointer-events-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]">
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
