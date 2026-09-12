const SITE_URL = 'https://mi-prenda.vercel.app';

/* Sitemap para Google Search Console — solo páginas públicas.
 * El área /app y /login no se indexan (datos privados por tienda). */
export default function sitemap() {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
