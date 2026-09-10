-- =====================================================
-- PACAPOS · Migración 4: auto-relleno de user_id con trigger
-- Ejecutar en Supabase > SQL Editor
-- Arregla: "new row violates row-level security policy"
-- en sales/payments/expenses/lots: el RLS exige user_id = auth.uid()
-- pero el cliente no lo mandaba. El trigger lo rellena siempre.
-- =====================================================

create or replace function public.fill_store_and_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.store_id is null then
    new.store_id := (select store_id from public.profiles where id = auth.uid());
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

-- Reemplazar triggers previos por el completo (store_id + user_id)
drop trigger if exists trg_fill_clients on public.clients;
create trigger trg_fill_clients
  before insert on public.clients
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_sales on public.sales;
create trigger trg_fill_sales
  before insert on public.sales
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_expenses on public.expenses;
create trigger trg_fill_expenses
  before insert on public.expenses
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_payments on public.payments;
create trigger trg_fill_payments
  before insert on public.payments
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_lots on public.lots;
create trigger trg_fill_lots
  before insert on public.lots
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_products on public.products;
create trigger trg_fill_products
  before insert on public.products
  for each row execute function public.fill_store_and_user();

drop trigger if exists trg_fill_debts on public.debts;
create trigger trg_fill_debts
  before insert on public.debts
  for each row execute function public.fill_store_and_user();

-- Borrar la función anterior si ya nadie la usa
drop function if exists public.fill_store_id();
