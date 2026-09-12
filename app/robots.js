/* robots.txt para Google — páginas públicas indexables, área privada bloqueada */
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/admin', '/login'],
      },
    ],
    sitemap: 'https://mi-prenda.vercel.app/sitemap.xml',
  };
}
