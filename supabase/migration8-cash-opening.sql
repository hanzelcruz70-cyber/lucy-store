-- =====================================================
-- MI PRENDA · Migración 8: Caja inicial del día
-- La dueña registra con cuánto dinero abre el día (fondo de
-- caja). Ese monto se suma al "efectivo esperado en cajón"
-- del arqueo y queda en el historial para auditoría.
-- =====================================================

create table if not exists public.cash_openings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day date not null,                      -- día de negocio (Nicaragua UTC-6)
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (store_id, day)                  -- un fondo por tienda por día
);

create index if not exists idx_cash_openings_store
  on public.cash_openings(store_id, day desc);

alter table public.cash_openings enable row level security;

create policy "own cash openings select" on public.cash_openings
  for select using (store_id = public.current_store_id());
create policy "own cash openings insert" on public.cash_openings
  for insert with check (store_id = public.current_store_id() and user_id = auth.uid());
create policy "own cash openings update" on public.cash_openings
  for update using (store_id = public.current_store_id() and user_id = auth.uid());

-- El corte de caja registra el fondo con el que se abrió el día
alter table public.cash_cuts
  add column if not exists opening_total numeric(12,2) not null default 0;
