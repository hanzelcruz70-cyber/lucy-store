'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { clearStoreCache } from '@/lib/get-store';
import PwaRegister from '@/components/PwaRegister';

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
    store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 20V9M9.5 21.5v-6h5v6" />,
    videocam: <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3" />,
    point_of_sale: <path d="M4 4h16v4H4zM6 8v3h12V8M5 11h14v9H5zM9 15h6" />,
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

  const logout = async () => {
    const supabase = createClient();
    clearStoreCache();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href) => pathname === href || (pathname.startsWith(href + '/') && href !== '/app');

  const Appbar = ({ onMenu }) => (
    <div className="flex items-center gap-2.5 px-4 py-3.5 bg-surface-container-lowest border-b border-outline">
      <button
        onClick={onMenu}
        className="w-9 h-9 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity"
        aria-label="Abrir menú"
      >
        <Icon name="menu" size={18} />
      </button>
      <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
        <span className="text-primary flex-none" aria-hidden="true">
          <Icon name="store" size={19} />
        </span>
        <b className="text-[15px] font-bold text-on-surface truncate leading-tight">{storeName}</b>
      </div>
      <button
        onClick={logout}
        className="w-9 h-9 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity"
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

        <main className="flex flex-col relative w-full pt-[62px] md:pt-0 pb-8 md:pb-12 bg-surface min-h-screen max-w-3xl lg:max-w-4xl mx-auto">
          {children}
        </main>
      </div>

      <PwaRegister />
    </div>
  );
}
