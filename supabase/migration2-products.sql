-- =====================================================
-- PACAPOS · Migración 2: estadísticas de productos
-- Ejecutar en Supabase > SQL Editor (además del schema.sql original)
-- =====================================================

-- Productos individuales (ligados a un lote o sueltos)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  code text not null,
  name text not null,
  sale_price numeric(12,2) not null default 0,
  sold_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_store on public.products(store_id);
create index if not exists idx_products_lot on public.products(lot_id);

-- RLS products
alter table public.products enable row level security;

create policy "store products select" on public.products
  for select using (store_id = public.current_store_id());
create policy "store products insert" on public.products
  for insert with check (store_id = public.current_store_id());
create policy "store products update" on public.products
  for update using (store_id = public.current_store_id());
create policy "store products delete" on public.products
  for delete using (store_id = public.current_store_id());

-- Agregar notas de producto a ventas existentes (si no existen)
-- (usamos notes que ya existe en sales para descripción del producto)

-- Función auxiliar: registrar venta de producto (actualiza contadores)
create or replace function public.register_product_sale(
  p_product_id uuid,
  p_qty int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set sold_count = sold_count + p_qty
   where id = p_product_id
     and store_id = public.current_store_id();
end;
$$;
