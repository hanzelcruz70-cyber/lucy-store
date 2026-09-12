-- =====================================================
-- MI PRENDA · Migración 5: CORRECCIÓN de triggers
-- Arregla: "record new has no field user_id"
-- Causa: clients y products NO tienen columna user_id,
-- pero el trigger de la migración 4 intentaba rellenarla.
-- Solución: triggers separados por tipo de tabla.
-- Además: agrega sale_id a debts para ligar fiados de Live.
-- =====================================================

-- 1) Función SOLO tienda (para tablas sin user_id: clients, products)
create or replace function public.fill_store_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.store_id is null then
    new.store_id := (select store_id from public.profiles where id = auth.uid());
  end if;
  return new;
end;
$$;

-- 2) Reemplazar triggers de clients y products por el seguro
drop trigger if exists trg_fill_clients on public.clients;
create trigger trg_fill_clients
  before insert on public.clients
  for each row execute function public.fill_store_only();

drop trigger if exists trg_fill_products on public.products;
create trigger trg_fill_products
  before insert on public.products
  for each row execute function public.fill_store_only();

-- 3) Ligar deudas con la venta que la originó (fiados de Live)
alter table public.debts
  add column if not exists sale_id uuid references public.sales(id) on delete set null;
