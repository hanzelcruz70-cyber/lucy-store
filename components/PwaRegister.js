'use client';

import { useEffect, useState } from 'react';

export default function PwaRegister() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Solo mostrar el botón en pantallas táctiles pequeñas (celulares), no en escritorio
    const isMobile = window.matchMedia('(pointer: coarse) and (max-width: 767px)').matches;
    if (!isMobile) return;
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else {
      alert(
        'Para instalar: en Android usa "Agregar a pantalla de inicio". En iPhone: Compartir > "Añadir a inicio".'
      );
    }
  };

  if (!deferred) return null;

  return (
    <button
      onClick={install}
      className="fixed bottom-20 right-4 z-50 bg-primary text-on-primary rounded-full shadow-lg px-4 py-2.5 flex items-center gap-1.5 font-label-badge text-label-badge active:scale-95 transition-transform"
    >
      <span className="material-symbols-outlined text-[18px]">download</span>
      Instalar App
    </button>
  );
}
