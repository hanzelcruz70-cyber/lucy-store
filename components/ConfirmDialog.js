'use client';

import { useEffect, useState, useId } from 'react';

/* ============================================================
 * Mi Prenda · ConfirmDialog global
 * Reemplaza window.confirm(): en Android/PWA el diálogo nativo
 * bloquea el hilo JS y congela el scroll de la app; con este
 * modal la app nunca se bloquea y el aviso se ve estilo Mi Prenda.
 *
 * Uso:  const ok = await appConfirm('¿Eliminar cliente?');
 * ============================================================ */

let pushDialog = null; // registro del provider montado

export function appConfirm(message, { title = 'Confirmar', confirmText = 'Aceptar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (!pushDialog) {
      // Provider aún no montado (primer render): confirm nativo como fallback
      resolve(window.confirm(message));
      return;
    }
    pushDialog({ message, title, confirmText, cancelText, danger, resolve });
  });
}

/* Aviso informativo (reemplaza window.alert) con un solo botón. */
export function appAlert(message, { title = 'Atención', okText = 'Entendido' } = {}) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !pushDialog) {
      window.alert(message);
      resolve(true);
      return;
    }
    pushDialog({ message, title, confirmText: okText, cancelText: null, danger: false, resolve });
  });
}

export default function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const titleId = useId();

  useEffect(() => {
    pushDialog = (d) => setDialog(d);
    return () => {
      pushDialog = null;
    };
  }, []);

  const close = (result) => {
    setDialog(null);
    if (dialog && dialog.resolve) dialog.resolve(result);
  };

  return (
    <>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[90] bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center"
          onClick={() => close(false)}
        >
          <div
            className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dialog.danger ? '#C2185B' : '#D6337F'} strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M12 8v5" />
                <path d="M12 16.5h.01" />
                <path d="M10.3 3.8L1.8 18.4a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <b id={titleId} className="block text-[15px] text-on-surface">{dialog.title}</b>
                <p className="text-[12.5px] text-on-surface-variant mt-1 leading-relaxed whitespace-pre-line">{dialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => close(true)}
                className={`flex-1 py-3 rounded-xl text-[13.5px] font-semibold active:opacity-80 transition-opacity ${
                  dialog.danger ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
                }`}
              >
                {dialog.confirmText}
              </button>
              {dialog.cancelText && (
                <button
                  onClick={() => close(false)}
                  className="flex-1 py-3 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13.5px] font-semibold active:opacity-80 transition-opacity"
                >
                  {dialog.cancelText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
