-- =====================================================
-- MI PRENDA · Migración 10: Auditoría 2026-09-13 (contabilidad + seguridad)
-- Arregla (hallazgos de la auditoría completa PC/móvil):
--   A1) RPCs security definer sin check de tenant → todos validan
--       store_id = current_store_id_strict() (aislamiento cross-tenant)
--   A2) Venta mostrador no transaccional con stock (21 round-trips) →
--       registrar_venta(p_items) hace venta+payment+deuda+stock en UNA transacción
--   A3) Operaciones offline con fecha del SYNC → p_created_at en RPCs,
--       la fecha original del negocio se conserva
--   A4) cobrar_venta permitía pagos duplicados del mismo apartado →
--       UNIQUE(sale_id) en payments + verificación de venta pendiente
--   A5) Clientes duplicados por acentos ("dona lupe" vs "Doña Lupe") →
--       índice UNIQUE con normalización de acentos (sin extensión unaccent)
--   A6) Cortes duplicados en línea (PC + celular) →
--       UNIQUE(store_id, día de negocio Nicaragua)
--   A7) fiar_venta/cobrar_venta no verificaban venta ajena ni pendiente
--   A8) Límite de tiendas/día en BD (el de memoria no existía)
--
-- EJECUTAR EN: Supabase Dashboard > SQL Editor (con el servidor local DETENIDO)
-- Idempotente: puede re-ejecutarse sin romper nada.
-- REQUIERE: migraciones 1-9 ejecutadas antes.
-- =====================================================

-- ----------------------------------------------------
-- 0) DROP previos: Postgres NO permite cambiar el tipo de retorno con
--    CREATE OR REPLACE (cobrar_venta pasa de void a json), y agregar
--    parámetros crearía una SOBRECARGA (dos versiones a la vez: la vieja
--    de migración 7 sin p_items/p_created_at + la nueva = ambigüedad en
--    PostgREST). Se borran las firmas viejas y se recrean abajo.
-- ----------------------------------------------------
drop function if exists public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid);
drop function if exists public.aplicar_abono(uuid, uuid, numeric, text);
drop function if exists public.cobrar_venta(uuid, uuid, numeric, text);

-- ----------------------------------------------------
-- A1+A7) RPCs de dinero: verificación de TENANT en cada tabla tocada
-- ----------------------------------------------------
-- Nota: los clientes duplicados por acentos ya existentes se fusionan abajo (A5),
-- por eso la deduplicación va ANTES de redefinir los RPCs que emparejan por nombre.

-- ----------------------------------------------------
-- A5) Clientes: normalizar acentos para unicidad
-- ----------------------------------------------------
-- Sin extensión unaccent (no siempre disponible): translate() manual cubre
-- los caracteres del español usados en nombres de clientes de Nicaragua.
create or replace function public.norm_name(p text)
returns text
language sql
immutable
as $$
  select lower(btrim(
    translate(
      coalesce(p, ''),
      'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
      'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnncc'
    )
  ));
$$;

-- Fusiona duplicados por nombre NORMALIZADO (acentos/case/espacios).
-- Conserva el más antiguo (mismo criterio que migración 7), mueve deudas,
-- recalcula balances.
do $$
declare
  dup record;
  keep record;
  v_bal numeric(12,2);
begin
  for dup in
    select c2.id as dup_id, c2.store_id, public.norm_name(c2.name) as nname
    from public.clients c2
    join public.clients c1
      on c1.store_id = c2.store_id
     and public.norm_name(c1.name) = public.norm_name(c2.name)
     and c1.created_at < c2.created_at
  loop
    select c.* into keep
    from public.clients c
    where c.store_id = dup.store_id and public.norm_name(c.name) = dup.nname
    order by c.created_at asc
    limit 1;

    if keep.id is not null and keep.id <> dup.dup_id then
      -- mover deudas del duplicado al conservado (payments.debt_id sigue
      -- apuntando a la misma deuda: su id no cambia, solo client_id)
      update public.debts set client_id = keep.id where client_id = dup.dup_id;
      delete from public.clients where id = dup.dup_id;
    end if;
  end loop;

  for keep in select distinct client_id from public.debts loop
    select coalesce(sum(remaining), 0) into v_bal
    from public.debts
    where client_id = keep.client_id and status = 'pendiente';
    update public.clients set balance = v_bal where id = keep.client_id;
  end loop;
end;
$$;

-- Trigger de normalización de espacios + acentos al insertar/actualizar
create or replace function public.trim_client_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if new.name = '' then
    raise exception 'El nombre del cliente no puede quedar vacio';
  end if;
  return new;
end;
$$;

-- Índice único por nombre normalizado (reemplaza al de migración 7, acento-sensible)
drop index if exists idx_clients_unique_name;
create unique index idx_clients_unique_name
  on public.clients (store_id, public.norm_name(name));

-- Búsqueda idempotente: empareja por nombre normalizado (para RPCs y sugerencias)
create or replace function public.find_client_id(p_store uuid, p_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.clients c
   where c.store_id = p_store
     and public.norm_name(c.name) = public.norm_name(p_name)
   order by c.created_at asc
   limit 1;
$$;

-- ----------------------------------------------------
-- A1) decrement_stock / increment_sold: solo lotes/productos de MI tienda
-- ----------------------------------------------------
create or replace function public.decrement_stock(
  p_lot_id uuid,
  p_qty int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida: %', p_qty;
  end if;

  update public.lots
     set pieces_left = pieces_left - p_qty
   where id = p_lot_id
     and store_id = v_store
     and pieces_left - p_qty >= 0; -- nunca negativo

  if not found then
    raise exception 'Stock insuficiente o lote ajeno % (pedian %)', p_lot_id, p_qty;
  end if;
end;
$$;

create or replace function public.increment_sold(
  p_product_id uuid,
  p_qty int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida: %', p_qty;
  end if;

  update public.products
     set sold_count = sold_count + p_qty
   where id = p_product_id
     and store_id = v_store;

  if not found then
    raise exception 'Producto ajeno o inexistente: %', p_product_id;
  end if;
end;
$$;

-- ----------------------------------------------------
-- A2+A3) registrar_venta: transaccional TOTAL (venta+payment/deuda+stock)
--        + fecha original del negocio (p_created_at)
--        + emparejamiento de clientes sin acentos (A5)
-- ----------------------------------------------------
create or replace function public.registrar_venta(
  p_sale_id uuid,
  p_total numeric,
  p_items_count int,
  p_channel text,
  p_payment_method text,
  p_client_name text,
  p_notes text,
  p_payment_id uuid default null,
  p_items jsonb default null,          -- [{productId, lotId, qty}]
  p_created_at timestamptz default null -- fecha original del negocio (modo offline)
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
  v_client_id uuid;
  v_debt_id uuid;
  v_created timestamptz := coalesce(p_created_at, now());
  v_new boolean := true;
  it record;
begin
  -- Montos válidos
  if p_total is null or p_total <= 0 then
    raise exception 'Total invalido: %', p_total;
  end if;

  -- Venta idempotente por id local. v_new dice si ESTA llamada creó la
  -- fila (reintento = false): los efectos (payment/deuda/stock) SOLO se
  -- aplican cuando la venta es nueva — así un reintento jamás repite nada.
  -- FIX QA 2026-09-14 (D-1/D-2/D-3): FOUND es TRUE cuando el INSERT creó
  -- la fila; con ON CONFLICT DO NOTHING un conflicto deja FOUND=FALSE.
  -- La asignación estaba invertida: las ventas NUEVAS salían como
  -- "alreadyProcessed" sin deuda, sin pago y sin stock.
  insert into public.sales (id, total, items_count, channel, payment_method, client_name, notes, store_id, user_id, created_at)
  values (p_sale_id, p_total, p_items_count, p_channel, p_payment_method, p_client_name, p_notes, v_store, v_user, v_created)
  on conflict (id) do nothing;
  v_new := found;

  -- Stock y contadores DENTRO de la transacción y ANTES de cualquier
  -- return (A2, fix QA 2026-09-14): un fiado con items descuenta stock
  -- igual que el contado — antes el return temprano del path fiado se
  -- lo saltaba y "Quedan N" mentía en el servidor.
  -- jsonb_array_elements expone la fila en la columna "value" (el alias
  -- tras AS es de tabla, no de campo: it.x no existe → error 42703).
  if p_items is not null and v_new then
    for it in select value from jsonb_array_elements(p_items)
    loop
      if it.value ->> 'productId' is not null then
        update public.products
           set sold_count = sold_count + coalesce((it.value ->> 'qty')::int, 1)
         where id = (it.value ->> 'productId')::uuid
           and store_id = v_store;
        if not found then
          raise exception 'Producto ajeno o inexistente en el carrito';
        end if;
      end if;
      if it.value ->> 'lotId' is not null then
        update public.lots
           set pieces_left = pieces_left - coalesce((it.value ->> 'qty')::int, 1)
         where id = (it.value ->> 'lotId')::uuid
           and store_id = v_store
           and pieces_left - coalesce((it.value ->> 'qty')::int, 1) >= 0;
        if not found then
          raise exception 'Stock insuficiente en el lote %', it.value ->> 'lotId';
        end if;
      end if;
    end loop;
  end if;

  if not v_new then
    -- Reintento idempotente: la venta ya existía (con su stock ya aplicado)
    return json_build_object('saleId', p_sale_id, 'alreadyProcessed', true);
  end if;

  if p_payment_method = 'fiado' then
    if p_client_name is null or btrim(p_client_name) = '' then
      raise exception 'Fiado sin nombre de cliente';
    end if;

    -- (#3) Guardia anti deuda duplicada: si esta venta ya tiene deuda, salir OK
    select id into v_debt_id from public.debts where sale_id = p_sale_id limit 1;
    if v_debt_id is not null then
      return json_build_object('saleId', p_sale_id, 'alreadyProcessed', true);
    end if;

    -- Cliente exacto (sin acentos/case) o nuevo — nunca duplica (A5)
    v_client_id := public.find_client_id(v_store, p_client_name);
    if v_client_id is null then
      insert into public.clients (name, balance, is_live_client, store_id)
      values (btrim(p_client_name), 0, p_channel = 'tiktok_live', v_store)
      returning id into v_client_id;
    end if;

    insert into public.debts (client_id, original_amount, remaining, description, status, sale_id, store_id, user_id, created_at)
    values (v_client_id, p_total, p_total, left(coalesce(p_notes, 'Fiado'), 100), 'pendiente', p_sale_id, v_store, v_user, v_created);

    return json_build_object(
      'saleId', p_sale_id,
      'clientId', v_client_id,
      'balance', (select coalesce(sum(d.remaining), 0) from public.debts d where d.client_id = v_client_id and d.status = 'pendiente')
    );
  else
    -- Contado (efectivo/transferencia): payment con id idempotente
    if p_payment_id is not null then
      insert into public.payments (id, sale_id, amount, method, store_id, user_id, created_at)
      values (p_payment_id, p_sale_id, p_total, p_payment_method, v_store, v_user, v_created)
      on conflict (id) do nothing;
    end if;
  end if;

  return json_build_object('saleId', p_sale_id);
end;
$$;

-- ----------------------------------------------------
-- A1) aplicar_abono: la deuda debe ser de MI tienda
-- ----------------------------------------------------
create or replace function public.aplicar_abono(
  p_payment_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_method text,
  p_created_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
  v_remaining numeric;
  v_take numeric;
  v_applied numeric := 0;
  d record;
  v_balance numeric;
  v_first_debt uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto de abono invalido: %', p_amount;
  end if;

  -- El cliente debe pertenecer a la tienda que llama (A1)
  if not exists (select 1 from public.clients where id = p_client_id and store_id = v_store) then
    raise exception 'Cliente ajeno o inexistente';
  end if;

  -- Idempotente: si este payment ya existe, no repetir
  if exists (select 1 from public.payments where id = p_payment_id) then
    select coalesce(sum(remaining), 0) into v_balance
    from public.debts where client_id = p_client_id and status = 'pendiente';
    return json_build_object('alreadyProcessed', true, 'balance', v_balance);
  end if;

  -- Bloquear deudas FIFO del cliente mientras se descuenta
  for d in
    select id, remaining
    from public.debts
    where client_id = p_client_id and status = 'pendiente'
    order by created_at asc
    for update
  loop
    exit when v_remaining is not null and v_remaining <= 0;
    v_remaining := coalesce(v_remaining, p_amount);
    v_take := least(v_remaining, d.remaining);
    if v_first_debt is null then
      v_first_debt := d.id;
    end if;
    update public.debts
       set remaining = remaining - v_take,
           status = case when remaining - v_take <= 0 then 'saldada' else 'pendiente' end
     where id = d.id;
    v_remaining := v_remaining - v_take;
    v_applied := v_applied + v_take;
  end loop;

  if v_applied <= 0 then
    raise exception 'El cliente no tiene deudas pendientes';
  end if;

  insert into public.payments (id, amount, method, debt_id, store_id, user_id, created_at)
  values (p_payment_id, v_applied, p_method, v_first_debt, v_store, v_user, coalesce(p_created_at, now()));

  select coalesce(sum(remaining), 0) into v_balance
  from public.debts where client_id = p_client_id and status = 'pendiente';

  return json_build_object('applied', v_applied, 'balance', v_balance);
end;
$$;

-- ----------------------------------------------------
-- A1+A7) fiar_venta: venta de MI tienda y pendiente; cliente sin acentos
-- ----------------------------------------------------
create or replace function public.fiar_venta(
  p_sale_id uuid,
  p_amount numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
  v_client_id uuid;
  v_name text;
  v_sale record;
begin
  -- Guardia anti doble-fiado
  if exists (select 1 from public.debts where sale_id = p_sale_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  select id, client_name, payment_method, store_id into v_sale
    from public.sales where id = p_sale_id;
  -- Venta ajena o inexistente → error (A1)
  if v_sale.id is null then
    raise exception 'La venta no existe';
  end if;
  if v_sale.store_id <> v_store then
    raise exception 'La venta no es de esta tienda';
  end if;
  -- Solo apartados pendientes (A7)
  if v_sale.payment_method <> 'fiado' then
    raise exception 'La venta ya esta cobrada';
  end if;
  v_name := v_sale.client_name;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'La venta no tiene nombre de cliente';
  end if;

  v_client_id := public.find_client_id(v_store, v_name);
  if v_client_id is null then
    insert into public.clients (name, balance, is_live_client, store_id)
    values (btrim(v_name), 0, true, v_store)
    returning id into v_client_id;
  end if;

  insert into public.debts (client_id, original_amount, remaining, description, status, sale_id, store_id, user_id)
  values (v_client_id, p_amount, p_amount, 'Prenda de Live', 'pendiente', p_sale_id, v_store, v_user);

  return json_build_object('clientId', v_client_id);
end;
$$;

-- ----------------------------------------------------
-- A4+A1+A7) cobrar_venta: idempotente POR VENTA (no por payment id),
--          solo apartados pendientes de MI tienda, método elegible
-- ----------------------------------------------------
create or replace function public.cobrar_venta(
  p_sale_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_method text default 'efectivo'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
  v_method text := coalesce(nullif(btrim(p_method), ''), 'efectivo');
begin
  -- Idempotencia por VENTA: si ya hay un cobro ligado, salir OK (A4).
  -- Un reintento (o un segundo dispositivo) jamás inserta dos payments.
  if exists (select 1 from public.payments where sale_id = p_sale_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  -- Marcar la venta como cobrada SOLO si es un apartado pendiente de MI tienda
  update public.sales
     set payment_method = v_method
   where id = p_sale_id
     and store_id = v_store
     and payment_method = 'fiado';
  if not found then
    raise exception 'El apartado no existe, ya esta cobrado o es de otra tienda';
  end if;

  insert into public.payments (id, sale_id, amount, method, store_id, user_id)
  values (p_payment_id, p_sale_id, p_amount, v_method, v_store, v_user);
  return json_build_object('ok', true);
end;
$$;

-- ----------------------------------------------------
-- A4) payments: un solo cobro por venta (idempotencia real de cobrar_venta)
-- ----------------------------------------------------
-- Limpia duplicados históricos ANTES del índice (conserva el más antiguo;
-- desempate por ctid para timestamps idénticos → determinista)
delete from public.payments p
  using public.payments p2
  where p.sale_id is not null
    and p2.sale_id = p.sale_id
    and (p2.created_at, p2.ctid) < (p.created_at, p.ctid);

create unique index if not exists idx_payments_one_per_sale
  on public.payments (sale_id)
  where sale_id is not null;
-- Día de negocio Nicaragua (YYYY-MM-DD en America/Managua)
create or replace function public.nic_day(p_ts timestamptz default now())
returns date
language sql
stable
as $$
  select ((p_ts at time zone 'America/Managua')::date);
$$;

-- Limpia duplicados históricos (conserva el primero del día)
delete from public.cash_cuts c
  using public.cash_cuts c2
  where c2.store_id = c.store_id
    and public.nic_day(c2.created_at) = public.nic_day(c.created_at)
    and c2.created_at < c.created_at;

-- Índice único por (tienda, día NI) — la BD rechaza el segundo cierre del día
create unique index if not exists idx_cash_cuts_store_day
  on public.cash_cuts (store_id, public.nic_day(created_at));

-- ----------------------------------------------------
-- A8) Límite de creación de tiendas por día (en BD, no en memoria)
-- ----------------------------------------------------
-- 5 tiendas nuevas por día calendario (Nicaragua). Se consulta en el API
-- admin con service_role antes de crear.
create or replace function public.stores_created_today()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.stores where public.nic_day(created_at) = public.nic_day(now());
$$;

grant execute on function public.norm_name(text) to authenticated;
grant execute on function public.find_client_id(uuid, text) to authenticated;
grant execute on function public.nic_day(timestamptz) to authenticated;
grant execute on function public.stores_created_today() to authenticated;
grant execute on function public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.aplicar_abono(uuid, uuid, numeric, text, timestamptz) to authenticated;
grant execute on function public.cobrar_venta(uuid, uuid, numeric, text) to authenticated;
