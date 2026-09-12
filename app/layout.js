import './globals.css';

const SITE_URL = 'https://mi-prenda.vercel.app';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mi Prenda · Punto de Venta para Tiendas de Ropa Americana',
    template: '%s · Mi Prenda',
  },
  description:
    'App de punto de venta para tiendas de ropa americana y bazares: caja con arqueo diario, fiados con abonos, inventario con ganancias y Lives de TikTok. Funciona sin internet e instalable en tu celular.',
  applicationName: 'Mi Prenda',
  keywords: [
    'punto de venta ropa americana',
    'POS para paca',
    'sistema de ventas para tienda de ropa',
    'control de fiados y abonos',
    'inventario tienda de ropa',
    'ventas en lives de TikTok',
    'app para bazares',
    'arqueo de caja diario',
  ],
  manifest: '/manifest.json',
  icons: { icon: '/icons/favicon.png', apple: '/icons/icon-192.png' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Mi Prenda',
    title: 'Mi Prenda · Punto de Venta para Tiendas de Ropa Americana',
    description:
      'Caja, fiados, inventario y Lives de TikTok en una sola app. Funciona sin internet e instalable en tu celular.',
    locale: 'es_NI',
    images: [{ url: '/icons/og-image.jpg', width: 1200, height: 630, alt: 'Mi Prenda — punto de venta para tiendas de ropa americana' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Prenda · Punto de Venta para Tiendas de Ropa',
    description: 'Caja, fiados, inventario y Lives de TikTok en una sola app. Instalable y offline.',
    images: ['/icons/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'Y1SjT4bsLW7WUn-fkQpkfNqyBDPEw6grN1aAB6hqkK8',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#D6337F',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `console.log('%c🛑 CUIDADO','color:#fff;background:#C2185B;font-size:22px;font-weight:bold;padding:6px 10px;border-radius:4px');console.log('%cSi alguien te pide pegar código aquí, es un intento de robo (self-XSS). Podría borrar tu tienda o ver tus datos. NUNCA pegues nada que no escribiste tú.','font-size:13px');`
          }}
        />
      </body>
    </html>
  );
}
