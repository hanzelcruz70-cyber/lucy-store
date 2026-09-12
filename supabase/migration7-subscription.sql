-- =====================================================
-- MI PRENDA · Migración 7: SUSCRIPCIÓN MENSUAL (31 días)
-- Bloquea la tienda cuando vence el pago. El panel admin
-- activa/desactiva cuentas y registra cada pago.
--
-- DEFENSA CENTRAL: current_store_id() devuelve NULL si la
-- tienda está bloqueada → TODAS las policies RLS fallan →
-- el usuario logueado no puede leer NI escribir nada,
-- aunque manipule el navegador o reintente la cola offline.
-- =====================================================

-- 1) Columnas de suscripción en stores
alter table public.stores
  add column if not exists active boolean not null default true,
  add column if not exists paid_until timestamptz,
  add column if not exists blocked_reason text;

-- 2) Historial de pagos de suscripción
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  paid_until timestamptz not null,          -- fecha hasta la que cubre este pago
  amount numeric(12,2) not null default 0,
  method text not null default 'efectivo' check (method in ('efectivo','transferencia','otro')),
  created_at timestamptz not null default now()
);

create index if not exists idx_subpay_store on public.subscription_payments(store_id, created_at desc);

-- 3) current_store_id() con bloqueo por suscripción
-- Devuelve NULL si: no hay perfil, tienda inactiva (admin la apagó)
-- o paid_until venció. NULL en RLS = cero acceso a datos.
create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id from public.profiles p
  join public.stores s on s.id = p.store_id
  where p.id = auth.uid()
    and s.active = true
    and (s.paid_until is null or s.paid_until > now());
$$;

-- RLS en el historial: la tienda solo ve sus propios pagos de suscripción
alter table public.subscription_payments enable row level security;
create policy "own subscription payments select"
  on public.subscription_payments
  for select using (store_id = public.current_store_id());

-- 4) Vistas/comprobaciones SIN eliminar: preserva la nueva firma
--    (las policies antiguas llaman a la misma función; no hay que
--    recrearlas porque current_store_id() ya filtra internamente).
