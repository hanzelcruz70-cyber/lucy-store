# Mi Prenda · Documentación del Proyecto

> **Guía para IAs y desarrolladores.** Todo lo necesario para entender, modificar y desplegar este proyecto sin contexto previo.
> **ANTES DE ESCRIBIR CÓDIGO: leer `CONSTRAINTS.md`.** Ese archivo es el contrato de calidad y no se debilita para que un cambio pase.

## Qué es

Mi Prenda es un **Punto de Venta (POS) multitenant en modo PWA** para tiendas de ropa (paca/americana) que venden por mostrador y por **Lives de TikTok**, con gestión de **créditos (fiados)**, inventario de productos con stock, gastos y estadísticas. Moneda: **Córdobas (C$)** — Nicaragua.

**TERMINOLOGÍA (2026-09-13):** en la UI, PDF, Excel y marketing la palabra es **"crédito"** — NO "fiado". Los valores internos de BD (`payment_method='fiado'`, tipos de cola `live_fiado`, `fiado_directo`) y los nombres de función RPC/JS NO se renombraron (romperían RLS/sync/migraciones históricas). Regla: texto visible = "crédito"; código/BD = "fiado".

**Marca/Nombre:** Mi Prenda (antes Mi Prenda, renombrado 2026-09-11) — app multitenant: cada tienda es un cliente; nunca nombrar con el nombre de UNA tienda (Lucy Store fue el primero, el nombre del repo es histórico)

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
| Repo | github.com/hanzelcruz70-cyber/lucy-store (privado, nombre histórico) | — |
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
│   ├── rpc-helpers.js            # Puente a los RPCs transaccionales de dinero
│   ├── offline-queue.js           # Cola offline (outbox) en localStorage + eventos
│   ├── offline-sync.js            # Sincronizador FIFO idempotente vía RPCs (auto al volver red)
│   └── rate-limit.js             # Límite de tiendas/día
├── supabase/
│   ├── schema.sql                # Migración 1: 9 tablas + RLS (EJECUTAR PRIMERO)
│   ├── migration2-products.sql   # Migración 2: products
│   ├── migration5-fix-triggers.sql # Migración 5: triggers correctos (3,4 obsoletos)
│   ├── migration6-expenses.sql   # Migración 6: categorías de gastos ampliadas + policy UPDATE
│   ├── migration7-audit.sql       # Migración 7: RPCs transaccionales + UNIQUE clientes + cash_cuts numérico
│   ├── migration8-cash-opening.sql # Migración 8: caja inicial del día (cash_openings + opening_total en cash_cuts)
│   └── migration10-audit-fixes.sql # Migración 10: auditoría 2026-09-13 (tenant-checks, stock en la transacción, acentos, cortes únicos)
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
| `cash_cuts` | Cortes diarios | sales_total, collected_total (efectivo ventas + abonos), abonos_total, transfer_total, fisico_total, discrepancy_amount, expenses_total, notes |

**Claves de integridad de dinero (aprendidas de QA):**
- Los `payments` con `sale_id` son cobros de venta (no abonos de deuda): NO cuentan como "Abonos" ni salen como "Abono recibido" en Inicio
- Todo abono de deuda inserta `debt_id` (deuda más antigua del cliente, FIFO) — sin él el historial del cliente no lo encuentra
- El efectivo esperado del cierre = ventas efectivo + abonos en efectivo − gastos
- Sobrepago: se registra solo hasta el saldo; el excedente es vuelto (confirm() avisa antes)

**Integridad transaccional (auditoría 2026-09-13, migraciones 7 y 10):**
- TODA operación de dinero pasa por RPCs transaccionales (`supabase/migration7-audit.sql`, `migration10-audit-fixes.sql`) vía `lib/rpc-helpers.js`: `registrar_venta` (venta+payment+deuda+STOCK en una sola transacción: recibe `p_items jsonb` y descuenta contador de vendidos y stock del lote dentro), `aplicar_abono` (FIFO con `FOR UPDATE`), `fiar_venta` (Live, anti doble-fiado, solo de mi tienda), `cobrar_venta` (Live, idempotente por venta: un solo cobro por `sale_id`), `registrar_producto` (lote+producto, códigos por contador `store_counters`)
- REBAJAS (migración 11, 2026-09-17): `sales.discount` guarda la rebaja manual y `sales.total` SIGUE siendo la plata REAL cobrada/fiada (original = total + discount). `registrar_venta`, `cobrar_venta` y `fiar_venta` aceptan `p_discount`; en Live el cobrar/fiar comparten el mismo modal. ATENCIÓN PostgREST: las firmas viejas de estos RPCs se DROPEAN en la migración — dejar ambas versiones rompe las llamadas con error 300 (overloading ambiguo).
- TODAS las funciones security definer (stock incluido) verifican que la fila pertenezca a la tienda del que llama (`current_store_id_strict()`): nadie toca lotes/productos/deudas ajenos aunque conozca el uuid (migración 10)
- Toda operación offline conserva su FECHA ORIGINAL: los RPCs aceptan `p_created_at` (migración 10) y la cola offline (`lib/offline-queue.js`) manda la fecha con la que se vendió/abonó/cerró, no la del sync
- Cobrar/fiar un apartado de Live usa UN modal unificado con método (efectivo/transferencia/crédito) + rebaja: la transferencia NO entra al esperado del cajón (arqueo correcto) y el crédito nace por el monto final
- El borrador del apartado rápido de Live (cliente/prenda/precio) persiste en localStorage (`live_draft_v1`): cambiar de sección o cerrar la PWA NO lo borra; se limpia solo al apartar la prenda (2026-09-17)
- Cobro de apartado de un día ANTERIOR: el efectivo de hoy SÍ lo cuenta (payment de hoy + `sale_id` del apartado viejo) — antes era invisible
- `clients` tiene UNIQUE por nombre SIN ACENTOS (`norm_name`): "dona lupe" = "Doña Lupe" — no hay duplicados por tildes (migración 10)
- `cash_cuts` tiene UNIQUE(store_id, nic_day(created_at)): una tienda solo puede hacer UN corte por día de negocio Nicaragua (migración 10)
- clientes/borrado de apartado live: apartado PENDIENTE se borra; fiado o cobrado ya no se borran (FK `ON DELETE SET NULL` en la BD los protege)
- El stock se muta SOLO dentro del RPC (migración 10), nunca desde el cliente — un fallo de red no deja venta sin descuento ni descuento sin venta

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
Toda escritura cliente-side revisa `isOffline()` (lib/offline-queue.js). Sin conexión: se guarda en la cola local (localStorage `miprenda_outbox`) con id uuid pre-generado y **la fecha original del negocio** (`createdAt`), y la UI se actualiza igual. Al volver la red, `lib/offline-sync.js` procesa la cola FIFO automáticamente (evento `online`, focus, o cada 60s) y dispara `miprenda:synced` + `router.refresh()` para que las server-components muestren las cifras frescas. Cada operación es IDEMPOTENTE (insert con id local, RPC con guardia por `payment_id`/`sale_id`, corte por día NI, recálculo de balance desde la BD) para que un reintento no duplique dinero. Funciona offline: venta contado/fiado, apartar/cobrar/fiar, abonos, crédito directo, cliente nuevo/editar/borrar, gastos (+editar/borrar), corte de caja, y **caja inicial**. Banner `components/OfflineBanner.js` muestra estado ("Sin internet · N cambios guardados" / "Sincronizando…"). El SW cachea páginas para que la app abra offline (network-first con fallback a caché).

## Reglas de UI

- **Paleta rosa**: primary `#E040A0`, texto `#19010C`, secundario `#952964`, superficies `#F7F4F5/#F7E9EC/#F6CCD9`
- **Moneda:** SIEMPRE `C$` + `toLocaleString('es-NI')` — función `money()` al inicio de cada componente. Montos destacados usan `inline-flex items-center leading-none` (C$ alineado con los dígitos)
- **Parseo de montos escritos a mano:** NUNCA `parseFloat` directo en inputs de dinero (en Nicaragua "1,500" con coma); usar `parseMonto` de `lib/validation.js` (acepta "1.500,50", "1,500.50" o "1500"). Inputs de dinero con `inputMode="decimal"` y `text-[16px]` (evita el zoom de iOS)
- **Listas largas (>5 filas):** contenedor con `overflow-y-auto scroll-box` + `maxHeight` de 5 filas — la página no crece infinitamente (Clientes, CutsHistory, historiales de Live/Clientes; Inventario ya lo tenía)
- **Diálogos:** NUNCA `window.confirm/alert` (congelan Android/PWA). Usar `appConfirm()/appAlert()` de `components/ConfirmDialog.js`
- **Scroll:** `overscroll-behavior: auto` en `.scroll-box` (el scroll se derrama; con `contain` la página quedaba congelada)
- **Móvil primero:** botones de acción con mínimo `w-11 h-11` (44px, táctil real); iconos de borrar/editar idem
- **Nav inferior móvil** (AppShell): Inicio, Vender, Live y Caja a un toque en celular; drawer móvil y sidebar (md+) con las 7 rutas
- Tipografías: Plus Jakarta Sans + Space Grotesk; iconos SVG inline de línea
- Buscadores: normalización sin acentos (`norm()`) PERO al GUARDAR clients el servidor usa `norm_name()` de la BD (migración 10): el cliente existente se encuentra sin importar tildes ("dona lupe" encuentra "Doña Lupe")

## Convenciones CRÍTICAS

1. **TODO insert cliente-side** llama `getMyContext()` (caché localStorage) y manda `store_id` + `user_id` (clients/products: solo store_id)
2. **Operaciones con dinero offline**: SIEMPRE por la cola (`enqueueOp` con tipo de `offline-sync.js`), nunca inserts directos si `isOffline()`. Toda op nueva debe tener procesador idempotente.
3. **Nunca** expongas SERVICE_ROLE en el cliente; nunca `eval`/`innerHTML` con datos
3. **Encoding**: UTF-8 sin BOM — PowerShell `Set-Content` corrompe tildes; usar `[System.IO.File]::WriteAllText($p, $c, [Text.UTF8Encoding]::new($false))`
4. Reemplazos masivos con regex: cuidado con `' + '` (concatenación JS)
5. Server components consultan; client components interactúan; `force-dynamic` en protegidas
6. **Commits atómicos** (~100 líneas, qué+cómo) — ver CONSTRAINTS.md
7. El Service Worker cachea navegaciones: tras un deploy puede servir HTML viejo; el SW se auto-actualiza con nueva versión (bump de `CACHE` en sw.js — actual: `miprenda-v5`)

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
1. `schema.sql` → 2. `migration2-products.sql` → 3. `migration5-fix-triggers.sql` → 4. `migration6-expenses.sql` → 5. `migration7-subscription.sql` → 6. `migration7-audit.sql` → 7. `migration8-cash-opening.sql` → 8. `migration9-cleanup.sql` → 9. `migration10-audit-fixes.sql`
**Detener servidor local antes (deadlock).** Las migraciones 7-audit, 8 y 9 son idempotentes (re-ejecutables); la 7-audit fusiona clientes duplicados automáticamente. La 9 programa limpieza diaria (pg_cron) de datos >30 días: apartados de Live, deudas SALDADAS y abonos viejos — los créditos PENDIENTES jamás se borran.

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

## Historial de fixes importantes (contexto de QA 2026-09-09/10 + auditoría 2026-09-13)

**Auditoría completa 2026-09-13 (~30 fixes, migración 10):** seg.: los 5 RPCs definer (decrement_stock, increment_sold, aplicar_abono, fiar_venta, cobrar_venta) verifican tenant; contables: `registrar_venta(p_items)` (venta+payment+deuda+stock en UNA tx, ids resueltos en BD), abono offline en ClientsList ya no rompe (`aplicado`→`montoReal`), inputs de dinero con parseMonto ("1,500"), clientes sin duplicados por acentos (`norm_name`), cobro de Live pregunta método (efectivo/transf), cobro de apartado viejo SÍ cuenta en el día, cortes únicos por tienda/día, cortes offline conservan fecha original, corte de cash_cuts re-ejecutable idempotente, `stores_created_today()` límite real BD, `dailyCutButton` (código muerto) borrado, nav inferior móvil, `getUser` en middleware, logout limpia cola+caché, SW sin `client.navigate()`, post-sync refresca pantallas.

**Bugs ALTOS corregidos (QA 2026-09-09/10):** fiado a cliente duplicado (error técnico), abonos fantasma (pagos de venta duplicados como abonos), doble fiado en Live, precio Live sin validación ("250,200" aceptado), sobrepago desaparecía sin aviso, historial de cliente vacío (abonos sin debt_id).

**MEDIOS:** arqueo sin abonos en efectivo, buscadores con acentos/espacios, método de pago en hoja de cliente, "Invertido" C$0 (ahora 4 métricas), advertencia de clientes duplicados.

**Features:** historial de movimientos en modal de abono (Inicio), stock "Quedan X" en Vender con bloqueo de sobreventa, sugerencias de clientes al fiar (búsqueda con dropdown máx 6 + "Ya existe"), "Instalar App" solo móvil, badge "Sin lote", contexto cacheado (localStorage) para velocidad, updates de stock en paralelo, exportar Excel con formato Mi Prenda (exceljs lazy-chunk), edición de clientes/productos/apartados del Live, historial de cortes con filtro 7/15/30 días, arqueo con botones +/- clickeables, estadísticas sin repetir top en "menos vendidos", abonos en vivo en Inicio (folio correlativo sin recargar).

## Roadmap pendiente (sin catálogo — cancelado)

- [ ] Reportes históricos por rango de fechas
- [ ] Edición de stock (ajuste manual de piezas de un producto)
- [ ] Notificaciones push para cobros
- [ ] Ventas con pago mixto (parte efectivo, parte transferencia) y devoluciones
- [ ] Upgrade a Next 16 (cierra vulnerabilidades build-time de sharp/postcss — ver W1 en CONSTRAINTS.md)
