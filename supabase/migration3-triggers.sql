-- =====================================================
-- MI PRENDA · Migración 3: auto-relleno de store_id con trigger
-- Ejecutar en Supabase > SQL Editor
-- Arregla: "new row violates row-level security policy"
-- Motivo: el cliente no mandaba store_id y RLS lo exige.
-- Solución: trigger que lo rellena automáticamente antes de validar RLS.
-- =====================================================

-- 1) Función que rellena store_id con la tienda del usuario autenticado
create or replace function public.fill_store_id()
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

-- 2) Trigger ANTES del check de RLS en cada tabla transaccional
drop trigger if exists trg_fill_clients on public.clients;
create trigger trg_fill_clients
  before insert on public.clients
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_sales on public.sales;
create trigger trg_fill_sales
  before insert on public.sales
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_expenses on public.expenses;
create trigger trg_fill_expenses
  before insert on public.expenses
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_payments on public.payments;
create trigger trg_fill_payments
  before insert on public.payments
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_lots on public.lots;
create trigger trg_fill_lots
  before insert on public.lots
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_products on public.products;
create trigger trg_fill_products
  before insert on public.products
  for each row execute function public.fill_store_id();

drop trigger if exists trg_fill_debts on public.debts;
create trigger trg_fill_debts
  before insert on public.debts
  for each row execute function public.fill_store_id();

-- 3) Igualar checks de RLS (aceptar el valor rellenado por trigger)
--    Las policies de insert usan current_store_id() que ya funciona con el trigger.

-- 4) Función register_product_sale mejorada (valida que pertenezca a la tienda)
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
