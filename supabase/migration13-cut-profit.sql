-- =====================================================
-- MIGRACIÓN 13 · Ganancia del día dentro del corte de caja
-- Fecha: 2026-09-17
--
-- cash_cuts.profit_total: la ganancia REAL del día (vendido − costo de
-- prendas, rebajas ya restadas, migración 12) guardada AL CERRAR la caja.
-- Así el historial de cortes la muestra sin recalcular nada.
--
-- NULL en cortes viejos (anteriores a esta migración) → la UI simplemente
-- no muestra la línea en esos cortes. Puede ser NEGATIVA en un día malo
-- (por eso NO lleva check >= 0).
--
-- EJECUTAR EN: Supabase Dashboard > SQL Editor. Sin ella, el cierre de
-- caja del código nuevo fallaría al insertar profit_total.
-- =====================================================

alter table public.cash_cuts
  add column if not exists profit_total numeric(12,2);
