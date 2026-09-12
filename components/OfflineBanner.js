'use client';

import { useEffect, useState, useCallback } from 'react';
import { getQueueCount, subscribeQueue } from '@/lib/offline-queue';
import { syncNow, setSyncObserver } from '@/lib/offline-sync';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState(null); // 'syncing' | 'done' | 'stuck'

  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    setPending(getQueueCount());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeQueue(refresh);
    setSyncObserver((state) => {
      setSyncState(state);
      if (state === 'done') {
        setTimeout(() => setSyncState(null), 3000);
      }
    });
    const onOnline = () => {
      setOnline(true);
      syncNow('online-banner');
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  // Nada que mostrar: hay internet y no hay pendientes
  if (online && pending === 0 && !syncState) return null;

  let msg = '';
  let cls = '';
  if (!online) {
    msg = pending > 0 ? `Sin internet · ${pending} ${pending === 1 ? 'cambio guardado' : 'cambios guardados'} en este celular` : 'Sin internet · los cambios se guardarán en este celular';
    cls = 'bg-inverse-surface text-inverse-on-surface';
  } else if (syncState === 'syncing') {
    msg = 'Sincronizando cambios…';
    cls = 'bg-primary-fixed text-primary-deep';
  } else if (syncState === 'stuck') {
    msg = 'Un cambio no se pudo sincronizar · se reintentará';
    cls = 'bg-error-container text-on-error-container';
  } else if (pending > 0) {
    msg = `${pending} ${pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} de sincronizar`;
    cls = 'bg-primary-fixed text-primary-deep';
  } else if (syncState === 'done') {
    msg = 'Cambios sincronizados';
    cls = 'bg-primary text-on-primary';
  }

  return (
    <div className={`fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:left-6 z-40 flex justify-center pointer-events-none`}>
      <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-[12px] font-semibold ${cls}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {!online ? (
            <>
              <path d="M2 2l20 20" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0" />
              <path d="M5 12.5a10 10 0 0 1 3-2" />
              <path d="M12 20h.01" />
            </>
          ) : syncState === 'syncing' ? (
            <path d="M21 12a9 9 0 1 1-6.2-8.55" />
          ) : (
            <path d="M4 12l5 5L20 7" />
          )}
        </svg>
        <span>{msg}</span>
      </div>
    </div>
  );
}
