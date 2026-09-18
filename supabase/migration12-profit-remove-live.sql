-- =====================================================
-- MIGRACIÓN 12 · Ganancia real del día + eliminación de Live
-- Fecha: 2026-09-17
--
-- Qué cambia
-- ----------
-- 1) sales.total_cost (numeric, default 0): el COSTO de las prendas
--    vendidas, calculado SOLO en el servidor desde los lotes
--    (total_cost / pieces_total del lote × cantidad). Con eso:
--    GANANCIA DE UNA VENTA = total − total_cost  (la rebaja ya está
--    restada en total, migración 11 → la ganancia es la REAL).
-- 2) registrar_venta calcula y guarda ese costo en la MISMA transacción.
--    MANTIENE la firma de 11 parámetros de la migración 11 → CREATE OR
--    REPLACE alcanza, no hay nada que dropear y la app vieja/nueva
--    conviven sin error de PostgREST.
-- 3) ELIMINACIÓN DEL MÓDULO LIVE: se DROPEAN fiar_venta y cobrar_venta
--    (solo los usaba la pantalla de Live, que ya no existe). El historial
--    de ventas/deudas NO se toca: canal 'tiktok_live' sigue siendo válido
--    para las ventas viejas y los cortes ya hechos siguen cuadrando.
--    Las ventas de mostrador con cliente pasan client_name en cualquier
--    método (contado/transf opcional, fiado obligatorio) — sin cambio de SQL
--    porque registrar_venta ya aceptaba p_client_name en todos los casos.
--
-- EJECUTAR EN: Supabase Dashboard > SQL Editor (todo el archivo).
-- ORDEN: esta migración PRIMERO, deploy del código DESPUÉS (el código nuevo
--        hace .select('total_cost') en Caja/Inicio).
-- =====================================================

-- 1) Columna total_cost --------------------------------------------------

alter table public.sales
  add column if not exists total_cost numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_total_cost_nonneg'
  ) then
    alter table public.sales
      add constraint sales_total_cost_nonneg check (total_cost >= 0);
  end if;
end $$;

-- 2) registrar_venta: misma transacción, ahora con costo -----------------

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
  p_created_at timestamptz default null, -- fecha original del negocio (offline)
  p_discount numeric default 0           -- rebaja manual (migración 11)
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
  v_total_cost numeric := 0;
  v_item_cost numeric;
  it record;
begin
  if p_total is null or p_total <= 0 then
    raise exception 'Total invalido: %', p_total;
  end if;
  if v_discount < 0 then
    raise exception 'Rebaja invalida: %', p_discount;
  end if;

  -- COSTO de lo vendido (migración 12): se calcula AQUÍ, en el servidor,
  -- leyendo el lote (total_cost/pieces_total × qty). Así la ganancia del
  -- día no depende de lo que mande el cliente ni de memoria del usuario.
  -- Sin items (crédito directo = dinero, no prendas) queda en 0 y NO
  -- infla la ganancia (items_count = 0 la excluye en los reportes).
  if p_items is not null then
    for it in select value from jsonb_array_elements(p_items)
    loop
      if it.value ->> 'lotId' is not null then
        select (l.total_cost / nullif(l.pieces_total, 0)) * coalesce((it.value ->> 'qty')::int, 1)
          into v_item_cost
          from public.lots l
         where l.id = (it.value ->> 'lotId')::uuid
           and l.store_id = v_store;
        v_total_cost := v_total_cost + coalesce(v_item_cost, 0);
      end if;
    end loop;
  end if;

  -- Venta idempotente por id local: los efectos (payment/deuda/stock)
  -- SOLO se aplican cuando la venta es nueva.
  insert into public.sales (id, total, items_count, channel, payment_method, client_name, notes, store_id, user_id, created_at, discount, total_cost)
  values (p_sale_id, p_total, p_items_count, p_channel, p_payment_method, p_client_name, p_notes, v_store, v_user, v_created, v_discount, v_total_cost)
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
    -- Reintento idempotente: la venta ya existía (con stock ya aplicado)
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

    -- La deuda nace por el monto FINAL (rebaja ya restada)
    insert into public.debts (client_id, original_amount, remaining, description, status, sale_id, store_id, user_id, created_at)
    values (v_client_id, p_total, p_total, left(coalesce(p_notes, 'Fiado'), 100), 'pendiente', p_sale_id, v_store, v_user, v_created);

    return json_build_object(
      'saleId', p_sale_id,
      'clientId', v_client_id,
      'balance', (select coalesce(sum(d.remaining), 0) from public.debts d where d.client_id = v_client_id and d.status = 'pendiente')
    );
  else
    -- Contado (efectivo/transferencia): payment con id idempotente por el
    -- monto FINAL. p_client_name es OPCIONAL aquí (migración 12): queda en
    -- la venta para la trazabilidad sin crear cliente ni deuda.
    if p_payment_id is not null then
      insert into public.payments (id, sale_id, amount, method, store_id, user_id, created_at)
      values (p_payment_id, p_sale_id, p_total, p_payment_method, v_store, v_user, v_created)
      on conflict (id) do nothing;
    end if;
  end if;

  return json_build_object('saleId', p_sale_id);
end;
$$;

grant execute on function public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid, jsonb, timestamptz, numeric) to authenticated;

-- 3) Adiós módulo Live: estos RPCs solo los usaba /app/live --------------
--    (su historial de ventas/deudas NO se toca: solo se retira la
--    maquinaria). Si el Live viejo cacheado en una PWA los llama, dará
--    error hasta que la app se actualice — ventana de minutos.
drop function if exists public.fiar_venta(uuid, numeric);
drop function if exists public.fiar_venta(uuid, numeric, numeric);
drop function if exists public.cobrar_venta(uuid, uuid, numeric, text);
drop function if exists public.cobrar_venta(uuid, uuid, numeric, text, numeric);
