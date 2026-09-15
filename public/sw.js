/* Mi Prenda Service Worker v13 — fixes QA 2026-09-14 */
const CACHE = 'miprenda-v13';
const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/icons/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/og-image.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Toma el control de las pestañas abiertas SIN forzar navegación: un deploy
  // durante un carrito o un arqueo en curso ya no pierde lo escrito. La
  // próxima navegación natural ya sirve el HTML nuevo (network-first).
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Supabase y APIs: nunca cachear (datos en vivo)
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co')) {
    return;
  }

  // Navegación client-side de Next (fetch RSC, header RSC-Next-Router o
  // ?_rsc=): SIEMPRE red, sin caché. Antes caían en stale-while-revalidate
  // y servían el payload del "día de antes" al instante (QA 2026-09-14:
  // Caja/Inicio mostraban datos viejos incluso tras re-login).
  const isRsc =
    url.searchParams.has('_rsc') ||
    (request.headers && (request.headers.get('RSC-Next-Router-State') || request.headers.get('Next-Router-State-Tree')));
  if (isRsc) return;

  // Navegación: SIEMPRE red primero (datos frescos del día), offline usa caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/offline.html')))
    );
    return;
  }

  // Estáticos (JS/CSS/fuentes/íconos): cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Otros GET: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
