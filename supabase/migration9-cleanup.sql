-- =====================================================
-- MI PRENDA · Migración 9: Limpieza de datos antiguos
-- Borra registros con más de 30 días que ya no se ven en
-- la app (Live, historial de clientes):
--   - sales de Live (tiktok_live) viejas SIN crédito pendiente
--   - deudas SALDADAS viejas (créditos pendientes JAMÁS se borran)
--   - abonos (payments) viejos ligados a deudas saldadas/borradas
--   - apartados de mostrador viejos sin deuda (fiado directo borrado)
--
-- SE EJECUTA SOLA: función + trigger programado (pg_cron de Supabase
-- la corre cada día a las 3 AM hora Nicaragua). También puede
-- llamarse manual: select public.limpiar_datos_antiguos();
-- =====================================================

create or replace function public.limpiar_datos_antiguos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite timestamptz := now() - interval '30 days';
  v_borrados int := 0;
begin
  -- 1) Abonos viejos (payments sin sale_id = abonos de deuda) de deudas saldadas viejas
  delete from public.payments p
   where p.sale_id is null
     and p.created_at < v_limite
     and (p.debt_id is null or not exists (
       select 1 from public.debts d
        where d.id = p.debt_id and d.status = 'pendiente'
     ));
  v_borrados := v_borrados + 1;

  -- 2) Deudas SALDADAS viejas (los créditos PENDIENTES jamás se tocan)
  delete from public.debts d
   where d.status = 'saldada'
     and d.created_at < v_limite;

  -- 3) Cobros de venta viejos (payments con sale_id de ventas contado/transferencia)
  delete from public.payments p
   where p.sale_id is not null
     and p.created_at < v_limite
     and not exists (
       select 1 from public.debts d where d.sale_id = p.sale_id
     );

  -- 4) Ventas de Live viejas sin crédito pendiente
  delete from public.sales s
   where s.channel = 'tiktok_live'
     and s.created_at < v_limite
     and not exists (
       select 1 from public.debts d where d.sale_id = s.id and d.status = 'pendiente'
     );

  -- 5) Fiados directos de mostrador viejos y saldados (venta + deuda ya borrada)
  delete from public.sales s
   where s.channel = 'mostrador'
     and s.payment_method = 'fiado'
     and s.created_at < v_limite
     and not exists (
       select 1 from public.debts d where d.sale_id = s.id
     );

  return v_borrados;
end;
$$;

grant execute on function public.limpiar_datos_antiguos() to authenticated;

-- Programar limpieza diaria (3 AM UTC-6 = 9 AM UTC) si pg_cron está activo.
-- Si no lo está, la app puede llamar la función manual desde SQL Editor.
select cron.schedule(
  'miprenda-limpieza-diaria',
  '0 9 * * *',
  $$select public.limpiar_datos_antiguos();$$
);
