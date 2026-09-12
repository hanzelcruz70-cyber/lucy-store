import Link from 'next/link';

/* ============================================================
 * LANDING Mi Prenda — plantilla v3 adaptada:
 * logo de tienda + paleta rosa Mi Prenda, moneda C$,
 * Material Symbols → SVG inline (sin CDN), links a /login.
 * ============================================================ */

const M = ({ name, size = 20, cls = '' }) => {
  const paths = {
    storefront: (
      <>
        <path d="M4 10.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5" />
        <path d="M3.5 6.5L5 3h14l1.5 3.5" />
        <path d="M3.5 6.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5" />
        <path d="M9.75 21v-5.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V21" />
      </>
    ),
    arrow_forward: <path d="M4 12h16M13 5l7 7-7 7" />,
    chat: <path d="M4 5h16v11H8l-4 4z" />,
    wifi_off: (
      <>
        <path d="M2 2l20 20" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M5 12.5a10 10 0 0 1 3-2" />
        <path d="M12 20h.01" />
      </>
    ),
    install_mobile: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M11 18.5h2" />
      </>
    ),
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13V9M9 2.5h6" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6L6 18" />,
    question_mark: <path d="M8.8 8.5a3.2 3.2 0 1 1 4.5 3c-1 .5-1.3 1-1.3 2M12 17h.01" />,
    money_off: (
      <>
        <path d="M2 2l20 20" />
        <path d="M9 9.5A3.5 3.5 0 0 0 12 5.5c1.2 0 2.2.4 2.8 1M15.5 9v1M9.5 15v.5M5.5 12.5h13" />
      </>
    ),
    sentiment_dissatisfied: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 10h.01M15 10h.01M8.5 16a4.5 4.5 0 0 1 7 0" />
      </>
    ),
    verified: <path d="M3.5 12.5l3 3 4.5-4.5 4.5 4.5 3-3L14 4.5h-4z" />,
    spa: (
      <>
        <path d="M12 21c4-2 7-5 7-9-4 0-7 2-7 5 0-3-3-5-7-5 0 4 3 7 7 9z" />
        <path d="M12 21V12" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    warning: (
      <>
        <path d="M12 8v5M12 16.5h.01" />
        <path d="M10.3 3.8L1.8 18.4a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
      </>
    ),
    receipt_long: (
      <>
        <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    point_of_sale: <path d="M4 4h16v4H4zM6 8v3h12V8M5 11h14v9H5zM9 15h6" />,
    cell_tower: (
      <>
        <path d="M7 3a10 10 0 0 0 0 18M17 3a10 10 0 0 1 0 18" />
        <path d="M4 3l8 10 8-10" />
      </>
    ),
    query_stats: (
      <>
        <path d="M4 19h16" />
        <path d="M4 15l4-6 4 3 5-8" />
      </>
    ),
    menu_book: (
      <>
        <path d="M4 5c2.5-1 5.5-1 8 1 2.5-2 5.5-2 8-1v14c-2.5-1-5.5-1-8 1-2.5-2-5.5-2-8-1z" />
        <path d="M12 6v14" />
      </>
    ),
    bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
    smartphone: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M11 18.5h2" />
      </>
    ),
    shield: <path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" />,
    sell: (
      <>
        <path d="M3 12l9-9h9v9l-9 9z" />
        <circle cx="16.5" cy="7.5" r="1.5" />
      </>
    ),
    mark_chat_unread: (
      <>
        <path d="M4 5h16v11H8l-4 4z" />
        <circle cx="17" cy="5" r="2.5" />
      </>
    ),
    post_add: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M12 8v6M9 11h6" />
      </>
    ),
    payments: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    check: <path d="M4 12l5 5L20 7" />,
    login: <path d="M14 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M3 12h12M10 6l6 6-6 6" />,
    support_agent: (
      <>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <rect x="3" y="13" width="4" height="6" rx="1.5" />
        <rect x="17" y="13" width="4" height="6" rx="1.5" />
        <path d="M9 19h6M12 4V3" />
      </>
    ),
    verified_user: (
      <>
        <path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    devices: (
      <>
        <rect x="2" y="5" width="13" height="10" rx="1.5" />
        <rect x="17" y="8" width="5" height="12" rx="1.5" />
      </>
    ),
    cloud_sync: (
      <>
        <path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.4 2.6A3.5 3.5 0 0 1 17 18z" />
        <path d="M12 13v5M10 16l2 2 2-2" />
      </>
    ),
    shield_person: (
      <>
        <path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

const WHATSAPP_URL = 'https://wa.me/';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-canvas font-body-md text-body-md text-on-surface antialiased">
      {/* ============ HEADER FIJO ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-canvas/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[10px] bg-primary text-on-primary flex items-center justify-center">
              <M name="storefront" size={20} />
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-extrabold">Mi Prenda</span>
          </div>
          <nav className="hidden lg:flex items-center gap-5">
            <span className="font-label-md text-label-md bg-mint-surface text-primary font-bold rounded-lg px-2.5 py-1.5">Inicio</span>
            <a href="#funciones" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors px-2.5 py-1.5">Funciones</a>
            <a href="#beneficios" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors px-2.5 py-1.5">Beneficios</a>
            <a href="#como-empezar" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors px-2.5 py-1.5">Cómo empezar</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-all shadow-[0_10px_25px_-5px_rgba(185,43,108,0.18)]"
            >
              Entrar a mi tienda
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full pt-28 pb-16 bg-surface-canvas">
        <div className="flex flex-col w-full">
          {/* ============ SECCIÓN 1: HERO ============ */}
          <section className="relative w-full overflow-hidden pb-12">
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-tr from-secondary-container/20 via-primary/5 to-tertiary-container/10 blur-3xl pointer-events-none -z-10 rounded-full" />
            <div className="absolute -top-10 right-10 w-72 h-72 bg-mint-surface rounded-full blur-2xl pointer-events-none -z-10" />
            <div className="max-w-6xl mx-auto px-4 sm:px-8">
              <div className="flex items-center justify-center pt-5 mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-mint-surface shadow-sm hover:scale-[1.01] transition-transform">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="font-label-md text-label-md text-primary font-bold">✨ Diseñado exclusivamente para tiendas de ropa americana y bazares</span>
                </div>
              </div>
              <div className="text-center max-w-3xl mx-auto mb-8">
                <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-extrabold mb-4">
                  Tu tienda de ropa,{' '}
                  <span className="text-primary underline decoration-secondary-fixed-dim decoration-wavy underline-offset-8">en orden</span>{' '}
                  y en tu bolsillo
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
                  Mi Prenda es el punto de venta para tiendas de americana: caja, fiados, inventario y Lives de TikTok
                  en una sola app. Sin libretas, sin Excel, sin cuentas a mano al final del día.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                  <Link
                    href="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-lg shadow-primary-container/20 hover:bg-primary transition-all active:scale-95"
                  >
                    <span>Entrar a mi tienda</span>
                    <M name="arrow_forward" size={20} />
                  </Link>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-surface-card text-on-surface font-label-lg text-label-lg font-bold shadow-sm hover:bg-mint-surface transition-all active:scale-95"
                  >
                    <span className="text-primary">
                      <M name="chat" size={20} />
                    </span>
                    <span>Solicitar cuenta vía WhatsApp</span>
                  </a>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-5 mt-6 text-on-surface-variant font-caption text-caption font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-primary"><M name="wifi_off" size={16} /></span>
                    Funciona sin internet
                  </span>
                  <span className="hidden sm:inline text-outline-variant">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-primary"><M name="install_mobile" size={16} /></span>
                    Instalable directo en tu celular
                  </span>
                  <span className="hidden sm:inline text-outline-variant">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-primary"><M name="timer" size={16} /></span>
                    Cuentas listas en minutos
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ============ SECCIÓN 2: ¿TE SUENA FAMILIAR? ============ */}
          <section className="w-full py-12 bg-surface-container-low/60" id="funciones">
            <div className="max-w-6xl mx-auto px-4 sm:px-8">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Diagnóstico diario de bazar</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">¿Te suena familiar?</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                  Llevar un bazar de ropa americana en la cabeza o en papeles desgastados te roba tiempo, dinero y
                  calma mental. Mira la diferencia.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
                {/* ANTES: La Libreta y el Caos */}
                <div className="bg-surface-card rounded-2xl p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-error/5 rounded-full blur-xl pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error-container/30 text-error font-label-sm text-label-sm font-bold">
                        <M name="close" size={16} />
                        Antes: La Libreta y el Caos
                      </div>
                      <span className="text-outline-variant"><M name="receipt_long" size={28} /></span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-highest/30">
                        <span className="text-error shrink-0 mt-0.5"><M name="question_mark" size={20} /></span>
                        <p className="font-body-md text-body-md text-on-surface italic">"¿Cuánto le puse a esa blusa que me trajo María?"</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-highest/30">
                        <span className="text-error shrink-0 mt-0.5"><M name="money_off" size={20} /></span>
                        <p className="font-body-md text-body-md text-on-surface italic">"Le fié a la vecina… ¿cuánto llevaba acumulado este mes?"</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-highest/30">
                        <span className="text-error shrink-0 mt-0.5"><M name="sentiment_dissatisfied" size={20} /></span>
                        <p className="font-body-md text-body-md text-on-surface italic">"El live terminó y no sé qué apartó quién entre 300 comentarios."</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 text-outline font-caption text-caption flex items-center gap-2">
                    <M name="warning" size={16} />
                    Pérdida estimada del 15% de ingresos por olvidos y descontrol.
                  </div>
                </div>

                {/* AHORA: Tranquilidad Total con Mi Prenda */}
                <div className="bg-primary text-on-primary rounded-2xl p-8 shadow-lg relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -right-12 -top-12 w-48 h-48 bg-secondary/30 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mint-badge text-on-secondary-container font-label-sm text-label-sm font-extrabold">
                        <M name="verified" size={16} />
                        Ahora con Mi Prenda: Tranquilidad Total
                      </div>
                      <span className="text-mint-badge"><M name="spa" size={28} /></span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-on-primary/10 backdrop-blur-sm">
                        <div className="w-6 h-6 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5 font-bold text-[13px]">✓</div>
                        <p className="font-body-md text-body-md text-on-primary">Todo queda anotado solo, con ganancias calculadas y folio de cada movimiento.</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-on-primary/10 backdrop-blur-sm">
                        <div className="w-6 h-6 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5 font-bold text-[13px]">✓</div>
                        <p className="font-body-md text-body-md text-on-primary">Controla abonos de fiados en un toque, con balance y recordatorio automático.</p>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-on-primary/10 backdrop-blur-sm">
                        <div className="w-6 h-6 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5 font-bold text-[13px]">✓</div>
                        <p className="font-body-md text-body-md text-on-primary">Saca el arqueo de caja diario contando billetes junto a la app en menos de 2 minutos.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 text-mint-surface/80 font-caption text-caption flex items-center gap-2">
                    <span className="text-mint-surface"><M name="lock" size={16} /></span>
                    Cero estrés nocturno. Cierras caja y te vas a descansar con dinero exacto.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============ SECCIÓN 3: FUNCIONES (BENTO GRID) ============ */}
          <section className="w-full py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
                <div>
                  <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Herramientas Operativas</span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">Hecho para el ritmo de la paca</h2>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-2 md:mt-0">
                  Cada pantalla resuelve las fricciones más comunes de quienes venden ropa por lote, piezas únicas y
                  transmisiones en vivo.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
                {/* Caja y corte diario */}
                <div className="lg:col-span-7 bg-surface-card rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-mint-surface text-primary flex items-center justify-center">
                        <M name="point_of_sale" size={26} />
                      </div>
                      <span className="font-caption text-caption px-3 py-1 rounded-full bg-surface-container font-bold text-on-surface-variant">Flujo Rápido</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold mb-2">Caja y corte diario</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                      Vende en segundos desde el mostrador. Al final del día, el arqueo cuenta los billetes contigo
                      para que ningún peso se pierda.
                    </p>
                  </div>
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center justify-between pb-1 mb-1">
                      <span className="font-label-sm text-label-sm text-on-surface font-bold">Desglose de Efectivo en Caja</span>
                      <span className="font-caption text-caption text-primary font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Cuadrando en vivo
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-on-surface">
                      <div className="bg-surface-card p-2 rounded-lg shadow-2xs">
                        <p className="font-caption text-caption text-on-surface-variant">Billetes C$500</p>
                        <p className="font-label-md text-label-md font-bold">6 = C$3,000</p>
                      </div>
                      <div className="bg-surface-card p-2 rounded-lg shadow-2xs">
                        <p className="font-caption text-caption text-on-surface-variant">Billetes C$200</p>
                        <p className="font-label-md text-label-md font-bold">7 = C$1,400</p>
                      </div>
                      <div className="bg-surface-card p-2 rounded-lg shadow-2xs">
                        <p className="font-caption text-caption text-on-surface-variant">Monedas / C$50</p>
                        <p className="font-label-md text-label-md font-bold">C$450</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-on-surface font-caption text-caption bg-mint-badge/40 px-3 py-1.5 rounded-lg">
                      <span>Total en Cajón: <strong>C$4,850.00</strong></span>
                      <span className="text-primary font-bold">Diferencia: C$0.00 ✓</span>
                    </div>
                  </div>
                </div>

                {/* Lives de TikTok */}
                <div className="lg:col-span-5 bg-surface-card rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-tertiary-fixed text-live-violet flex items-center justify-center">
                        <M name="cell_tower" size={26} />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-live-pulse/15 text-live-pulse font-caption text-caption font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-live-pulse animate-pulse" />
                        LIVE STREAM
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold mb-2">Lives de TikTok &amp; IG</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                      Aparta prendas en plena transmisión y luego cobras o fiás con un solo toque. Sin libreta, sin
                      peleas por quién ganó la prenda.
                    </p>
                  </div>
                  <div className="bg-surface-canvas rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-card shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-live-violet text-on-primary flex items-center justify-center font-caption text-caption font-bold">M</div>
                        <div className="min-w-0">
                          <p className="font-label-sm text-label-sm font-bold truncate">@mariagarcia</p>
                          <p className="font-caption text-caption text-on-surface-variant truncate">Apartó chaqueta Levis #14</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-mint-badge text-primary font-caption text-caption font-bold">C$350</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-card shadow-2xs opacity-75">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-caption text-caption font-bold">S</div>
                        <div className="min-w-0">
                          <p className="font-label-sm text-label-sm font-bold truncate">@sofia_vintage</p>
                          <p className="font-caption text-caption text-on-surface-variant truncate">Apartó falda denim #88</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-surface-container font-caption text-caption font-bold">C$220</span>
                    </div>
                  </div>
                </div>

                {/* Inventario con ganancias */}
                <div className="lg:col-span-5 bg-surface-card rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-mint-surface text-primary flex items-center justify-center">
                        <M name="query_stats" size={26} />
                      </div>
                      <span className="font-caption text-caption px-3 py-1 rounded-full bg-surface-container font-bold text-on-surface-variant">Márgenes Netos</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold mb-2">Inventario con ganancias</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                      Sabes cuánto te costó cada prenda dentro del fardo o paca, cuánto ganas por pieza y qué estilos
                      te conviene recomprar.
                    </p>
                  </div>
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center justify-between text-body-sm text-body-sm font-bold mb-1.5">
                      <span>Sudadera Vintage 90s</span>
                      <span className="text-primary font-extrabold">Retorno 3.5x</span>
                    </div>
                    <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden flex">
                      <div className="bg-outline-variant h-full" style={{ width: '28%' }} title="Costo unitario paca" />
                      <div className="bg-primary h-full" style={{ width: '72%' }} title="Margen neto" />
                    </div>
                    <div className="flex justify-between items-center mt-2 font-caption text-caption text-on-surface-variant">
                      <span>Costo paca: <strong>C$65</strong></span>
                      <span>Venta final: <strong className="text-on-surface font-bold">C$230</strong></span>
                      <span className="text-primary font-bold">+ C$165 ganancia</span>
                    </div>
                  </div>
                </div>

                {/* Fiados bajo control */}
                <div className="lg:col-span-7 bg-surface-card rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-flash-amber/15 text-flash-amber flex items-center justify-center">
                        <M name="menu_book" size={26} />
                      </div>
                      <span className="font-caption text-caption px-3 py-1 rounded-full bg-flash-amber/15 text-on-surface font-bold">Cero Cuentas Perdidas</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold mb-2">Fiados bajo control</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                      Quién te debe, desde cuándo y su historial de abonos. Se acabó el incómodo "déjame anotarlo en
                      el cuaderno" y las confusiones al cobrar.
                    </p>
                  </div>
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center justify-between p-2 bg-surface-card rounded-xl shadow-2xs mb-2">
                      <div>
                        <p className="font-label-md text-label-md font-bold text-on-surface">Doña Carmen (Vecina #12)</p>
                        <p className="font-caption text-caption text-on-surface-variant">Saldo: C$420 • Último abono: Ayer C$200</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-mint-surface text-primary font-label-sm text-label-sm font-bold">
                          + Registrar Abono
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-2 font-caption text-caption text-on-surface-variant">
                      <span>3 clientes con saldo pendiente</span>
                      <span className="text-flash-amber font-bold">Por cobrar: C$1,150.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============ SECCIÓN 4: BENEFICIOS TÉCNICOS ============ */}
          <section className="w-full pt-24 pb-20 px-4 sm:px-8 bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary relative overflow-hidden" id="beneficios">
            <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-secondary-fixed-dim/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 top-0 w-80 h-80 bg-tertiary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="max-w-6xl mx-auto w-full relative z-10">
              <div className="max-w-3xl mb-8 mx-auto text-center flex flex-col items-center">
                <span className="font-label-md text-label-md uppercase tracking-wider text-secondary-fixed-dim font-extrabold">Ingeniería Robusta y Simple</span>
                <h2 className="font-headline-lg text-headline-lg text-on-primary font-extrabold mt-3 tracking-tight">
                  La tecnología que tu tienda necesita, sin complicaciones técnicas
                </h2>
                <p className="font-body-md text-body-md text-inverse-on-surface/90 mt-2.5 max-w-2xl">
                  Diseñado para funcionar sin interrupciones en tianguis, cocheras, locales comerciales o
                  transmisiones nocturnas.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 justify-center items-stretch">
                {[
                  { icon: 'bolt', title: 'Funciona sin internet', desc: 'Si se cae la luz o el wifi o los datos, sigues cobrando y registrando normalmente. Todo se sincroniza solo al reconectar.' },
                  { icon: 'smartphone', title: 'Instalable en tu celular', desc: 'Se instala como app en Android o iPhone en un clic. No requieres comprar computadoras caras ni terminales aparatosas.' },
                  { icon: 'shield', title: 'Tus datos solo tuyos', desc: 'Información 100% aislada por negocio y encriptada. Ni proveedores ni competidores pueden ver tus ventas ni tus clientes.' },
                  { icon: 'sell', title: 'Creado para paca', desc: 'Entiende el modelo de negocio: piezas únicas, precios por bulto, liquidaciones rápidas y rotación veloz de inventario vintage.' },
                ].map((b) => (
                  <div key={b.title} className="bg-on-primary/10 backdrop-blur-md rounded-2xl p-6 hover:bg-on-primary/15 transition-all flex flex-col justify-between">
                    <div className="w-12 h-12 rounded-xl bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center mb-4 shrink-0">
                      <M name={b.icon} size={26} />
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-primary mb-1.5">{b.title}</h3>
                      <p className="font-body-sm text-body-sm text-inverse-on-surface/85">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============ SECCIÓN 5: CÓMO EMPEZAR ============ */}
          <section className="w-full py-12 bg-surface-canvas" id="como-empezar">
            <div className="max-w-6xl mx-auto px-4 sm:px-8">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Sin configuraciones difíciles</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">Empezar es fácil</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                  En 3 pasos simples tienes tu tienda lista para cobrar hoy mismo sin manuales técnicos.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
                {[
                  { n: '1', icon: 'mark_chat_unread', title: 'Escríbenos', desc: 'Mándanos un WhatsApp con el nombre de tu tienda. Te creamos el acceso seguro y te enviamos tu enlace en minutos.', foot: 'Alta exprés en < 5 min' },
                  { n: '2', icon: 'post_add', title: 'Ingresa tus productos', desc: 'Coloca nombre, costo estimado y precio. O simplemente usa folios rápidos de prendas. Sale directo al punto de venta.', foot: 'Sin catálogos engorrosos' },
                  { n: '3', icon: 'payments', title: 'Vende y cobra', desc: 'Cobra en mostrador, anota fiados o transmite en Live. Al cerrar, la app cuadra el día por ti automáticamente.', foot: 'Caja cuadrada en 2 minutos' },
                ].map((s) => (
                  <div key={s.n} className="bg-surface-card rounded-2xl p-8 shadow-sm relative flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm font-extrabold">
                          {s.n}
                        </div>
                        <span className="text-primary"><M name={s.icon} size={28} /></span>
                      </div>
                      <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-2">{s.title}</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant">{s.desc}</p>
                    </div>
                    <div className="mt-5 pt-2 font-caption text-caption text-primary font-bold flex items-center gap-1">
                      <M name="check" size={16} /> {s.foot}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============ SECCIÓN 6: CTA FINAL ============ */}
          <section className="w-full py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-8">
              <div className="bg-surface-container-high/60 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-1/4 w-72 h-72 bg-secondary-fixed-dim/30 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-2xl mx-auto relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-mint-surface text-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <M name="storefront" size={32} />
                  </div>
                  <h2 className="font-headline-xl text-headline-xl text-on-surface font-extrabold mb-4 tracking-tight">
                    Toma el control de tu tienda hoy mismo
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
                    Deja atrás la incertidumbre de la libreta y las horas perdidas sacando cuentas. Mi Prenda es el
                    aliado comercial de los mejores bazares.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                    <Link
                      href="/login"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-lg shadow-primary-container/20 hover:bg-primary transition-all active:scale-95"
                    >
                      <span>Entrar a mi tienda</span>
                      <M name="login" size={20} />
                    </Link>
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-surface-card text-on-surface font-label-lg text-label-lg font-bold shadow-sm hover:bg-mint-surface transition-all active:scale-95"
                    >
                      <span className="text-primary"><M name="support_agent" size={20} /></span>
                      <span>Escríbenos para crear tu cuenta</span>
                    </a>
                  </div>
                  <div className="pt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-on-surface-variant font-label-sm text-label-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-primary"><M name="verified_user" size={18} /></span>
                      <span>Datos 100% protegidos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary"><M name="devices" size={18} /></span>
                      <span>Instalable en cualquier smartphone</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="w-full bg-surface-container-low mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-primary text-on-primary flex items-center justify-center">
                  <M name="storefront" size={20} />
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-extrabold">Mi Prenda</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                El sistema de punto de venta y apartados en vivo creado para bazares, pacas y vendedores en TikTok e
                Instagram Live.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-mint-badge text-secondary font-label-sm text-label-sm">
                <M name="verified" size={16} />
                Operación 100% Offline y Online
              </div>
            </div>
            <div>
              <h4 className="font-label-lg text-label-lg text-on-surface mb-3 font-bold">Módulos Clave</h4>
              <ul className="space-y-2">
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  <a href="#funciones" className="">Control de Pacas y Bultos</a>
                </li>
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  <a href="#funciones" className="">Captura en Vivo TikTok &amp; IG</a>
                </li>
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  <a href="#funciones" className="">Libreta de Fiados &amp; Abonos</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-lg text-label-lg text-on-surface mb-3 font-bold">Recursos y Ayuda</h4>
              <ul className="space-y-2">
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  <a href="#como-empezar" className="">Guía de Inicio Rápido</a>
                </li>
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
                  <a href="#beneficios" className="">Calculadora de Margen de Paca</a>
                </li>
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Soporte WhatsApp 24/7</li>
                <li className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">Comunidad de Bazares</li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-lg text-label-lg text-on-surface mb-3 font-bold">Seguridad Garantizada</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-1.5 text-on-surface-variant">
                  <span className="text-primary"><M name="lock" size={18} /></span>
                  <span className="font-body-sm text-body-sm">Cifrado SSL de grado bancario en cada cobro</span>
                </div>
                <div className="flex items-start gap-1.5 text-on-surface-variant">
                  <span className="text-primary"><M name="cloud_sync" size={18} /></span>
                  <span className="font-body-sm text-body-sm">Respaldos automáticos en la nube cada 5 minutos</span>
                </div>
                <div className="flex items-start gap-1.5 text-on-surface-variant">
                  <span className="text-primary"><M name="shield_person" size={18} /></span>
                  <span className="font-body-sm text-body-sm">Privacidad estricta de base de clientes</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-high/40 p-3 rounded-xl">
            <p className="font-caption text-caption text-on-surface-variant">
              © 2026 Mi Prenda. Todos los derechos reservados. Diseñado para comerciantes de ropa vintage y bazares.
            </p>
            <div className="flex items-center gap-5 font-caption text-caption text-on-surface-variant">
              <a href="#" className="hover:text-on-surface transition-colors">Términos del Servicio</a>
              <a href="#" className="hover:text-on-surface transition-colors">Aviso de Privacidad</a>
              <a href="#" className="hover:text-on-surface transition-colors">Estado del Servidor</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Datos estructurados JSON-LD: Google entiende qué es Mi Prenda
          (aplicación, features, público) y puede mostrar rich results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Mi Prenda',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, Android, iOS',
            url: 'https://mi-prenda.vercel.app',
            description:
              'Punto de venta para tiendas de ropa americana y bazares: caja con arqueo diario, fiados con abonos, inventario con ganancias por pieza y apartados en Lives de TikTok. Funciona sin internet e instalable en el celular.',
            inLanguage: 'es-NI',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'NIO',
              description: 'Solicita tu cuenta vía WhatsApp',
            },
            featureList: [
              'Caja y corte diario con arqueo por denominaciones',
              'Fiados y abonos con historial por cliente',
              'Inventario con costo y ganancia por pieza',
              'Apartados en Lives de TikTok',
              'Modo offline con sincronización automática',
              'Instalable como app en el celular (PWA)',
            ],
          }),
        }}
      />
    </div>
  );
}
