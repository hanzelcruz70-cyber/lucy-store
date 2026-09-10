# PacaPOS · Punto de venta multitenant para tiendas de ropa

PWA instalable en celular, con Next.js 14, Supabase (datos + auth + RLS) y despliegue en Vercel.
Cada tienda (tenant) solo ve sus propios datos: caja, fiados, lotes y lives de TikTok.

## Estructura

```
lucy-store/
├── app/                     # App Router de Next.js
│   ├── page.js              # Landing
│   ├── login/ · signup/     # Autenticación
│   ├── app/                 # Área protegida (requiere sesión)
│   │   ├── caja/            # Caja y corte diario
│   │   ├── live/            # Lives de TikTok (apartados al vuelo)
│   │   ├── stock/           # Lotes/pacas + nuevo lote
│   │   ├── clientes/        # Fiados y abonos
│   │   └── catalogo/        # Próximamente
│   └── api/
│       ├── create-store/    # Crea tienda + perfil (usa SERVICE_ROLE, con rate limit)
│       └── provision/       # Post-login para cuentas confirmadas por email
├── components/              # AppShell, botón instalar PWA
├── lib/                     # Clientes Supabase (browser/server)
├── middleware.js            # Bloquea /app y /admin sin sesión
├── public/
│   ├── manifest.json        # PWA
│   ├── sw.js                # Service worker offline
│   └── icons/               # Íconos PWA
└── supabase/schema.sql      # ← EJECUTAR EN SUPABASE
```

## Puesta en marcha (10 minutos)

### 1) Supabase
1. Crea cuenta en [supabase.com](https://supabase.com) → **New project**.
2. En **SQL Editor** pega TODO el contenido de `supabase/schema.sql` → **Run**.
3. En **Settings → API** copia:
   - `Project URL` → va en `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → va en `SUPABASE_SERVICE_ROLE_KEY` (¡NUNCA al navegador!)

### 2) Local
```bash
# 1. Edita .env.local con las 3 llaves de arriba
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
En el dashboard de Vercel → **Settings → Environment Variables**, agrega las 3 variables
de Supabase y haz **redeploy**. En producción PWA requiere HTTPS (Vercel lo da gratis).

## Seguridad implementada (por qué no te hackean)

| Riesgo | Defensa |
|---|---|
| Otra tienda ve tus datos | **RLS de Supabase**: TODA tabla se filtra por `store_id` del usuario. Aunque alguien manipule el navegador, la base de datos rechaza el acceso. |
| Alguien entra sin sesión | `middleware.js` redirige `/app/*` a login (verificado: responde 307). |
| Crear tiendas por bots | La API solo acepta usuarios autenticados + límite de tiendas por día + validación de datos. |
| Robo de la llave service_role | Solo se usa en el servidor (`/api`), jamás se envía al navegador. |
| Clickjacking / MIME sniffing | Headers de seguridad: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` en `next.config.mjs`. |
| Contraseñas | Las maneja Supabase Auth (hash + JWT firmado en cookie httpOnly). |
| Rate limit de escritura | Límite global de creación de tiendas por día (`lib/rate-limit.js`). |

## Nombres de dominio para Vercel (elige el que gustes)

| Dominio | Disponible probablemente como |
|---|---|
| **PacaPOS** (actual) | pacapos.com · pacapos.app · pacapos.mx |
| FiaDona | fiadona.com |
| RopaRegister | roparegister.com |
| TienditaOS | tienditaos.com |
| VendePaca | vendepaca.com |
| CorteCaja | cortecaja.app |
| PacaCaja | pacacaja.com |

> El gratuito de Vercel te da `pacapos.vercel.app`. Un dominio propio (~$10/año en
> Namecheap/GoDaddy) se conecta en Vercel → Settings → Domains.

## Cuentas de prueba

1. Entra a `/signup`, crea tu cuenta y nombre de tienda.
2. Confirma el correo (revisa spam si no llega).
3. Entra con `/login` → aterrizas en `/app/caja`.

## Comandos

```bash
npm run dev     # desarrollo en http://localhost:3001
npm run build   # compilación de producción
npm run start   # servidor de producción local (puerto 3001)
```
