# PacaPOS · Documentación del Proyecto

> **Guía para IAs y desarrolladores.** Todo lo necesario para entender, modificar y desplegar este proyecto sin contexto previo.

## Qué es

PacaPOS es un **Punto de Venta (POS) multitenant en modo PWA** para tiendas de ropa (paca/americana) que venden por mostrador y por **Lives de TikTok**, con gestión de **fiados (créditos)**, lotes/pacas, gastos y estadísticas de productos. Moneda: **Córdobas (C$)** — Nicaragua.

**Marca/Nombre:** PacaPOS (opciones de dominio: pacapos.app, pacapos.mx, fiadona.com, cortecaja.app)

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.x |
| UI | React + Tailwind CSS | 18.3 / 3.4 |
| Backend/DB/Auth | Supabase (PostgreSQL + RLS) | — |
| PWA | manifest.json + sw.js (offline-first) | — |
| Deploy | Vercel | — |
| Puerto local | 3001 | `npm run dev` o `npm run start` |

## Estructura

```
lucy-store/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Layout raíz: fuentes, SW registration, metadata PWA
│   ├── page.js                   # Landing pública (solo botón login)
│   ├── login/page.js             # Login del cliente (alerta en pantalla, nunca se va en blanco)
│   ├── admin/page.js             # PANEL ADMIN (crea cuentas de tiendas) — contraseña en .env
│   ├── app/                       # Área PROTEGIDA (middleware exige sesión)
│   │   ├── layout.js             # Carga perfil+tienda del usuario; "Cuenta sin tienda" si falta
│   │   ├── inicio/               # Dashboard: caja del día, movimientos, deudores (tap = abonar)
│   │   │   ├── page.js           # Server: consulta ventas/gastos/deudas de HOY
│   │   │   └── InicioClient.js   # Client: abono modal a deudores
│   │   ├── live/                 # Live TikTok: apartado ultrarrápido
│   │   │   ├── page.js           # Server: ventas channel=tiktok_live de hoy
│   │   │   └── LiveConsole.js    # Client: apartar, Cobrado (paga), A Fiado (crea deuda)
│   │   ├── caja/                 # Balance del día + corte diario (DailyCutButton)
│   │   ├── stock/                # Lotes/pacas: margen, rotación
│   │   │   └── nuevo/            # Formulario nueva paca (cálculo costo unitario en vivo)
│   │   ├── clientes/             # Clientes: agregar, buscar, tap → hoja (abonar/fiado/eliminar)
│   │   │   └── ClientsList.js    # Toda la lógica cliente
│   │   ├── mas/                  # Gastos del negocio + exportar Excel + estadísticas productos
│   │   │   └── MasClient.js      # CSV con BOM (abre en Excel), top/bottom vendidos
│   │   └── catalogo/             # Placeholder (futuro catálogo público)
│   └── api/
│       └── admin/stores/         # GET/POST/DELETE tiendas — guard con rate limit (8/15min)
├── components/
│   ├── AppShell.js               # Sidebar (desktop) + nav inferior (móvil) + logout
│   ├── DailyCutButton.js         # Corte de caja → inserta en cash_cuts
│   ├── LogoutButton.js           # Botón cerrar sesión (para pantalla "sin tienda")
│   └── PwaRegister.js            # Botón "Instalar App" (beforeinstallprompt)
├── lib/
│   ├── supabase-server.js        # Cliente Supabase server-side (cookies)
│   ├── supabase-browser.js       # Cliente Supabase browser-side
│   ├── get-store.js              # getMyContext(): {storeId, userId} — CACHÉ, usar en TODO insert
│   └── rate-limit.js             # Constante límite de tiendas/día
├── middleware.js                 # Bloquea /app sin sesión; login→inicio si logueado
├── supabase/
│   ├── schema.sql                # Migración 1: 9 tablas + RLS + policies (EJECUTAR PRIMERO)
│   ├── migration2-products.sql   # Migración 2: tabla products + estadísticas
│   ├── migration3-triggers.sql  # Migración 3: triggers fill store_id (obsoleta, ver 5)
│   ├── migration4-user-triggers.sql # Migración 4: triggers fill store+user (obsoleta, ver 5)
│   └── migration5-fix-triggers.sql  # Migración 5: CORRECTA — triggers separados por tabla
├── public/
│   ├── manifest.json             # PWA manifest (rosa #E040A0)
│   ├── sw.js                     # Service worker: offline-first, no cachea /api ni Supabase
│   ├── offline.html              # Página sin conexión
│   └── icons/                    # 4 íconos PNG (192/512, normal + maskable)
├── next.config.mjs                # Headers de seguridad (DENY frame, nosniff, etc)
├── tailwind.config.js             # Paleta rosa personalizada (ver abajo)
└── .env.local                    # LLAVES (NO commitear)
```

## Variables de entorno (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # pública, va al navegador
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # PRIVADA, solo /api — NUNCA al cliente
ADMIN_PASSWORD=...                           # contraseña del panel /admin
ADMIN_SECRET=...                             # token alterno para scripts
```

## Modelo de datos (Supabase / PostgreSQL)

**Regla de oro del multitenant:** TODA tabla transaccional tiene `store_id`. El RLS filtra por `current_store_id()` (función que lee el perfil del usuario autenticado).

| Tabla | Para qué | Campos clave |
|---|---|---|
| `stores` | Tenant/tienda | id, name, slug, owner_email |
| `profiles` | Usuario ↔ tienda | id (=auth.users), store_id, role, display_name |
| `sales` | Ventas | store_id, user_id, total, items_count, channel (mostrador/tiktok_live/whatsapp), payment_method (efectivo/transferencia/fiado), client_name, notes |
| `expenses` | Gastos | concept, amount, category (operativo/proveedor/renta/otro) |
| `lots` | Pacas/lotes | code, pieces_total, pieces_left, total_cost, avg_sale_price |
| `products` | Productos (estadísticas) | code, name, sale_price, sold_count, lot_id |
| `clients` | Clientes | name, phone, tiktok, balance, is_live_client |
| `debts` | Fiados | client_id, original_amount, remaining, status (pendiente/saldada), sale_id |
| `payments` | Abonos/pagos | debt_id?, sale_id?, amount, method |
| `cash_cuts` | Cortes de caja diarios | sales_total, collected_total, credit_total, expenses_total |

### RLS — cómo funciona la seguridad

1. **Cada policy** compara `store_id = current_store_id()`, que lee el perfil del JWT autenticado
2. En inserts de sales/payments/expenses/lots/debts también exige `user_id = auth.uid()`
3. **Triggers de respaldo** (migration5): `fill_store_and_user()` rellena store_id+user_id en tablas que los tienen; `fill_store_only()` solo store_id en clients/products — **NO usar el trigger completo en clients/products (no tienen user_id y revienta)**

### Errores conocidos y sus causas

| Error SQL | Causa | Fix |
|---|---|---|
| `new row violates row-level security policy` | Insert sin store_id o user_id | Código ya manda ambos vía `getMyContext()`; triggers son respaldo |
| `record "new" has no field "user_id"` | Trigger completo en tabla sin esa columna | Solo usar fill_store_only en clients/products (migration5 lo corrige) |
| `deadlock detected` al correr migración | App conectada mientras SQL pide locks | Detener servidor → Run SQL → encender |

## Flujos clave

### 1. Admin crea tienda (flujo de negocio principal)
`/admin` (password) → POST /api/admin/stores → service_role crea: auth user (email_confirm: true) → stores → profiles vinculados → El cliente recibe email+contraseña → entra en `/login` → aterriza en `/app/inicio` viendo **el nombre exacto que el admin le dio a la tienda** (header).

### 2. Venta fiado desde Live
Apartar (insert sales, payment_method='fiado') → botón "A Fiado" → busca/crea client → insert debts (remaining=total) → update clients.balance → deudor aparece en Inicio/Clientes.

### 3. Cobrar deuda
Tap en tarjeta de deudor (Inicio o Clientes) → hoja de acción → Registrar Abono → insert payments → descuenta debts (FIFO por created_at) → update clients.balance → UI al instante.

### 4. Corte de caja
Caja → "Realizar Corte Diario" → confirm con resumen → insert cash_cuts → botón queda deshabilitado el resto del día.

## Reglas de UI

- **Paleta rosa** (tailwind.config.js): primary `#E040A0`, texto `#19010C`, secundario `#952964` (sustituye verde éxito), superficies `#F7F4F5/#F7E9EC/#F6CCD9`
- **Moneda:** SIEMPRE `C$` + `toLocaleString('es-NI')` — función `money()` al inicio de cada componente
- Tipografías: Plus Jakarta Sans (texto) + Space Grotesk (números/display)
- Iconos: Material Symbols Outlined
- Responsive: sidebar ≥768px; nav inferior + header solo móvil; listados grid lg:grid-cols-2

## Convenciones CRÍTICAS (para no romper nada)

1. **TODO insert de cliente-side** debe llamar `getMyContext()` y mandar `store_id` + `user_id` (excepto clients/products: solo store_id)
2. **Nunca** uses `eval`, `innerHTML` con datos, ni expongas SERVICE_ROLE en el cliente
3. **Encoding de archivos**: guardar SIEMPRE UTF-8 sin BOM — PowerShell con `Set-Content` corrompe tildes; usar `[System.IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))`
4. Reemplazos masivos con regex: cuidado con `' + '` (concatenación JS) — un replace de `$` o `+` global rompe el código
5. Server components (`page.js`) consultan datos; client components (`*Client.js`) manejan interactividad
6. Páginas protegidas usan `export const dynamic = 'force-dynamic'` (datos frescos por tienda)

## Despliegue

### Local (puerto 3001)
```bash
npm install
npm run dev        # desarrollo con hot-reload
# o producción:
npm run build && npm run start
```
**Red local (celular):** el servidor de Next escucha en todas las interfaces por defecto en `start`; abrir `http://TU-IP:3001` (ej. http://192.168.1.15:3001). Si el firewall de Windows lo bloquea: permitir Node.js en Firewall (Red privada). En dev, usar `npx next dev -p 3001 -H 0.0.0.0`.

### Vercel
```bash
npm i -g vercel
vercel          # primera vez: aceptar todo
vercel --prod   # producción
```
Agregar en Dashboard → Settings → Environment Variables: las 5 variables de `.env.local`, luego redeploy. PWA requiere HTTPS (Vercel lo da).

### Migraciones Supabase (en orden)
1. `schema.sql` (obligatorio base)
2. `migration2-products.sql`
3. `migration5-fix-triggers.sql` (3, 4 son obsoletos)
**Siempre detener el servidor local antes (deadlock).**

## Estado de seguridad (auditoría npm)

- Next 15.5.25, supabase-js latest: **sin vulnerabilidades runtime**
- postcss 8.4.31 interno de Next: riesgo build-time únicamente, aceptado
- Rate limiting: API admin 8 intentos/15min por IP
- Headers: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy
- Secrets: solo en .env.local (gitignored)

## Roadmap pendiente

- [ ] Catálogo web público por tienda
- [ ] Exportar Excel real .xlsx (hoy es CSV con BOM)
- [ ] Edición de lotes (descuento manual de piezas al vender)
- [ ] Notificaciones push para cobros
- [ ] Reportes históricos por rango de fechas
