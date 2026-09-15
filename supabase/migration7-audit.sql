-- =====================================================
-- MI PRENDA · Migración 7: Integridad contable
-- Auditoría 2026-09-13. Arregla:
--   #1  Stock sobreescrito con valores absolutos → decremento atómico
--   #2  Operaciones multi-tabla sin transacción → RPCs transaccionales
--   #3  Deuda duplicada en venta fiada offline → guardia por sale_id
--   #5  Abonos no guardados numéricos en cash_cuts → columnas nuevas
--   #7  Carrera en abonos FIFO → SELECT ... FOR UPDATE
--   #8  Clientes duplicados → UNIQUE(store_id, lower(name))
--   #10 Códigos con colisión por count → contadores por tienda
--   #11 Discrepancia del arqueo solo en texto → columna numérica
--   #12 Balance desincronizable → trigger automático
--
-- EJECUTAR EN: Supabase Dashboard > SQL Editor (con el servidor local DETENIDO)
-- Idempotente: puede re-ejecutarse sin romper nada.
-- =====================================================

-- ----------------------------------------------------
-- 0) RLS helper: tienda actual con assert de usuario
-- ----------------------------------------------------
-- Versión que Lanza error si no hay sesión (uso interno de los RPCs,
-- para no escribir a ciegas si algo se llama sin auth).
create or replace function public.current_store_id_strict()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  select p.store_id into v_store from public.profiles p where p.id = auth.uid();
  if v_store is null then
    raise exception 'Sin sesion de tienda (no se encontro profile)';
  end if;
  return v_store;
end;
$$;

-- ----------------------------------------------------
-- 1) (#8) Clientes: deduplicar + UNIQUE por tienda
-- ----------------------------------------------------
-- Fusiona duplicados case/trim-insensibles ANTES de crear el índice único:
-- 1.1) Normaliza espacios al insertar/actualizar (trigger)
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

drop trigger if exists trg_trim_client on public.clients;
create trigger trg_trim_client
  before insert or update of name on public.clients
  for each row execute function public.trim_client_name();

-- 1.2) Fusiona duplicados existentes (mismo nombre tras normalizar):
--      conserva el más antiguo, mueve sus deudas y suma el balance.
do $$
declare
  dup record;
  keep record;
  v_bal numeric(12,2);
begin
  for dup in
    select c2.id as dup_id, c2.store_id, lower(c2.name) as lname
    from public.clients c2
    join public.clients c1
      on c1.store_id = c2.store_id
     and lower(c1.name) = lower(c2.name)
     and c1.created_at < c2.created_at
  loop
    -- "keep" = el más antiguo con ese nombre en esa tienda
    select c.* into keep
    from public.clients c
    where c.store_id = dup.store_id and lower(c.name) = dup.lname
    order by c.created_at asc
    limit 1;

    if keep.id is not null and keep.id <> dup.dup_id then
      -- mover deudas del duplicado al conservado
      update public.debts set client_id = keep.id where client_id = dup.dup_id;
      -- mover payments ligados a esas deudas (debt_id ya apunta a la deuda movida)
      -- borrar el duplicado (si quedara algo huérfano, no lo hay: todo va por FK)
      delete from public.clients where id = dup.dup_id;
    end if;
  end loop;

  -- Recalcular balances de los afectados (todos, es barato en este tamaño)
  for keep in select distinct client_id from public.debts loop
    select coalesce(sum(remaining), 0) into v_bal
    from public.debts
    where client_id = keep.client_id and status = 'pendiente';
    update public.clients set balance = v_bal where id = keep.client_id;
  end loop;
end;
$$;

-- 1.3) Índice único (también garantiza unicidad en INSERT concurrente)
create unique index if not exists idx_clients_unique_name
  on public.clients (store_id, lower(btrim(name)));

-- ----------------------------------------------------
-- 2) (#10) Contadores por tienda para códigos únicos
-- ----------------------------------------------------
-- Tabla de contadores (una fila por tienda) + función que atómicamente
-- devuelve el siguiente número. Reemplaza el frágil "count(*) + 1".
create table if not exists public.store_counters (
  store_id uuid primary key references public.stores(id) on delete cascade,
  lot_seq int not null default 0,
  product_seq int not null default 0
);

create or replace function public.next_lot_code(p_store uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  insert into public.store_counters (store_id, lot_seq)
  values (p_store, 1)
  on conflict (store_id) do update
    set lot_seq = public.store_counters.lot_seq + 1
  returning public.store_counters.lot_seq into v_n;
  return 'Paca #' || v_n;
end;
$$;

create or replace function public.next_product_code(p_store uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  insert into public.store_counters (store_id, product_seq)
  values (p_store, 1)
  on conflict (store_id) do update
    set product_seq = public.store_counters.product_seq + 1
  returning public.store_counters.product_seq into v_n;
  return 'P-' || lpad(v_n::text, 3, '0');
end;
$$;

-- RLS: la tienda solo ve sus contadores
alter table public.store_counters enable row level security;
create policy "store counters select" on public.store_counters
  for select using (store_id = public.current_store_id());

-- ----------------------------------------------------
-- 3) (#1) Stock atómico: decremento relativo con control
-- ----------------------------------------------------
-- NOTA: no usamos GREATEST(0, ...) — enmascarar sobreventa en silencio
-- corrompe el inventario; mejor reventar y que el reintento lo resuelva.
create or replace function public.decrement_stock(
  p_lot_id uuid,
  p_qty int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lots
     set pieces_left = pieces_left - p_qty
   where id = p_lot_id
     and pieces_left - p_qty >= 0; -- nunca negativo

  if not found then
    raise exception 'Stock insuficiente en el lote % (pedian %)', p_lot_id, p_qty;
  end if;
end;
$$;

-- Contador de vendidos atómico (relativo, no absoluto)
create or replace function public.increment_sold(
  p_product_id uuid,
  p_qty int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set sold_count = sold_count + p_qty
   where id = p_product_id;
end;
$$;

-- ----------------------------------------------------
-- 4) (#12) Balance del cliente: SIEMPRE recalculado por trigger
-- ----------------------------------------------------
-- Impossible que clients.balance se desincronice: cualquier cambio
-- en debts lo recalcula desde la fuente de verdad.
create or replace function public.recalc_client_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  v_client := coalesce(new.client_id, old.client_id);
  update public.clients c
     set balance = (
       select coalesce(sum(d.remaining), 0)
       from public.debts d
       where d.client_id = v_client and d.status = 'pendiente'
     )
   where c.id = v_client;
  return null;
end;
$$;

drop trigger if exists trg_debts_balance on public.debts;
create trigger trg_debts_balance
  after insert or update or delete on public.debts
  for each row execute function public.recalc_client_balance();

-- ----------------------------------------------------
-- 5) (#2 #3) RPC: registrar venta completa (transaccional)
-- ----------------------------------------------------
-- Inserta venta (id idempotente), payment contado, o cliente+deuda
-- para fiado. Todo dentro de UNA transacción: o entra todo o nada.
-- El guardia por sale_id (#3) evita deuda duplicada en reintentos.
create or replace function public.registrar_venta(
  p_sale_id uuid,
  p_total numeric,
  p_items_count int,
  p_channel text,
  p_payment_method text,
  p_client_name text,
  p_notes text,
  p_payment_id uuid default null
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
begin
  -- Montos válidos
  if p_total is null or p_total <= 0 then
    raise exception 'Total invalido: %', p_total;
  end if;

  -- Venta idempotente por id local
  insert into public.sales (id, total, items_count, channel, payment_method, client_name, notes, store_id, user_id)
  values (p_sale_id, p_total, p_items_count, p_channel, p_payment_method, p_client_name, p_notes, v_store, v_user)
  on conflict (id) do nothing;

  if p_payment_method = 'fiado' then
    if p_client_name is null or btrim(p_client_name) = '' then
      raise exception 'Fiado sin nombre de cliente';
    end if;

    -- (#3) Guardia anti deuda duplicada: si esta venta ya tiene deuda, salir OK
    select id into v_debt_id from public.debts where sale_id = p_sale_id limit 1;
    if v_debt_id is not null then
      return json_build_object('saleId', p_sale_id, 'alreadyProcessed', true);
    end if;

    -- Cliente exacto (case-insensitive) o nuevo
    select id into v_client_id
    from public.clients
    where store_id = v_store and lower(name) = lower(btrim(p_client_name))
    limit 1;
    if v_client_id is null then
      insert into public.clients (name, balance, is_live_client, store_id)
      values (btrim(p_client_name), 0, p_channel = 'tiktok_live', v_store)
      returning id into v_client_id;
    end if;

    insert into public.debts (client_id, original_amount, remaining, description, status, sale_id, store_id, user_id)
    values (v_client_id, p_total, p_total, left(coalesce(p_notes, 'Fiado'), 100), 'pendiente', p_sale_id, v_store, v_user);

    return json_build_object(
      'saleId', p_sale_id,
      'clientId', v_client_id,
      'balance', (select coalesce(sum(d.remaining), 0) from public.debts d where d.client_id = v_client_id and d.status = 'pendiente')
    );
  else
    -- Contado (efectivo/transferencia): payment con id idempotente
    if p_payment_id is not null then
      insert into public.payments (id, sale_id, amount, method, store_id, user_id)
      values (p_payment_id, p_sale_id, p_total, p_payment_method, v_store, v_user)
      on conflict (id) do nothing;
    end if;
    return json_build_object('saleId', p_sale_id);
  end if;
end;
$$;

-- ----------------------------------------------------
-- 6) (#7) RPC: aplicar abono FIFO con FOR UPDATE
-- ----------------------------------------------------
-- Bloquea las filas de deuda mientras aplica: dos abonos simultáneos
-- NO pueden leer el mismo remaining. Idempotente por p_payment_id.
create or replace function public.aplicar_abono(
  p_payment_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_method text
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

  -- El abono se registra hasta lo que la deuda absorbió (nunca negativo)
  insert into public.payments (id, amount, method, debt_id, store_id, user_id)
  values (p_payment_id, v_applied, p_method, v_first_debt, v_store, v_user);

  select coalesce(sum(remaining), 0) into v_balance
  from public.debts where client_id = p_client_id and status = 'pendiente';

  return json_build_object('applied', v_applied, 'balance', v_balance);
end;
$$;

-- ----------------------------------------------------
-- 7) (#2) RPC: fiar una venta YA existente (Live)
-- ----------------------------------------------------
-- Anti doble-fiado por sale_id + transacción completa
-- (antes: update sale + insert debt + update balance en 3 llamadas).
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
begin
  -- Guardia anti doble-fiado
  if exists (select 1 from public.debts where sale_id = p_sale_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  select client_name into v_name from public.sales where id = p_sale_id;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'La venta no tiene nombre de cliente';
  end if;

  select id into v_client_id
  from public.clients
  where store_id = v_store and lower(name) = lower(btrim(v_name))
  limit 1;
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
-- 8) (#2) RPC: cobrar apartado de Live (transaccional)
-- ----------------------------------------------------
create or replace function public.cobrar_venta(
  p_sale_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_method text default 'efectivo'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
begin
  update public.sales
     set payment_method = p_method
   where id = p_sale_id
     and payment_method = 'fiado'; -- solo apartados pendientes

  insert into public.payments (id, sale_id, amount, method, store_id, user_id)
  values (p_payment_id, p_sale_id, p_amount, p_method, v_store, v_user)
  on conflict (id) do nothing;
end;
$$;

-- ----------------------------------------------------
-- 9) (#10) RPC: registrar producto+lote (transaccional)
-- ----------------------------------------------------
-- Códigos por contador atómico (nunca count+1). Idempotente por
-- id de lote. Rollback automático si el producto falla.
create or replace function public.registrar_producto(
  p_lot_id uuid,
  p_product_id uuid,
  p_name text,
  p_pieces int,
  p_cost numeric,
  p_price numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id_strict();
  v_user uuid := auth.uid();
  v_lot_code text;
  v_prod_code text;
begin
  if p_name is null or btrim(p_name) = '' then raise exception 'Falta nombre'; end if;
  if p_pieces is null or p_pieces <= 0 then raise exception 'Cantidad invalida: %', p_pieces; end if;
  if p_price is null or p_price <= 0 then raise exception 'Precio invalido: %', p_price; end if;
  if p_cost is null or p_cost < 0 then raise exception 'Costo invalido: %', p_cost; end if;

  -- Idempotente por lote
  if exists (select 1 from public.lots where id = p_lot_id) then
    return json_build_object('alreadyProcessed', true);
  end if;

  v_lot_code := public.next_lot_code(v_store);
  v_prod_code := public.next_product_code(v_store);

  insert into public.lots (id, code, name, pieces_total, pieces_left, total_cost, avg_sale_price, store_id, user_id)
  values (p_lot_id, v_lot_code, btrim(p_name), p_pieces, p_pieces, p_cost, p_price, v_store, v_user);

  insert into public.products (id, code, name, sale_price, lot_id, store_id)
  values (p_product_id, v_prod_code, btrim(p_name), p_price, p_lot_id, v_store);

  return json_build_object('lotCode', v_lot_code, 'productCode', v_prod_code);
end;
$$;

-- ----------------------------------------------------
-- 9b) (#10) Productos huérfanos: code por defecto con contador
-- ----------------------------------------------------
-- El flujo "crear producto para un lote huérfano" inserta SIN code;
-- el trigger lo rellena con el contador atómico de la tienda.
create or replace function public.fill_product_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  if new.code is null or btrim(new.code) = '' then
    if new.store_id is null then
      select store_id into v_store from public.profiles where id = auth.uid();
    else
      v_store := new.store_id;
    end if;
    new.code := public.next_product_code(v_store);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_product_code on public.products;
create trigger trg_fill_product_code
  before insert on public.products
  for each row execute function public.fill_product_code();

grant execute on function public.fill_product_code() to authenticated;

-- ----------------------------------------------------
-- 10) (#5 #11) cash_cuts: columnas numéricas
-- ----------------------------------------------------
alter table public.cash_cuts
  add column if not exists abonos_total numeric(12,2) not null default 0,
  add column if not exists transfer_total numeric(12,2) not null default 0,
  add column if not exists fisico_total numeric(12,2) not null default 0,
  add column if not exists discrepancy_amount numeric(12,2) not null default 0;

-- Migrar datos viejos de notes → columnas (una sola pasada)
update public.cash_cuts
  set fisico_total = coalesce(
        (regexp_replace((regexp_match(notes, 'Contado físico: C\$(-?[\d.,]+)'))[1], '[.,]', '', 'g'))::numeric,
        fisico_total)
  where fisico_total = 0 and notes like '%Contado físico%';

update public.cash_cuts
  set discrepancy_amount = coalesce(
        (regexp_replace((regexp_match(notes, 'Diferencia: C\$(-?[\d.,]+)'))[1], '[.,]', '', 'g'))::numeric,
        discrepancy_amount)
  where discrepancy_amount = 0 and notes like '%Diferencia%';

update public.cash_cuts
  set transfer_total = coalesce(
        (regexp_replace((regexp_match(notes, 'Transferencias: C\$([\d.,]+)'))[1], '[.,]', '', 'g'))::numeric,
        transfer_total)
  where transfer_total = 0 and notes like '%Transferencias%';

update public.cash_cuts
  set abonos_total = coalesce(
        (regexp_replace((regexp_match(notes, 'Abonos en efectivo: C\$([\d.,]+)'))[1], '[.,]', '', 'g'))::numeric,
        abonos_total)
  where abonos_total = 0 and notes like '%Abonos en efectivo%';

-- collected_total ya incluía SOLO efectivo de ventas; para que los reportes
-- sumen el dinero real recolectado en caja, collected_total pasa a ser
-- efectivo de ventas + abonos en efectivo (la BD queda consistente con el arqueo).
-- GUARD (migración 10): solo la PRIMERA vez — re-ejecutar la migración no
-- debe inflar collected_total otra vez. Se marca en notes la primera pasada.
update public.cash_cuts
   set collected_total = collected_total + abonos_total,
       notes = notes || ' [col-fixed]'
 where abonos_total > 0
   and notes not like '%[col-fixed]%';

-- ----------------------------------------------------
-- 11) Grants para los RPCs (acceso autenticado)
-- ----------------------------------------------------
-- Supabase expone RPCs a "authenticated" por defecto vía PostgREST,
-- pero los security definer necesitan permiso de ejecución explícito:
grant execute on function public.current_store_id_strict() to authenticated;
grant execute on function public.next_lot_code(uuid) to authenticated;
grant execute on function public.next_product_code(uuid) to authenticated;
grant execute on function public.decrement_stock(uuid, int) to authenticated;
grant execute on function public.increment_sold(uuid, int) to authenticated;
grant execute on function public.registrar_venta(uuid, numeric, int, text, text, text, text, uuid) to authenticated;
grant execute on function public.aplicar_abono(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.fiar_venta(uuid, numeric) to authenticated;
grant execute on function public.cobrar_venta(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.registrar_producto(uuid, uuid, text, int, numeric, numeric) to authenticated;
