import './globals.css';

export const metadata = {
  title: 'PacaPOS · Punto de Venta',
  description: 'Caja, fiados, lotes y Lives de TikTok para tiendas de ropa americana.',
  manifest: '/manifest.json',
  themeColor: '#D6337F',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PacaPOS' },
  icons: { icon: '/icons/icon-512.png', apple: '/icons/icon-192.png' },
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
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
      </body>
    </html>
  );
}
