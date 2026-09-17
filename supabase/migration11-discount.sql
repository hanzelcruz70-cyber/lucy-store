-- =====================================================
-- MIGRACIÓN 11 · Rebajas manuales con contabilidad intacta
-- Fecha: 2026-09-17
--
-- Qué cambia
-- ----------
-- 1) sales.discount (numeric, default 0): cuánto se rebajó.
--    REGLA CONTABLE: sales.total SIGUE siendo la plata REAL
--    cobrada o fiada; el precio original siempre se recupera
--    como (total + discount). Caja, cortes, deudas, reportes
--    y Excel NO cambian porque ya leen montos reales.
-- 2) registrar_venta, cobrar_venta y fiar_venta aceptan
--    p_discount y lo guardan junto a la venta.
--
-- PostgREST: se DROPean las firmas viejas ANTES de crear las
-- nuevas. Si convivieran ambas (overloading), una llamada con
-- los argumentos viejos sería AMBIGUA y PostgREST fallaría con
-- error 300 ("could not choose the best candidate function").
-- Con la firma nueva como única variante, las llamadas viejas
-- (PWA cacheada en celulares) siguen funcionando: p_discount
-- tiene DEFAULT y Postgres lo rellena solo.
--
-- EJECUTAR EN: Supabase Dashboard > SQL Editor (todo el archivo)
-- =====================================================

-- 1) Columna discount ---------------------------------------------------

alter table public.sales
  add column if not exists discount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_discount_nonneg'
  ) then
    alter table public.sales
      add constraint sales_discount_nonneg check (discount >= 0);
  end if;
end $$;

-- 2) registrar_venta con p_discount -------------------------------------
--    (mostrador: contado / transferencia / fiado)
--    p_total es el TOTAL FINAL (rebaja ya restada por el cliente).

drop function if exists public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid, jsonb, timestamptz);

create or replace function public.registrar_venta(
  p_sale_id uuid,
  p_total numeric,                       -- TOTAL FINAL (rebaja ya aplicada)
  p_items_count int,
  p_channel text,
  p_payment_method text,
  p_client_name text,
  p_notes text,
  p_payment_id uuid default null,
  p_items jsonb default null,            -- [{productId, lotId, qty}]
  p_created_at timestamptz default null, -- fecha original del negocio (modo offline)
  p_discount numeric default 0           -- rebaja manual (original = total + discount)
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
  v_discount numeric := coalesce(p_discount, 0);
  it record;
begin
  -- Montos válidos: total final > 0 y rebaja nunca negativa
  if p_total is null or p_total <= 0 then
    raise exception 'Total invalido: %', p_total;
  end if;
  if v_discount < 0 then
    raise exception 'Rebaja invalida: %', p_discount;
  end if;

  -- Venta idempotente por id local. v_new dice si ESTA llamada creó la
  -- fila (reintento = false): los efectos (payment/deuda/stock) SOLO se
  -- aplican cuando la venta es nueva — así un reintento jamás repite nada.
  insert into public.sales (id, total, items_count, channel, payment_method, client_name, notes, store_id, user_id, created_at, discount)
  values (p_sale_id, p_total, p_items_count, p_channel, p_payment_method, p_client_name, p_notes, v_store, v_user, v_created, v_discount)
  on conflict (id) do nothing;
  v_new := found;

  -- Stock y contadores DENTRO de la transacción y ANTES de cualquier
  -- return: un fiado con items descuenta stock igual que el contado.
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

    -- Guardia anti deuda duplicada: si esta venta ya tiene deuda, salir OK
    select id into v_debt_id from public.debts where sale_id = p_sale_id limit 1;
    if v_debt_id is not null then
      return json_build_object('saleId', p_sale_id, 'alreadyProcessed', true);
    end if;

    -- Cliente exacto (sin acentos/case) o nuevo — nunca duplica
    v_client_id := public.find_client_id(v_store, p_client_name);
    if v_client_id is null then
      insert into public.clients (name, balance, is_live_client, store_id)
      values (btrim(p_client_name), 0, p_channel = 'tiktok_live', v_store)
      returning id into v_client_id;
    end if;

    -- La deuda nace por el monto FINAL: el cliente debe lo que se acordó
    -- cobrarle DESPUÉS de la rebaja (la rebaja queda en sales.discount).
    insert into public.debts (client_id, original_amount, remaining, description, status, sale_id, store_id, user_id, created_at)
    values (v_client_id, p_total, p_total, left(coalesce(p_notes, 'Fiado'), 100), 'pendiente', p_sale_id, v_store, v_user, v_created);

    return json_build_object(
      'saleId', p_sale_id,
      'clientId', v_client_id,
      'balance', (select coalesce(sum(d.remaining), 0) from public.debts d where d.client_id = v_client_id and d.status = 'pendiente')
    );
  else
    -- Contado (efectivo/transferencia): payment con id idempotente,
    -- por el monto FINAL cobrado.
    if p_payment_id is not null then
      insert into public.payments (id, sale_id, amount, method, store_id, user_id, created_at)
      values (p_payment_id, p_sale_id, p_total, p_payment_method, v_store, v_user, v_created)
      on conflict (id) do nothing;
    end if;
  end if;

  return json_build_object('saleId', p_sale_id);
end;
$$;

-- 3) fiar_venta con p_discount (Live) -----------------------------------
--    p_amount = deuda FINAL (rebaja ya restada). La venta se actualiza:
--    total = final y discount = rebaja (rastro de la negociación).

drop function if exists public.fiar_venta(uuid, numeric);

create or replace function public.fiar_venta(
  p_sale_id uuid,
  p_amount numeric,               -- monto FINAL que queda debiendo
  p_discount numeric default 0    -- rebaja aplicada sobre el precio original
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto invalido: %', p_amount;
  end if;
  if coalesce(p_discount, 0) < 0 then
    raise exception 'Rebaja invalida: %', p_discount;
  end if;

  -- Guardia anti doble-fiado
  if exists (select 1 from public.debts where sale_id = p_sale_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  select id, client_name, payment_method, store_id into v_sale
    from public.sales where id = p_sale_id;
  -- Venta ajena o inexistente → error
  if v_sale.id is null then
    raise exception 'La venta no existe';
  end if;
  if v_sale.store_id <> v_store then
    raise exception 'La venta no es de esta tienda';
  end if;
  -- Solo apartados pendientes
  if v_sale.payment_method <> 'fiado' then
    raise exception 'La venta ya esta cobrada';
  end if;
  v_name := v_sale.client_name;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'La venta no tiene nombre de cliente';
  end if;

  -- La venta queda con el monto REAL fiado + el rastro de la rebaja
  update public.sales
     set total = p_amount,
         discount = coalesce(p_discount, 0)
   where id = p_sale_id;

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

-- 4) cobrar_venta con p_discount (Live) ---------------------------------
--    p_amount = monto FINAL cobrado. La venta se actualiza igual que en
--    fiar_venta: total = final y discount = rebaja.

drop function if exists public.cobrar_venta(uuid, uuid, numeric, text);

create or replace function public.cobrar_venta(
  p_sale_id uuid,
  p_payment_id uuid,
  p_amount numeric,               -- monto FINAL cobrado (rebaja ya restada)
  p_method text default 'efectivo',
  p_discount numeric default 0    -- rebaja aplicada sobre el precio original
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto invalido: %', p_amount;
  end if;
  if coalesce(p_discount, 0) < 0 then
    raise exception 'Rebaja invalida: %', p_discount;
  end if;

  -- Idempotencia por VENTA: si ya hay un cobro ligado, salir OK.
  -- Un reintento (o un segundo dispositivo) jamás inserta dos payments.
  if exists (select 1 from public.payments where sale_id = p_sale_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  -- Marcar como cobrada SOLO si es apartado pendiente de MI tienda;
  -- total/discount reflejan el cobro REAL (rebaja incluida).
  update public.sales
     set payment_method = v_method,
         total = p_amount,
         discount = coalesce(p_discount, 0)
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

-- 5) Grants de las NUEVAS firmas (las viejas cayeron con el DROP) --------
grant execute on function public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid, jsonb, timestamptz, numeric) to authenticated;
grant execute on function public.fiar_venta(uuid, numeric, numeric) to authenticated;
grant execute on function public.cobrar_venta(uuid, uuid, numeric, text, numeric) to authenticated;
