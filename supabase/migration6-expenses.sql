-- =====================================================
-- MIGRACIÓN 6 · Categorías de gastos ampliadas
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Detener el servidor local antes (deadlock).
-- =====================================================

-- 1) Reclasificar categorías viejas PRIMERO (el constraint
--    nuevo no permite 'operativo', hay que mudarlas antes).
update public.expenses
  set category = 'otro'
  where category not in (
    'luz', 'agua', 'internet', 'transporte', 'empaque',
    'publicidad', 'limpieza', 'mantenimiento', 'telefono',
    'salario', 'renta', 'proveedor', 'impuestos', 'otro'
  );

-- 2) Ampliar las categorías de gastos de la tienda de ropa:
--    luz, agua, internet/wifi, transporte, empaque/bolsas,
--    publicidad (incluye lives), limpieza, mantenimiento,
--    teléfono, salario/ayuda, renta, proveedor, impuestos, otro.
alter table public.expenses
  drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'luz', 'agua', 'internet', 'transporte', 'empaque',
    'publicidad', 'limpieza', 'mantenimiento', 'telefono',
    'salario', 'renta', 'proveedor', 'impuestos', 'otro'
  ));

-- 3) Policy UPDATE para gastos (editar concepto/monto/categoría)
drop policy if exists "store expenses update" on public.expenses;
create policy "store expenses update" on public.expenses
  for update using (
    store_id = public.current_store_id() and user_id = auth.uid()
  );
