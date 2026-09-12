# PacaPOS · Documentación del Proyecto

> **Guía para IAs y desarrolladores.** Todo lo necesario para entender, modificar y desplegar este proyecto sin contexto previo.
> **ANTES DE ESCRIBIR CÓDIGO: leer `CONSTRAINTS.md`.** Ese archivo es el contrato de calidad y no se debilita para que un cambio pase.

## Qué es

PacaPOS es un **Punto de Venta (POS) multitenant en modo PWA** para tiendas de ropa (paca/americana) que venden por mostrador y por **Lives de TikTok**, con gestión de **fiados (créditos)**, inventario de productos con stock, gastos y estadísticas. Moneda: **Córdobas (C$)** — Nicaragua.

**Marca/Nombre:** PacaPOS (opciones de dominio: pacapos.app, pacapos.mx)

**DECISIONES DE PRODUCTO:**
- El catálogo web público fue CANCELADO (2026-09-10). No construir catálogo ni páginas públicas de tienda.
- El concepto de "paca/lote" fue ELIMINADO DE LA UI (2026-09-10): la dueña ingresa un PRODUCTO en un solo paso (nombre, cantidad, costo total, precio) y sale directo a Vender. La tabla `lots` sigue existiendo como mecanismo interno de stock/costo (invisible), se crea automáticamente al ingresar un producto y se vincula por `products.lot_id`. NO exponer `lots` en la UI ni crear flujos separados de lote.

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.x |
| UI | React + Tailwind CSS | 18.3 / 3.4 |
| Backend/DB/Auth | Supabase (PostgreSQL + RLS) | — |
| PWA | manifest.json + sw.js (offline-first) | — |
| Deploy | Vercel | — |
| CI | GitHub Actions (build + gitleaks + npm audit) | `.github/workflows/ci.yml` |
| Repo | github.com/hanzelcruz70-cyber/lucy-store (privado) | — |
| Puerto local | 3001 | `npm run dev` o `npm run start` |

## Estructura

```
lucy-store/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Layout raíz: fuentes, SW registration, metadata PWA
│   ├── page.js                   # Landing pública (solo botón login)
│   ├── login/page.js             # Login del cliente
│   ├── admin/page.js             # PANEL ADMIN (crea cuentas de tiendas) — contraseña en .env
│   ├── app/                       # Área PROTEGIDA (middleware exige sesión)
│   │   ├── layout.js             # Carga perfil+tienda; "Cuenta sin tienda" si falta
│   │   ├── inicio/               # Dashboard del día + abono con historial en vivo
│   │   ├── vender/               # Venta mostrador: carrito, stock por producto, sugerencias de clientes
│   │   ├── live/                 # Live TikTok: apartado con precio validado
│   │   ├── caja/                 # Balance + cierre con arqueo (incluye abonos en efectivo)
│   │   ├── inventario/           # Ingreso unificado de producto + lista con stock
│   │   │   └── nuevo/            # Formulario "Ingresar producto" (crea lote interno + producto)
│   │   ├── clientes/             # Hoja de cliente: abono con método, historial, fiado directo
│   │   └── mas/                  # Gastos + estadísticas + exportar CSV
│   └── api/
│       └── admin/stores/         # GET/POST/DELETE tiendas — rate limit + safeEqual
├── components/
│   ├── AppShell.js               # Sidebar + nav móvil + logout (limpia caché de contexto)
│   ├── CierreCaja.js             # Arqueo por denominaciones
│   └── PwaRegister.js            # "Instalar App" SOLO en móvil (pointer coarse + <768px)
├── lib/
│   ├── supabase-server.js        # Cliente Supabase server-side (cookies)
│   ├── supabase-browser.js       # Cliente Supabase browser-side
│   ├── get-store.js              # getMyContext(): caché memoria + localStorage
│   ├── offline-queue.js           # Cola offline (outbox) en localStorage + eventos
│   ├── offline-sync.js            # Sincronizador FIFO idempotente (auto al volver red)
│   └── rate-limit.js             # Límite de tiendas/día
├── supabase/
│   ├── schema.sql                # Migración 1: 9 tablas + RLS (EJECUTAR PRIMERO)
│   ├── migration2-products.sql   # Migración 2: products
│   ├── migration5-fix-triggers.sql # Migración 5: triggers correctos (3,4 obsoletos)
│   └── migration6-expenses.sql   # Migración 6: categorías de gastos ampliadas + policy UPDATE
├── .github/workflows/ci.yml      # CI: build + secrets + deps en cada push
├── CONSTRAINTS.md                # CONTRATO DE CALIDAD (leer antes de codificar)
├── GUIA-USUARIO.pdf              # Guía del dueño de tienda (se genera con scripts/generar-guia-pdf.cjs)
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

**Regla de oro del multitenant:** TODA tabla transaccional tiene `store_id`. El RLS filtra por `current_store_id()`.

| Tabla | Para qué | Campos clave |
|---|---|---|
| `stores` | Tenant/tienda | id, name, slug, owner_email |
| `profiles` | Usuario ↔ tienda | id (=auth.users), store_id, role, display_name |
| `sales` | Ventas | store_id, user_id, total, items_count, channel (mostrador/tiktok_live), payment_method (efectivo/transferencia/fiado), client_name, notes |
| `expenses` | Gastos | concept, amount, category (luz/agua/internet/transporte/empaque/publicidad/telefono/salario/limpieza/mantenimiento/renta/proveedor/impuestos/otro) |
| `lots` | Stock interno por producto (INVISIBLE en UI) | code, name, pieces_total, pieces_left, total_cost, avg_sale_price |
| `products` | Productos (lo que ve la dueña) | code, name, sale_price, sold_count, lot_id |
| `clients` | Clientes | name, phone, tiktok, balance, is_live_client |
| `debts` | Fiados | client_id, original_amount, remaining, status, sale_id |
| `payments` | Abonos/pagos | debt_id?, sale_id?, amount, method |
| `cash_cuts` | Cortes diarios | sales_total, collected_total, expenses_total, notes |

**Claves de integridad de dinero (aprendidas de QA):**
- Los `payments` con `sale_id` son cobros de venta (no abonos de deuda): NO cuentan como "Abonos" ni salen como "Abono recibido" en Inicio
- Todo abono de deuda inserta `debt_id` (deuda más antigua del cliente, FIFO) — sin él el historial del cliente no lo encuentra
- El efectivo esperado del cierre = ventas efectivo + abonos en efectivo − gastos
- Sobrepago: se registra solo hasta el saldo; el excedente es vuelto (confirm() avisa antes)

## Flujos clave

### 1. Admin crea tienda
`/admin` (password) → POST /api/admin/stores → service_role crea: auth user → stores → profiles. El cliente entra en `/login` → aterriza en `/app/inicio`.

### 2. Venta fiado (Vender o Live)
Insert sales(payment_method='fiado') → buscar cliente exacto (case-insensitive, tolerante a duplicados) o crear → insert debts → update clients.balance. En Live: check de deuda existente por sale_id ANTES de fiar (anti doble-fiado).

### 3. Abono
Modal (Inicio o Clientes) → validaciones (monto>0, sobrepago pide confirm con vuelto) → insert payments CON debt_id FIFO → descuenta debts → update balance → UI en vivo (saldo + historial).

### 4. Corte de caja
Caja → arqueo: esperado = efectivo + abonos efectivo − gastos. Conteo por denominaciones (input o botones +/−). Insert cash_cuts. Botón bloqueado hasta mañana. Debajo: historial de cortes con filtro 7/15/30 días.

### 5. Modo offline (se cayó la luz/internet)
Toda escritura cliente-side revisa `isOffline()` (lib/offline-queue.js). Sin conexión: se guarda en la cola local (localStorage `pacapos_outbox`) con id uuid pre-generado y la UI se actualiza igual. Al volver la red, `lib/offline-sync.js` procesa la cola FIFO automáticamente (evento `online`, focus, o cada 60s). Cada operación es IDEMPOTENTE (insert con id local, verificación anti-doble-fiado, abonos con debt_id FIFO, recálculo de balance desde la BD) para que un reintento no duplique dinero. Funciona offline: venta contado/fiado (Vender), apartar/cobrar/fiar (Live), abonos (Inicio/Clientes), fiado directo, cliente nuevo, gastos, corte de caja, producto nuevo. Banner `components/OfflineBanner.js` muestra estado ("Sin internet · N cambios guardados" / "Sincronizando…"). El SW cachea páginas para que la app abra offline (network-first con fallback a caché).

## Reglas de UI

- **Paleta rosa**: primary `#E040A0`, texto `#19010C`, secundario `#952964`, superficies `#F7F4F5/#F7E9EC/#F6CCD9`
- **Moneda:** SIEMPRE `C$` + `toLocaleString('es-NI')` — función `money()` al inicio de cada componente
- Tipografías: Plus Jakarta Sans + Space Grotesk; iconos SVG inline de línea
- Responsive: sidebar ≥768px; nav inferior + drawer móvil
- Buscadores: normalización sin acentos (`norm()`), tolerante a espacios

## Convenciones CRÍTICAS

1. **TODO insert cliente-side** llama `getMyContext()` (caché localStorage) y manda `store_id` + `user_id` (clients/products: solo store_id)
2. **Operaciones con dinero offline**: SIEMPRE por la cola (`enqueueOp` con tipo de `offline-sync.js`), nunca inserts directos si `isOffline()`. Toda op nueva debe tener procesador idempotente.
3. **Nunca** expongas SERVICE_ROLE en el cliente; nunca `eval`/`innerHTML` con datos
3. **Encoding**: UTF-8 sin BOM — PowerShell `Set-Content` corrompe tildes; usar `[System.IO.File]::WriteAllText($p, $c, [Text.UTF8Encoding]::new($false))`
4. Reemplazos masivos con regex: cuidado con `' + '` (concatenación JS)
5. Server components consultan; client components interactúan; `force-dynamic` en protegidas
6. **Commits atómicos** (~100 líneas, qué+cómo) — ver CONSTRAINTS.md
7. El Service Worker cachea navegaciones: tras un deploy puede servir HTML viejo; el SW se auto-actualiza con nueva versión (bump de `CACHE` en sw.js — actual: `pacapos-v5`)

## Despliegue

### Local (puerto 3001)
```bash
npm install
npm run dev         # desarrollo
npm run build && npm run start   # producción local
```
**Red local:** `http://TU-IP:3001`. Firewall: permitir Node.js en Red privada.

### Vercel
```bash
vercel --prod
```
Variables en Dashboard: las 5 de `.env.local`. CI de GitHub corre build+audits en cada push.

### Migraciones Supabase (en orden)
1. `schema.sql` → 2. `migration2-products.sql` → 3. `migration5-fix-triggers.sql` → 4. `migration6-expenses.sql`
**Detener servidor local antes (deadlock).**

### Guía de usuario (PDF)
```bash
node scripts/generar-guia-pdf.cjs   # regenera GUIA-USUARIO.pdf (24 secciones)
```

## QA y verificación

- **Flujo de verificación estándar** (antes de cada deploy): login → venta contado (sin "abono fantasma") → fiado → abono (historial en vivo) → live con precio válido → cierre con abonos
- Herramienta de test navegador en `C:\Users\Hanzel\AppData\Local\Temp\opencode\navegar.cjs` (puppeteer-core + Edge headless, puerto CDP 9333) — maneja confirm() dialogs y desactiva el SW para datos frescos
- Credenciales de prueba: lucystore@gmail.com / 123456789 (tienda Lucy Store)

## Seguridad

- **CSP estricta** (`next.config.mjs`): connect-src solo `*.supabase.co`, object-src none, frame-ancestors none. Agregar un servicio externo = tocar la CSP a propósito
- **Gate de secretos**: `scripts/check-secrets.cjs` bloquea commits con JWT/postgres-passwords (hook pre-commit vía `npm run hooks:install` + CI). Regla: secreto filtrado = rotar en Supabase (borrar no basta)
- `.env.example` template; secretos solo en `.env.local` (gitignored, gitleaks en CI)
- Rate limiting: API admin 8 intentos/15min por IP (en memoria — capa extra, no única)
- `safeEqual` en comparación de contraseña admin (timing-safe)
- **Sanitización de input** (`lib/validation.js`): sanitizeString/isUuid/isEmail en TODO lo que llega al API antes de tocar la BD
- Aviso anti-ingeniería-social en consola (self-XSS) para usuarios no técnicos
- Headers: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP
- RLS en TODAS las tablas por `store_id` (aislamiento multitenant en la BD, no en el código)
- Excepción W1 documentada en CONSTRAINTS.md (sharp/postcss build-time de Next 15)

## Historial de fixes importantes (contexto de QA 2026-09-09/10)

**Bugs ALTOS corregidos:** fiado a cliente duplicado (error técnico), abonos fantasma (pagos de venta duplicados como abonos), doble fiado en Live, precio Live sin validación ("250,200" aceptado), sobrepago desaparecía sin aviso, historial de cliente vacío (abonos sin debt_id).

**MEDIOS:** arqueo sin abonos en efectivo, buscadores con acentos/espacios, método de pago en hoja de cliente, "Invertido" C$0 (ahora 4 métricas), advertencia de clientes duplicados.

**Features:** historial de movimientos en modal de abono (Inicio), stock "Quedan X" en Vender con bloqueo de sobreventa, sugerencias de clientes al fiar (búsqueda con dropdown máx 6 + "Ya existe"), "Instalar App" solo móvil, badge "Sin lote", contexto cacheado (localStorage) para velocidad, updates de stock en paralelo, exportar Excel con formato PacaPOS (exceljs lazy-chunk), edición de clientes/productos/apartados del Live, historial de cortes con filtro 7/15/30 días, arqueo con botones +/- clickeables, estadísticas sin repetir top en "menos vendidos", abonos en vivo en Inicio (folio correlativo sin recargar).

## Roadmap pendiente (sin catálogo — cancelado)

- [ ] Exportar Excel real .xlsx (hoy es CSV con BOM)
- [ ] Edición de stock (ajuste manual de piezas de un producto)
- [ ] Notificaciones push para cobros
- [ ] Reportes históricos por rango de fechas
- [ ] Upgrade a Next 16 (cierra vulnerabilidades build-time de sharp/postcss — ver W1 en CONSTRAINTS.md)
