# PacaPOS · Punto de venta multitenant para tiendas de ropa

PWA instalable en celular, con Next.js 15, Supabase (datos + auth + RLS) y despliegue en Vercel.
Cada tienda (tenant) solo ve sus propios datos: caja, fiados, lotes y lives de TikTok.

> Repo público: el código es abierto, pero las llaves (Supabase, admin) viven solo en
> `.env.local` (gitignored) y los datos de cada tienda están protegidos por RLS en Supabase.

## Estructura

```
lucy-store/
├── app/                     # App Router de Next.js
│   ├── page.js              # Landing
│   ├── login/               # Autenticación
│   ├── admin/               # Panel admin (crea tiendas)
│   ├── app/                 # Área protegida (requiere sesión)
│   │   ├── inicio/          # Caja del día, movimientos con folio, abonos con historial
│   │   ├── vender/          # Venta mostrador (carrito, stock, sugerencias de clientes)
│   │   ├── live/            # Lives de TikTok (apartados al vuelo)
│   │   ├── caja/            # Caja y corte diario con arqueo
│   │   ├── stock/           # Lotes/pacas + nuevo lote
│   │   ├── clientes/        # Fiados y abonos
│   │   └── mas/             # Gastos, estadísticas, exportar
│   └── api/
│       └── admin/stores/    # Crear/eliminar tiendas (SERVICE_ROLE + rate limit)
├── components/              # AppShell, CierreCaja, PWA
├── lib/                     # Clientes Supabase + contexto cacheado
├── supabase/schema.sql      # ← EJECUTAR EN SUPABASE
├── .github/workflows/ci.yml # CI: build + gitleaks + npm audit
└── CONSTRAINTS.md           # Contrato de calidad — leer antes de codificar
```

## Puesta en marcha (10 minutos)

### 1) Supabase
1. Crea cuenta en [supabase.com](https://supabase.com) → **New project**.
2. En **SQL Editor** pega TODO el contenido de `supabase/schema.sql` → **Run**.
   Luego `migration2-products.sql` y `migration5-fix-triggers.sql`.
3. En **Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (¡NUNCA al navegador!)

### 2) Local
```bash
# 1. Edita .env.local con las llaves de arriba + ADMIN_PASSWORD y ADMIN_SECRET
# 2. Instala y corre en puerto 3001:
npm install
npm run dev
# Abre http://localhost:3001
```

### 3) Vercel
```bash
npm i -g vercel
vercel login
vercel          # primera vez: acepta todo
vercel --prod   # despliegue a producción
```
En el dashboard → **Settings → Environment Variables**, agrega las 5 variables
de Supabase y haz **redeploy**. En producción PWA requiere HTTPS (Vercel lo da gratis).

## Calidad y CI

- **`CONSTRAINTS.md`**: contrato de calidad del proyecto (piso mínimo + checks con números)
- **CI en cada push**: build + escaneo de secrets (gitleaks) + auditoría de dependencias
- **Commits atómicos**: un fix = un commit
- La guía completa para IAs está en **`AI-GUIDE.md`**; la guía del dueño de tienda en **`GUIA-USUARIO.pdf`** (regenerable con `node scripts/generar-guia-pdf.cjs`)

## Seguridad implementada (por qué no te hackean)

| Riesgo | Defensa |
|---|---|
| Otra tienda ve tus datos | **RLS de Supabase**: TODA tabla se filtra por `store_id`. La base de datos rechaza el acceso aunque alguien manipule el navegador. |
| Alguien entra sin sesión | `middleware.js` redirige `/app/*` a login. |
| Crear tiendas por bots | La API solo acepta usuarios autenticados + rate limit (8/15min) + comparación timing-safe. |
| Robo de la llave service_role | Solo se usa en el servidor (`/api`), jamás se envía al navegador. |
| Secrets en el repo | `.env.local` gitignored + gitleaks escanea cada commit en CI. |
| Clickjacking / MIME sniffing | Headers de seguridad en `next.config.mjs`. |
| Contraseñas | Las maneja Supabase Auth (hash + JWT en cookie httpOnly). |

## Cuentas de prueba

1. Entra a `/admin` con la contraseña de administrador → crea una tienda.
2. Entrega al cliente su correo y contraseña.
3. Entra con `/login` → aterrizas en `/app/inicio`.

## Comandos

```bash
npm run dev     # desarrollo en http://localhost:3001
npm run build   # compilación de producción (requiere las 2 vars públicas en env)
npm run start   # servidor de producción local (puerto 3001)
```
