-- =====================================================
-- MI PRENDA · Esquema Supabase multitenant con RLS
-- Ejecutar todo este archivo en: Supabase Dashboard > SQL Editor
-- =====================================================

-- 1) TABLAS -------------------------------------------------

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  total numeric(12,2) not null default 0,
  items_count int not null default 0,
  channel text not null default 'mostrador' check (channel in ('mostrador','tiktok_live','whatsapp')),
  payment_method text not null default 'efectivo' check (payment_method in ('efectivo','transferencia','fiado')),
  client_name text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  concept text not null,
  amount numeric(12,2) not null,
  category text not null default 'operativo' check (category in ('operativo','proveedor','renta','otro')),
  created_at timestamptz not null default now()
);

create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  code text not null,
  name text not null,
  pieces_total int not null default 0,
  pieces_left int not null default 0,
  total_cost numeric(12,2) not null default 0,
  avg_sale_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text,
  tiktok text,
  balance numeric(12,2) not null default 0,
  is_live_client boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  original_amount numeric(12,2) not null,
  remaining numeric(12,2) not null,
  description text,
  status text not null default 'pendiente' check (status in ('pendiente','saldada')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(12,2) not null,
  method text not null default 'efectivo' check (method in ('efectivo','transferencia')),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_cuts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  sales_total numeric(12,2) not null default 0,
  collected_total numeric(12,2) not null default 0,
  credit_total numeric(12,2) not null default 0,
  expenses_total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Índices por tienda (rendimiento multitenant)
create index if not exists idx_sales_store on public.sales(store_id, created_at desc);
create index if not exists idx_expenses_store on public.expenses(store_id, created_at desc);
create index if not exists idx_lots_store on public.lots(store_id);
create index if not exists idx_clients_store on public.clients(store_id);
create index if not exists idx_debts_store on public.debts(store_id, status);
create index if not exists idx_payments_store on public.payments(store_id, created_at desc);
create index if not exists idx_cuts_store on public.cash_cuts(store_id, created_at desc);
create index if not exists idx_profiles_store on public.profiles(store_id);

-- 2) FUNCIÓN AUXILIAR: tienda del usuario actual ------------
-- Devuelve el store_id del profile del usuario autenticado.

create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id from public.profiles p
  where p.id = auth.uid();
$$;

-- 3) RLS: ACTIVACIÓN ----------------------------------------

alter table public.stores      enable row level security;
alter table public.profiles    enable row level security;
alter table public.sales       enable row level security;
alter table public.expenses    enable row level security;
alter table public.lots        enable row level security;
alter table public.clients     enable row level security;
alter table public.debts       enable row level security;
alter table public.payments    enable row level security;
alter table public.cash_cuts   enable row level security;

-- 4) POLÍTICAS ----------------------------------------------
-- Regla de oro: TODO se filtra por tienda del usuario logueado.

-- profiles: cada usuario ve/su propio perfil
create policy "own profile select" on public.profiles
  for select using (id = auth.uid());
create policy "own profile insert" on public.profiles
  for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid());

-- stores: ver solo la propia (vía profile.store_id)
create policy "own store select" on public.stores
  for select using (
    id in (select store_id from public.profiles where id = auth.uid())
  );

-- sales
create policy "store sales select" on public.sales
  for select using (store_id = public.current_store_id());
create policy "store sales insert" on public.sales
  for insert with check (
    store_id = public.current_store_id() and user_id = auth.uid()
  );
create policy "store sales update" on public.sales
  for update using (store_id = public.current_store_id());
create policy "store sales delete" on public.sales
  for delete using (store_id = public.current_store_id() and user_id = auth.uid());

-- expenses
create policy "store expenses select" on public.expenses
  for select using (store_id = public.current_store_id());
create policy "store expenses insert" on public.expenses
  for insert with check (
    store_id = public.current_store_id() and user_id = auth.uid()
  );
create policy "store expenses delete" on public.expenses
  for delete using (store_id = public.current_store_id() and user_id = auth.uid());

-- lots
create policy "store lots select" on public.lots
  for select using (store_id = public.current_store_id());
create policy "store lots insert" on public.lots
  for insert with check (
    store_id = public.current_store_id() and user_id = auth.uid()
  );
create policy "store lots update" on public.lots
  for update using (store_id = public.current_store_id());
create policy "store lots delete" on public.lots
  for delete using (store_id = public.current_store_id() and user_id = auth.uid());

-- clients
create policy "store clients select" on public.clients
  for select using (store_id = public.current_store_id());
create policy "store clients insert" on public.clients
  for insert with check (store_id = public.current_store_id());
create policy "store clients update" on public.clients
  for update using (store_id = public.current_store_id());
create policy "store clients delete" on public.clients
  for delete using (store_id = public.current_store_id());

-- debts
create policy "store debts select" on public.debts
  for select using (store_id = public.current_store_id());
create policy "store debts insert" on public.debts
  for insert with check (store_id = public.current_store_id());
create policy "store debts update" on public.debts
  for update using (store_id = public.current_store_id());

-- payments
create policy "store payments select" on public.payments
  for select using (store_id = public.current_store_id());
create policy "store payments insert" on public.payments
  for insert with check (
    store_id = public.current_store_id() and user_id = auth.uid()
  );

-- cash_cuts
create policy "store cuts select" on public.cash_cuts
  for select using (store_id = public.current_store_id());
create policy "store cuts insert" on public.cash_cuts
  for insert with check (
    store_id = public.current_store_id() and user_id = auth.uid()
  );
