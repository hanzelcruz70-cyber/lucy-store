'use client';

import { useEffect, useState } from 'react';
import { appAlert } from '@/components/ConfirmDialog';

export default function PwaRegister() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Solo mostrar el botón en pantallas táctiles pequeñas (celulares), no en escritorio
    const mobile = window.matchMedia('(pointer: coarse) and (max-width: 767px)').matches;
    setIsMobile(mobile);
    if (!mobile) return;
    // iOS: standalone en la barra de medios = ya instalada
    const iOSInstalled = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (iOSInstalled) {
      setInstalled(true);
      return;
    }
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
      // iOS (y Android sin beforeinstallprompt): instrucciones manuales
      await appAlert(
        'Para instalar la app:\n\nEn Android: menú del navegador > "Agregar a pantalla de inicio" o "Instalar app".\n\nEn iPhone: botón Compartir (cuadro con flecha) > "Añadir a pantalla de inicio".',
        { title: 'Instalar Mi Prenda', okText: 'Entendido' }
      );
    }
  };

  // En móvil SIEMPRE visible (iOS nunca dispara beforeinstallprompt);
  // en escritorio no se muestra.
  if (!isMobile) return null;

  return (
    <button
      onClick={install}
      className="fixed bottom-20 right-4 z-50 bg-primary text-on-primary rounded-full shadow-lg px-4 py-2.5 flex items-center gap-1.5 font-label-badge text-label-badge active:scale-95 transition-transform"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
      </svg>
      Instalar App
    </button>
  );
}
