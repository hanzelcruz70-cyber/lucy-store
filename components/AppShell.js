'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { clearStoreCache } from '@/lib/get-store';
import { clearQueue } from '@/lib/offline-queue';
import PwaRegister from '@/components/PwaRegister';
import OfflineBanner from '@/components/OfflineBanner';

const NAV = [
  { href: '/app/inicio', label: 'Inicio', icon: 'home' },
  { href: '/app/vender', label: 'Vender', icon: 'sell' },
  { href: '/app/live', label: 'Live TikTok', icon: 'videocam', live: true },
  { href: '/app/caja', label: 'Caja', icon: 'point_of_sale' },
  { href: '/app/inventario', label: 'Inventario', icon: 'inventory_2' },
  { href: '/app/clientes', label: 'Clientes', icon: 'groups' },
  { href: '/app/mas', label: 'Más', icon: 'menu' },
];

// Iconos SVG de línea (estilo v2: sin relleno)
const Icon = ({ name, size = 20, sw = 1.8, className = '' }) => {
  const paths = {
    home: <path d="M4 11l8-7 8 7v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20zM9.5 21v-6h5v6" />,
    sell: <path d="M12 2l9 5v10l-9 5-9-5V7zM12 12v9M12 12L3 7M12 12l9-5" />,
    store: (
      <>
        {/* Percha (igual que el ícono/favicon de la app) */}
        <path d="M12 2.5a2 2 0 0 1 1.6 3.2c-.4.5-1 .8-1.6.9L18.5 13c.6.5.2 1.5-.6 1.5H6.1c-.8 0-1.2-1-.6-1.5l6.5-6.4" />
        <path d="M5.4 14.5L3.7 19.4c-.2.7.3 1.6 1.1 1.6h14.4c.8 0 1.3-.9 1.1-1.6l-1.7-4.9" />
      </>
    ),
    videocam: <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3" />,
    point_of_sale: (
      <>
        {/* Caja registradora (solo para la pestaña Caja) */}
        <path d="M4 4h16v4H4zM6 8v3h12V8M5 11h14v9H5zM9 15h6" />
      </>
    ),
    inventory_2: <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5l9 4.5 9-4.5M12 12v9" />,
    groups: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5M16 11a3 3 0 1 0 0-6M17.5 20c-.4-1.6-1-2.9-1.8-3.8M21.5 20c-.3-1.2-.8-2.2-1.4-3" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    logout: <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
};

export default function AppShell({ storeName, userName, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Datos frescos al volver a la app (QA 2026-09-14): la PWA en el celular
  // puede quedar horas en segundo plano mostrando cifras viejas. Al
  // recuperar el foco o la visibilidad se re-consultan los server
  // components de la pantalla actual. Throttle 30s: no martillar la BD
  // con cada alt-tab.
  const lastRefresh = useRef(0);
  useEffect(() => {
    const refreshIfStale = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 30000) return;
      lastRefresh.current = now;
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  const logout = async () => {
    const supabase = createClient();
    clearStoreCache();
    clearQueue();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href) => pathname === href || (pathname.startsWith(href + '/') && href !== '/app');

  const Appbar = ({ onMenu }) => (
    <div className="flex items-center gap-2.5 px-4 py-3.5 bg-surface-container-lowest border-b border-outline">
      <button
        onClick={onMenu}
        className="w-11 h-11 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity"
        aria-label="Abrir menú"
      >
        <Icon name="menu" size={18} />
      </button>
      <div className="flex-1 flex flex-col items-center justify-center gap-0 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-primary flex-none" aria-hidden="true">
            <Icon name="store" size={17} />
          </span>
          <b className="text-[15px] font-bold text-on-surface truncate leading-tight">{storeName}</b>
        </span>
        {userName && (
          <span className="text-[10.5px] text-on-surface-variant truncate leading-tight">{userName}</span>
        )}
      </div>
      <button
        onClick={logout}
        className="w-11 h-11 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity"
        aria-label="Cerrar sesión"
      >
        <Icon name="logout" size={17} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      {/* ============ SIDEBAR ESCRITORIO ============ */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 h-screen sticky top-0 bg-surface-container-lowest border-r border-outline">
        <div className="p-4 flex items-center gap-2.5 border-b border-outline">
          <div className="w-10 h-10 rounded-[10px] bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
            <Icon name="store" size={21} sw={1.8} />
          </div>
          <span className="text-[15px] font-bold text-on-surface truncate leading-tight">{storeName}</span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-primary-fixed text-primary-deep'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon} size={19} />
                <span className="truncate">{item.label}</span>
                {item.live && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-md bg-primary text-on-primary text-[9px] font-bold tracking-wide">
                    LIVE
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-outline">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold text-on-surface-variant hover:bg-surface-container active:bg-surface-container-high transition-colors"
          >
            <Icon name="logout" size={19} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ============ COLUMNA PRINCIPAL ============ */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Appbar móvil (fija, estilo v2) */}
        <header className="md:hidden fixed top-0 inset-x-0 z-40 pt-safe">
          <Appbar onMenu={() => setMenuOpen(true)} />
        </header>

        {/* Drawer lateral móvil */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] bg-surface-container-lowest border-r border-outline flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 flex items-center gap-2.5 border-b border-outline">
                <div className="w-9 h-9 rounded-[10px] bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
                  <Icon name="store" size={19} />
                </div>
                <span className="text-[14px] font-bold text-on-surface truncate leading-tight">{storeName}</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="ml-auto w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13.5px] font-semibold transition-colors ${
                        active
                          ? 'bg-primary-fixed text-primary-deep'
                          : 'text-on-surface-variant active:bg-surface-container'
                      }`}
                    >
                      <Icon name={item.icon} size={20} />
                      <span className="truncate">{item.label}</span>
                      {item.live && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-md bg-primary text-on-primary text-[9px] font-bold">
                          LIVE
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-outline">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13.5px] font-semibold text-on-surface-variant active:bg-surface-container transition-colors"
                >
                  <Icon name="logout" size={20} />
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="flex flex-col relative w-full pt-[70px] md:pt-0 pb-28 md:pb-12 bg-surface min-h-screen max-w-3xl lg:max-w-4xl mx-auto">
          {children}
        </main>

        {/* ============ NAV INFERIOR MÓVIL ============
         * Las 4 rutas más usadas a UN tap; Inventario/Clientes/Más siguen en
         * el drawer del menú hamburguesa. */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest border-t border-outline pb-safe">
          <div className="grid grid-cols-4">
            {[
              { href: '/app/inicio', label: 'Inicio', icon: 'home' },
              { href: '/app/vender', label: 'Vender', icon: 'sell' },
              { href: '/app/live', label: 'Live', icon: 'videocam', live: true },
              { href: '/app/caja', label: 'Caja', icon: 'point_of_sale' },
            ].map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] active:opacity-70 transition-opacity ${
                    active ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="relative">
                    <Icon name={item.icon} size={21} />
                    {item.live && !active && (
                      <span className="absolute -top-0.5 -right-1 w-[6px] h-[6px] rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <PwaRegister />
      <OfflineBanner />
    </div>
  );
}
