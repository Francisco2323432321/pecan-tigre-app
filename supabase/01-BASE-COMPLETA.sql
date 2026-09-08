-- PECÁN TIGRE GESTIÓN
-- Setup / migración segura para el proyecto Supabase actual.
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- No borra productos, usuarios ni movimientos existentes.

begin;

create schema if not exists private;

-- ============================================================
-- UTILIDADES Y PERFILES
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'OPERADOR' check (role in ('ADMIN','OPERADOR','VENTAS')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', email)
from auth.users
on conflict (id) do nothing;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true);
$$;

create or replace function private.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true and role = any(p_roles));
$$;

create or replace function private.can_operate_or_system()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role' or private.has_role(array['ADMIN','OPERADOR','VENTAS']);
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.has_role(text[]) to authenticated;
grant execute on function private.can_operate_or_system() to authenticated;

-- ============================================================
-- PRODUCTOS / VARIANTES / RECETAS
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  product_kind text not null check (product_kind in ('INSUMO','MIX','ELABORADO','COMBO')),
  inventory_mode text not null check (inventory_mode in ('PROPIO','DERIVADO','PRODUCIDO')),
  base_unit text not null default 'g' check (base_unit in ('g','ml','u')),
  minimum_stock numeric(14,3) not null default 0,
  current_cost numeric(14,4) not null default 0,
  image_url text,
  tiendanube_product_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists minimum_stock numeric(14,3) not null default 0;
alter table public.products add column if not exists current_cost numeric(14,4) not null default 0;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists tiendanube_product_id text;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_tiendanube_product_id_unique on public.products(tiendanube_product_id) where tiendanube_product_id is not null;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text,
  base_quantity numeric(14,3) not null check (base_quantity > 0),
  price numeric(14,2) not null default 0 check (price >= 0),
  shipping_weight_g numeric(14,3),
  tiendanube_variant_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_variants add column if not exists shipping_weight_g numeric(14,3);
alter table public.product_variants add column if not exists tiendanube_variant_id text;
alter table public.product_variants add column if not exists active boolean not null default true;
alter table public.product_variants add column if not exists created_at timestamptz not null default now();
alter table public.product_variants add column if not exists updated_at timestamptz not null default now();
create unique index if not exists product_variants_sku_unique on public.product_variants(sku) where sku is not null;
create unique index if not exists product_variants_tn_unique on public.product_variants(tiendanube_variant_id) where tiendanube_variant_id is not null;
drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  output_product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'BORRADOR' check (status in ('BORRADOR','ACTIVA','ARCHIVADA')),
  output_quantity_base numeric(14,3) not null check (output_quantity_base > 0),
  waste_percentage numeric(7,3) not null default 0 check (waste_percentage between 0 and 100),
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(output_product_id, version)
);
create unique index if not exists recipes_one_active_per_product on public.recipes(output_product_id) where status = 'ACTIVA';
drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at before update on public.recipes for each row execute function public.set_updated_at();

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_product_id uuid not null references public.products(id) on delete restrict,
  quantity_base numeric(14,3) not null check (quantity_base > 0),
  stage text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists recipe_items_recipe_idx on public.recipe_items(recipe_id);
create index if not exists recipe_items_ingredient_idx on public.recipe_items(ingredient_product_id);

create or replace function private.prevent_recipe_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_output uuid;
  v_cycle boolean;
begin
  select output_product_id into v_output from public.recipes where id = new.recipe_id;
  if v_output is null then raise exception 'Receta inexistente'; end if;
  if new.ingredient_product_id = v_output then raise exception 'Un producto no puede ser ingrediente de sí mismo'; end if;

  with recursive deps(product_id) as (
    select new.ingredient_product_id
    union
    select ri.ingredient_product_id
    from deps d
    join public.recipes r on r.output_product_id = d.product_id and r.status <> 'ARCHIVADA'
    join public.recipe_items ri on ri.recipe_id = r.id
  )
  select exists(select 1 from deps where product_id = v_output) into v_cycle;
  if v_cycle then raise exception 'La receta generaría una dependencia circular'; end if;
  return new;
end;
$$;

drop trigger if exists recipe_items_prevent_cycle on public.recipe_items;
create trigger recipe_items_prevent_cycle before insert or update on public.recipe_items for each row execute function private.prevent_recipe_cycle();

-- ============================================================
-- INVENTARIO
-- ============================================================

create table if not exists public.inventory_balances (
  product_id uuid primary key references public.products(id) on delete restrict,
  on_hand numeric(14,3) not null default 0 check (on_hand >= 0),
  reserved numeric(14,3) not null default 0 check (reserved >= 0),
  available numeric(14,3) generated always as (on_hand - reserved) stored,
  updated_at timestamptz not null default now(),
  check (reserved <= on_hand)
);

insert into public.inventory_balances(product_id,on_hand,reserved)
select id,0,0 from public.products where inventory_mode in ('PROPIO','PRODUCIDO')
on conflict(product_id) do nothing;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  on_hand_delta numeric(14,3) not null default 0,
  reserved_delta numeric(14,3) not null default 0,
  reference_type text,
  reference_id text,
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists inventory_movements_idempotency_unique on public.inventory_movements(idempotency_key) where idempotency_key is not null;
create index if not exists inventory_movements_product_date on public.inventory_movements(product_id, created_at desc);

create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'ABIERTO' check (status in ('ABIERTO','CERRADO','CANCELADO')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.stock_counts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  system_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3),
  difference numeric(14,3) generated always as (counted_quantity - system_quantity) stored,
  adjustment_reason text,
  created_at timestamptz not null default now(),
  unique(stock_count_id, product_id)
);

-- Descompone un producto en los productos que realmente tienen inventario.
create or replace function private.product_requirements(p_product_id uuid, p_quantity_base numeric)
returns table(inventory_product_id uuid, quantity_base numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive req(product_id, qty, path) as (
    select p_product_id, p_quantity_base::numeric, array[p_product_id]::uuid[]
    union all
    select ri.ingredient_product_id,
           req.qty * ri.quantity_base / r.output_quantity_base,
           req.path || ri.ingredient_product_id
    from req
    join public.products p on p.id = req.product_id and p.inventory_mode = 'DERIVADO'
    join public.recipes r on r.output_product_id = p.id and r.status = 'ACTIVA'
    join public.recipe_items ri on ri.recipe_id = r.id
    where not (ri.ingredient_product_id = any(req.path))
  )
  select req.product_id, sum(req.qty)
  from req
  join public.products p on p.id = req.product_id
  where p.inventory_mode <> 'DERIVADO'
  group by req.product_id;
$$;

create or replace function public.product_available_base(p_product_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_result numeric;
begin
  if not private.is_active_user() and auth.role() <> 'service_role' then return 0; end if;
  select inventory_mode into v_mode from public.products where id = p_product_id;
  if v_mode is null then return 0; end if;
  if v_mode <> 'DERIVADO' then
    select available into v_result from public.inventory_balances where product_id = p_product_id;
    return coalesce(v_result, 0);
  end if;

  select min(ib.available / nullif(req.quantity_base,0))
    into v_result
  from private.product_requirements(p_product_id, 1) req
  join public.inventory_balances ib on ib.product_id = req.inventory_product_id;
  return greatest(coalesce(v_result,0),0);
end;
$$;

create or replace view public.product_stock_overview
with (security_invoker = true)
as
select p.id, p.code, p.name, p.product_kind, p.inventory_mode, p.base_unit,
       p.minimum_stock, p.current_cost, p.image_url, p.tiendanube_product_id,
       p.active, p.created_at, p.updated_at,
       ib.on_hand, ib.reserved,
       case when p.inventory_mode = 'DERIVADO' then public.product_available_base(p.id) else coalesce(ib.available,0) end as available_base
from public.products p
left join public.inventory_balances ib on ib.product_id = p.id;

create or replace function public.create_product(
  p_name text,
  p_code text default null,
  p_product_kind text default 'INSUMO',
  p_inventory_mode text default 'PROPIO',
  p_base_unit text default 'g'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Sin permiso'; end if;
  insert into public.products(name,code,product_kind,inventory_mode,base_unit)
  values(trim(p_name),nullif(trim(p_code),''),p_product_kind,p_inventory_mode,p_base_unit)
  returning id into v_id;
  if p_inventory_mode in ('PROPIO','PRODUCIDO') then
    insert into public.inventory_balances(product_id,on_hand,reserved) values(v_id,0,0) on conflict do nothing;
  end if;
  return v_id;
end;
$$;

create or replace function public.adjust_stock(p_product_id uuid, p_delta numeric, p_reason text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_mode text; v_on numeric; v_res numeric;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if p_delta = 0 then return; end if;
  select inventory_mode into v_mode from public.products where id=p_product_id;
  if v_mode is null or v_mode='DERIVADO' then raise exception 'Este producto no admite ajuste físico directo'; end if;
  select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=p_product_id for update;
  if v_on is null then raise exception 'Saldo de inventario inexistente'; end if;
  if v_on + p_delta < 0 then raise exception 'El stock físico no puede ser negativo'; end if;
  if v_on + p_delta < v_res then raise exception 'El ajuste dejaría el físico por debajo del stock reservado'; end if;
  update public.inventory_balances set on_hand=v_on+p_delta, updated_at=now() where product_id=p_product_id;
  insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reason,metadata,created_by)
  values(p_product_id,'ADJUSTMENT',p_delta,p_reason,jsonb_build_object('note',p_note),auth.uid());
end;
$$;

create or replace function public.apply_stock_count(p_items jsonb, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_count uuid; v_item jsonb; v_pid uuid; v_counted numeric; v_system numeric; v_reserved numeric; v_delta numeric;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  insert into public.stock_counts(status,notes,created_by) values('ABIERTO',p_notes,auth.uid()) returning id into v_count;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_counted := (v_item->>'counted_quantity')::numeric;
    select on_hand,reserved into v_system,v_reserved from public.inventory_balances where product_id=v_pid for update;
    if v_system is null then raise exception 'Producto sin saldo de inventario'; end if;
    if v_counted < v_reserved then raise exception 'El conteo de un producto es menor que lo reservado'; end if;
    v_delta := v_counted-v_system;
    insert into public.stock_count_items(stock_count_id,product_id,system_quantity,counted_quantity,adjustment_reason)
    values(v_count,v_pid,v_system,v_counted,'CONTEO_FISICO');
    if v_delta <> 0 then
      update public.inventory_balances set on_hand=v_counted,updated_at=now() where product_id=v_pid;
      insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,metadata,created_by)
      values(v_pid,'STOCK_COUNT',v_delta,'STOCK_COUNT',v_count::text,'CONTEO_FISICO',jsonb_build_object('notes',p_notes),auth.uid());
    end if;
  end loop;
  update public.stock_counts set status='CERRADO',closed_at=now() where id=v_count;
  return v_count;
end;
$$;

-- ============================================================
-- CLIENTES Y PEDIDOS / VENTAS
-- ============================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  name text not null,
  email text,
  phone text,
  notes text,
  source text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_external_unique on public.customers(source,external_id) where external_id is not null;
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'MANUAL' check (source in ('MANUAL','TIENDANUBE')),
  external_id text,
  order_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name_snapshot text,
  customer_email_snapshot text,
  customer_phone_snapshot text,
  status text not null default 'NUEVO' check (status in ('NUEVO','CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO','CANCELADO')),
  payment_status text not null default 'PENDIENTE' check (payment_status in ('PENDIENTE','PAGADO','REEMBOLSADO','FALLIDO')),
  shipping_status text not null default 'PENDIENTE' check (shipping_status in ('PENDIENTE','LISTO','DESPACHADO','ENTREGADO')),
  inventory_state text not null default 'PENDIENTE' check (inventory_state in ('PENDIENTE','RESERVED','CONSUMED','RELEASED','ERROR')),
  reservation_seq integer not null default 0,
  currency text not null default 'ARS',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  shipping_cost numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  shipping_method text,
  shipping_address jsonb,
  shipping_label_url text,
  notes text,
  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists orders_external_unique on public.orders(source,external_id) where external_id is not null;
create unique index if not exists orders_number_source_unique on public.orders(source,order_number);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  variant_name_snapshot text,
  sku_snapshot text,
  quantity integer not null check (quantity > 0),
  base_quantity_per_unit numeric(14,3) not null check (base_quantity_per_unit > 0),
  unit_price numeric(14,2) not null default 0,
  total_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.reserve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_state text; v_seq int; req record; v_on numeric; v_res numeric;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  if exists(select 1 from public.order_items where order_id=p_order_id and product_id is null) then raise exception 'Hay productos del pedido sin vincular'; end if;
  if exists(
    select 1 from public.order_items oi
    where oi.order_id=p_order_id
      and not exists (select 1 from private.product_requirements(oi.product_id, oi.base_quantity_per_unit * oi.quantity))
  ) then raise exception 'Hay un producto sin receta o sin requisitos de inventario'; end if;
  select inventory_state,reservation_seq into v_state,v_seq from public.orders where id=p_order_id for update;
  if v_state in ('RESERVED','CONSUMED') then return; end if;
  v_seq := coalesce(v_seq,0)+1;
  update public.orders set reservation_seq=v_seq where id=p_order_id;

  for req in
    select r.inventory_product_id, sum(r.quantity_base) quantity_base
    from public.order_items oi
    cross join lateral private.product_requirements(oi.product_id, oi.base_quantity_per_unit * oi.quantity) r
    where oi.order_id=p_order_id
    group by r.inventory_product_id
    order by r.inventory_product_id
  loop
    select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=req.inventory_product_id for update;
    if v_on is null then raise exception 'Producto sin saldo de inventario'; end if;
    if v_on-v_res < req.quantity_base then raise exception 'Stock insuficiente para reservar el pedido'; end if;
    update public.inventory_balances set reserved=v_res+req.quantity_base,updated_at=now() where product_id=req.inventory_product_id;
    insert into public.inventory_movements(product_id,movement_type,reserved_delta,reference_type,reference_id,reason,idempotency_key,created_by)
    values(req.inventory_product_id,'RESERVATION',req.quantity_base,'ORDER',p_order_id::text,'PEDIDO',format('ORDER:%s:RESERVE:%s:%s',p_order_id,v_seq,req.inventory_product_id),auth.uid())
    on conflict(idempotency_key) do nothing;
  end loop;
  update public.orders set inventory_state='RESERVED' where id=p_order_id;
end;
$$;

create or replace function public.release_order_reservation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_state text; v_seq int; req record; v_res numeric;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  select inventory_state,reservation_seq into v_state,v_seq from public.orders where id=p_order_id for update;
  if v_state <> 'RESERVED' then return; end if;
  for req in
    select r.inventory_product_id, sum(r.quantity_base) quantity_base
    from public.order_items oi cross join lateral private.product_requirements(oi.product_id, oi.base_quantity_per_unit*oi.quantity) r
    where oi.order_id=p_order_id group by r.inventory_product_id order by r.inventory_product_id
  loop
    select reserved into v_res from public.inventory_balances where product_id=req.inventory_product_id for update;
    update public.inventory_balances set reserved=greatest(v_res-req.quantity_base,0),updated_at=now() where product_id=req.inventory_product_id;
    insert into public.inventory_movements(product_id,movement_type,reserved_delta,reference_type,reference_id,reason,idempotency_key,created_by)
    values(req.inventory_product_id,'RELEASE',-req.quantity_base,'ORDER',p_order_id::text,'CANCELACION_PEDIDO',format('ORDER:%s:RELEASE:%s:%s',p_order_id,v_seq,req.inventory_product_id),auth.uid()) on conflict(idempotency_key) do nothing;
  end loop;
  update public.orders set inventory_state='RELEASED' where id=p_order_id;
end;
$$;

create or replace function public.consume_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_state text; v_seq int; req record; v_on numeric; v_res numeric;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  select inventory_state,reservation_seq into v_state,v_seq from public.orders where id=p_order_id for update;
  if v_state='CONSUMED' then return; end if;
  if v_state<>'RESERVED' then raise exception 'El pedido no tiene stock reservado'; end if;
  for req in
    select r.inventory_product_id, sum(r.quantity_base) quantity_base
    from public.order_items oi cross join lateral private.product_requirements(oi.product_id, oi.base_quantity_per_unit*oi.quantity) r
    where oi.order_id=p_order_id group by r.inventory_product_id order by r.inventory_product_id
  loop
    select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=req.inventory_product_id for update;
    if v_on < req.quantity_base or v_res < req.quantity_base then raise exception 'Inconsistencia de stock reservado'; end if;
    update public.inventory_balances set on_hand=v_on-req.quantity_base,reserved=v_res-req.quantity_base,updated_at=now() where product_id=req.inventory_product_id;
    insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reserved_delta,reference_type,reference_id,reason,idempotency_key,created_by)
    values(req.inventory_product_id,'SALE',-req.quantity_base,-req.quantity_base,'ORDER',p_order_id::text,'VENTA_ENVIADA',format('ORDER:%s:SALE:%s:%s',p_order_id,v_seq,req.inventory_product_id),auth.uid()) on conflict(idempotency_key) do nothing;
  end loop;
  update public.orders set inventory_state='CONSUMED' where id=p_order_id;
end;
$$;

create or replace function public.set_order_status(p_order_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_current text; v_inventory text;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  if p_status not in ('NUEVO','CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO','CANCELADO') then raise exception 'Estado inválido'; end if;
  select status,inventory_state into v_current,v_inventory from public.orders where id=p_order_id for update;
  if v_current is null then raise exception 'Pedido inexistente'; end if;
  if p_status in ('CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO') and v_inventory in ('PENDIENTE','RELEASED','ERROR') then
    perform public.reserve_order(p_order_id);
    select inventory_state into v_inventory from public.orders where id=p_order_id;
  end if;
  if p_status='CANCELADO' and v_inventory='RESERVED' then perform public.release_order_reservation(p_order_id); end if;
  if p_status='ENVIADO' and v_inventory='RESERVED' then perform public.consume_order_stock(p_order_id); end if;
  update public.orders set status=p_status,
    shipping_status=case when p_status='ENVIADO' then 'DESPACHADO' else shipping_status end
  where id=p_order_id;
end;
$$;

-- ============================================================
-- COMPRAS / PRODUCCIÓN / SISTEMA
-- ============================================================

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  status text not null default 'BORRADOR' check(status in ('BORRADOR','RECIBIDA','CANCELADA')),
  total numeric(14,2) not null default 0,
  notes text,
  received_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at before update on public.purchases for each row execute function public.set_updated_at();

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_base numeric(14,3) not null check(quantity_base>0),
  unit_cost numeric(14,4) not null default 0,
  total_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  output_product_id uuid not null references public.products(id) on delete restrict,
  recipe_id uuid references public.recipes(id) on delete restrict,
  output_quantity_base numeric(14,3) not null check(output_quantity_base>0),
  status text not null default 'PROCESADA' check(status in ('PROCESADA','CANCELADA')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.quick_receive_purchase(
  p_supplier text,
  p_product_id uuid,
  p_quantity_base numeric,
  p_unit_cost numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_purchase uuid; v_mode text; v_on numeric; v_res numeric; v_old_cost numeric; v_new_cost numeric; v_total numeric;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if p_quantity_base <= 0 or p_unit_cost < 0 then raise exception 'Cantidad o costo inválido'; end if;
  select inventory_mode,current_cost into v_mode,v_old_cost from public.products where id=p_product_id for update;
  if v_mode is null or v_mode='DERIVADO' then raise exception 'La compra debe ingresar a un producto con stock físico'; end if;
  select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=p_product_id for update;
  if v_on is null then raise exception 'Saldo de inventario inexistente'; end if;
  v_total := p_quantity_base*p_unit_cost;
  insert into public.purchases(supplier_name,status,total,notes,received_at,created_by)
  values(trim(p_supplier),'RECIBIDA',v_total,p_notes,now(),auth.uid()) returning id into v_purchase;
  insert into public.purchase_items(purchase_id,product_id,quantity_base,unit_cost,total_cost)
  values(v_purchase,p_product_id,p_quantity_base,p_unit_cost,v_total);
  v_new_cost := case when v_on+p_quantity_base>0 then ((v_on*coalesce(v_old_cost,0))+(p_quantity_base*p_unit_cost))/(v_on+p_quantity_base) else p_unit_cost end;
  update public.inventory_balances set on_hand=v_on+p_quantity_base,updated_at=now() where product_id=p_product_id;
  update public.products set current_cost=v_new_cost where id=p_product_id;
  insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,metadata,created_by)
  values(p_product_id,'PURCHASE',p_quantity_base,'PURCHASE',v_purchase::text,'COMPRA',jsonb_build_object('supplier',p_supplier,'unit_cost',p_unit_cost),auth.uid());
  return v_purchase;
end;
$$;

create or replace function public.produce_product(p_product_id uuid,p_output_quantity_base numeric,p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_mode text; v_recipe uuid; v_recipe_output numeric; v_batch uuid; req record; v_on numeric; v_res numeric;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if p_output_quantity_base<=0 then raise exception 'Cantidad inválida'; end if;
  select inventory_mode into v_mode from public.products where id=p_product_id;
  if v_mode<>'PRODUCIDO' then raise exception 'El producto no está configurado como PRODUCIDO'; end if;
  select id,output_quantity_base into v_recipe,v_recipe_output from public.recipes where output_product_id=p_product_id and status='ACTIVA';
  if v_recipe is null then raise exception 'El producto no tiene receta activa'; end if;
  insert into public.production_batches(output_product_id,recipe_id,output_quantity_base,notes,created_by)
  values(p_product_id,v_recipe,p_output_quantity_base,p_notes,auth.uid()) returning id into v_batch;

  for req in
    select r.inventory_product_id,sum(r.quantity_base) quantity_base
    from public.recipe_items ri
    cross join lateral private.product_requirements(ri.ingredient_product_id,(p_output_quantity_base*ri.quantity_base/v_recipe_output)) r
    where ri.recipe_id=v_recipe
    group by r.inventory_product_id
    order by r.inventory_product_id
  loop
    select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=req.inventory_product_id for update;
    if v_on is null or v_on-v_res<req.quantity_base then raise exception 'Stock insuficiente para producir'; end if;
    update public.inventory_balances set on_hand=v_on-req.quantity_base,updated_at=now() where product_id=req.inventory_product_id;
    insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,created_by)
    values(req.inventory_product_id,'PRODUCTION_OUT',-req.quantity_base,'PRODUCTION',v_batch::text,'PRODUCCION',auth.uid());
  end loop;

  select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=p_product_id for update;
  if v_on is null then insert into public.inventory_balances(product_id,on_hand,reserved) values(p_product_id,0,0) returning on_hand,reserved into v_on,v_res; end if;
  update public.inventory_balances set on_hand=coalesce(v_on,0)+p_output_quantity_base,updated_at=now() where product_id=p_product_id;
  insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,created_by)
  values(p_product_id,'PRODUCTION_IN',p_output_quantity_base,'PRODUCTION',v_batch::text,'PRODUCCION',auth.uid());
  return v_batch;
end;
$$;

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'INFO' check(severity in ('INFO','WARNING','ERROR')),
  event_type text not null,
  title text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists system_events_open_idx on public.system_events(resolved,created_at desc);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text not null,
  template_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDIENTE' check(status in ('PENDIENTE','ENVIADO','ERROR')),
  external_id text,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RLS Y PERMISOS
-- ============================================================

do $$ declare t text; begin
  foreach t in array array['profiles','products','product_variants','recipes','recipe_items','inventory_balances','inventory_movements','stock_counts','stock_count_items','customers','orders','order_items','purchases','purchase_items','production_batches','system_events','email_outbox','app_settings'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Limpiar políticas conocidas para poder ejecutar el script varias veces.
do $$ declare pol record; begin
  for pol in select schemaname,tablename,policyname from pg_policies where schemaname='public' and policyname like 'pt_%' loop
    execute format('drop policy if exists %I on %I.%I',pol.policyname,pol.schemaname,pol.tablename);
  end loop;
end $$;

create policy pt_profiles_self on public.profiles for select to authenticated using(id=auth.uid());
create policy pt_products_read on public.products for select to authenticated using(private.is_active_user());
create policy pt_products_admin_all on public.products for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));
create policy pt_variants_read on public.product_variants for select to authenticated using(private.is_active_user());
create policy pt_variants_admin_all on public.product_variants for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));
create policy pt_recipes_read on public.recipes for select to authenticated using(private.is_active_user());
create policy pt_recipes_admin_all on public.recipes for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));
create policy pt_recipe_items_read on public.recipe_items for select to authenticated using(private.is_active_user());
create policy pt_recipe_items_admin_all on public.recipe_items for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));
create policy pt_balances_read on public.inventory_balances for select to authenticated using(private.is_active_user());
create policy pt_movements_read on public.inventory_movements for select to authenticated using(private.is_active_user());
create policy pt_counts_read on public.stock_counts for select to authenticated using(private.is_active_user());
create policy pt_count_items_read on public.stock_count_items for select to authenticated using(private.is_active_user());
create policy pt_customers_read on public.customers for select to authenticated using(private.is_active_user());
create policy pt_customers_write on public.customers for all to authenticated using(private.has_role(array['ADMIN','VENTAS'])) with check(private.has_role(array['ADMIN','VENTAS']));
create policy pt_orders_read on public.orders for select to authenticated using(private.is_active_user());
create policy pt_orders_write on public.orders for insert to authenticated with check(private.has_role(array['ADMIN','OPERADOR','VENTAS']));
create policy pt_order_items_read on public.order_items for select to authenticated using(private.is_active_user());
create policy pt_order_items_write on public.order_items for insert to authenticated with check(private.has_role(array['ADMIN','OPERADOR','VENTAS']));
create policy pt_purchases_read on public.purchases for select to authenticated using(private.is_active_user());
create policy pt_purchases_write on public.purchases for all to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
create policy pt_purchase_items_read on public.purchase_items for select to authenticated using(private.is_active_user());
create policy pt_purchase_items_write on public.purchase_items for all to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
create policy pt_production_read on public.production_batches for select to authenticated using(private.is_active_user());
create policy pt_production_write on public.production_batches for all to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
create policy pt_events_read on public.system_events for select to authenticated using(private.is_active_user());
create policy pt_email_read on public.email_outbox for select to authenticated using(private.is_active_user());
create policy pt_settings_read on public.app_settings for select to authenticated using(private.is_active_user());
create policy pt_settings_admin on public.app_settings for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));

-- Grants. RLS sigue siendo la barrera real.
grant usage on schema public to authenticated;
grant select on public.product_stock_overview to authenticated;
grant select on public.profiles,public.products,public.product_variants,public.recipes,public.recipe_items,public.inventory_balances,public.inventory_movements,public.stock_counts,public.stock_count_items,public.customers,public.orders,public.order_items,public.purchases,public.purchase_items,public.production_batches,public.system_events,public.email_outbox,public.app_settings to authenticated;
grant insert,update,delete on public.products,public.product_variants,public.recipes,public.recipe_items,public.customers,public.purchases,public.purchase_items,public.production_batches,public.app_settings to authenticated;
grant insert on public.orders,public.order_items to authenticated;

revoke all on function public.create_product(text,text,text,text,text) from public,anon;
revoke all on function public.adjust_stock(uuid,numeric,text,text) from public,anon;
revoke all on function public.apply_stock_count(jsonb,text) from public,anon;
revoke all on function public.product_available_base(uuid) from public,anon;
revoke all on function public.reserve_order(uuid) from public,anon;
revoke all on function public.release_order_reservation(uuid) from public,anon;
revoke all on function public.consume_order_stock(uuid) from public,anon;
revoke all on function public.set_order_status(uuid,text) from public,anon;
revoke all on function public.quick_receive_purchase(text,uuid,numeric,numeric,text) from public,anon;
revoke all on function public.produce_product(uuid,numeric,text) from public,anon;

grant execute on function public.create_product(text,text,text,text,text) to authenticated;
grant execute on function public.adjust_stock(uuid,numeric,text,text) to authenticated;
grant execute on function public.apply_stock_count(jsonb,text) to authenticated;
grant execute on function public.product_available_base(uuid) to authenticated;
grant execute on function public.reserve_order(uuid) to authenticated;
grant execute on function public.release_order_reservation(uuid) to authenticated;
grant execute on function public.consume_order_stock(uuid) to authenticated;
grant execute on function public.set_order_status(uuid,text) to authenticated;
grant execute on function public.quick_receive_purchase(text,uuid,numeric,numeric,text) to authenticated;
grant execute on function public.produce_product(uuid,numeric,text) to authenticated;

commit;


-- ============================================================
-- PECÁN TIGRE · EXTENSIÓN OPERATIVA 2026-09
-- Catálogo Tiendanube, compras completas, ventas manuales,
-- proveedores, fórmulas, costos, remitos y producción v2.
-- No elimina tablas ni datos existentes.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- PRODUCTOS Y VARIANTES: CAMPOS COMERCIALES / TIENDANUBE
-- ------------------------------------------------------------
alter table public.products add column if not exists description text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists visible boolean not null default true;
alter table public.products add column if not exists published boolean not null default true;
alter table public.products add column if not exists tiendanube_handle text;
alter table public.products add column if not exists tiendanube_last_sync_at timestamptz;
alter table public.products add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists products_tiendanube_handle_unique on public.products(tiendanube_handle) where tiendanube_handle is not null;
create index if not exists products_kind_active_idx on public.products(product_kind,active);
create index if not exists products_inventory_mode_active_idx on public.products(inventory_mode,active);

alter table public.product_variants add column if not exists promo_price numeric(14,2);
alter table public.product_variants add column if not exists cost numeric(14,4);
alter table public.product_variants add column if not exists height_cm numeric(14,3);
alter table public.product_variants add column if not exists width_cm numeric(14,3);
alter table public.product_variants add column if not exists depth_cm numeric(14,3);
alter table public.product_variants add column if not exists tiendanube_stock numeric(14,3);
alter table public.product_variants add column if not exists barcode text;
alter table public.product_variants add column if not exists visible boolean not null default true;
alter table public.product_variants add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists product_variants_product_active_idx on public.product_variants(product_id,active);

create or replace view public.product_stock_overview
with (security_invoker = true)
as
select p.id, p.code, p.name, p.product_kind, p.inventory_mode, p.base_unit,
       p.minimum_stock, p.current_cost, p.image_url, p.tiendanube_product_id,
       p.active, p.created_at, p.updated_at,
       ib.on_hand, ib.reserved,
       case when p.inventory_mode = 'DERIVADO' then public.product_available_base(p.id) else coalesce(ib.available,0) end as available_base,
       p.description, p.category, p.visible, p.published, p.tiendanube_handle,
       p.tiendanube_last_sync_at, p.metadata
from public.products p
left join public.inventory_balances ib on ib.product_id = p.id;

-- ------------------------------------------------------------
-- CLIENTES / PROVEEDORES
-- ------------------------------------------------------------
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists tax_id text;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_id text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_name_unique_ci on public.suppliers(lower(name));
drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- COMPRAS Y COSTOS
-- ------------------------------------------------------------
alter table public.purchases add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.purchases add column if not exists purchase_date date not null default current_date;
alter table public.purchases add column if not exists document_number text;
alter table public.purchases add column if not exists products_total numeric(14,2) not null default 0;
alter table public.purchases add column if not exists shipping_cost numeric(14,2) not null default 0;
alter table public.purchases add column if not exists other_costs numeric(14,2) not null default 0;
alter table public.purchases add column if not exists distribute_general_costs boolean not null default true;
alter table public.purchases add column if not exists idempotency_key text;
create unique index if not exists purchases_idempotency_unique on public.purchases(idempotency_key) where idempotency_key is not null;
create index if not exists purchases_supplier_date_idx on public.purchases(supplier_id,created_at desc);

alter table public.purchase_items add column if not exists discount numeric(14,2) not null default 0;
alter table public.purchase_items add column if not exists allocated_general_cost numeric(14,2) not null default 0;
alter table public.purchase_items add column if not exists effective_unit_cost numeric(14,4);
create index if not exists purchase_items_product_idx on public.purchase_items(product_id,created_at desc);

create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  source_type text not null,
  source_id text,
  previous_cost numeric(14,4),
  new_cost numeric(14,4) not null,
  effective_unit_cost numeric(14,4),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists product_cost_history_product_date_idx on public.product_cost_history(product_id,created_at desc);

-- ------------------------------------------------------------
-- VENTAS / PEDIDOS
-- ------------------------------------------------------------
alter table public.orders add column if not exists channel text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists shipping_charge numeric(14,2) not null default 0;
alter table public.orders add column if not exists shipping_cost_actual numeric(14,2) not null default 0;
alter table public.orders add column if not exists cost_total numeric(14,2) not null default 0;
alter table public.orders add column if not exists profit numeric(14,2) not null default 0;
alter table public.orders add column if not exists margin_percentage numeric(9,3) not null default 0;
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_unique on public.orders(idempotency_key) where idempotency_key is not null;
create index if not exists orders_customer_created_idx on public.orders(customer_id,created_at desc);

alter table public.order_items add column if not exists discount numeric(14,2) not null default 0;
alter table public.order_items add column if not exists cost_total numeric(14,2) not null default 0;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('NUEVO','CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO','ENTREGADO','CANCELADO')) not valid;
alter table public.orders validate constraint orders_status_check;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  notes text,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_date_idx on public.order_status_history(order_id,created_at desc);

create or replace function private.audit_order_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.order_status_history(order_id,old_status,new_status,changed_by)
    values(new.id,null,new.status,auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history(order_id,old_status,new_status,changed_by)
    values(new.id,old.status,new.status,auth.uid());
  end if;
  return new;
end; $$;
drop trigger if exists orders_status_audit on public.orders;
create trigger orders_status_audit after insert or update of status on public.orders for each row execute function private.audit_order_status();

create sequence if not exists public.manual_order_seq start 1;

-- ------------------------------------------------------------
-- RECETAS / FÓRMULAS / PRODUCCIÓN
-- ------------------------------------------------------------
alter table public.recipes add column if not exists packaging_cost numeric(14,2) not null default 0;
alter table public.recipes add column if not exists labor_cost numeric(14,2) not null default 0;
alter table public.recipes add column if not exists energy_cost numeric(14,2) not null default 0;
alter table public.recipes add column if not exists other_costs numeric(14,2) not null default 0;
alter table public.recipes add column if not exists prep_minutes numeric(14,2) not null default 0;
alter table public.recipes add column if not exists cook_minutes numeric(14,2) not null default 0;
alter table public.recipes add column if not exists hourly_cost numeric(14,2) not null default 0;

alter table public.production_batches add column if not exists waste_quantity numeric(14,3) not null default 0;
alter table public.production_batches add column if not exists actual_cost numeric(14,2);
alter table public.production_batches add column if not exists actual_unit_cost numeric(14,4);

create table if not exists public.formula_drafts (
  id uuid primary key default gen_random_uuid(),
  formula_type text not null check(formula_type in ('COMBO','MIX','ELABORADO')),
  name text not null,
  payload jsonb not null,
  status text not null default 'BORRADOR' check(status in ('BORRADOR','CONVERTIDO','ARCHIVADO')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists formula_drafts_set_updated_at on public.formula_drafts;
create trigger formula_drafts_set_updated_at before update on public.formula_drafts for each row execute function public.set_updated_at();
create index if not exists formula_drafts_type_date_idx on public.formula_drafts(formula_type,created_at desc);

-- ------------------------------------------------------------
-- IMPORTACIONES TIENDANUBE
-- ------------------------------------------------------------
create table if not exists public.catalog_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'TIENDANUBE_CSV',
  products_new integer not null default 0,
  products_updated integer not null default 0,
  variants_new integer not null default 0,
  variants_updated integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- VISTAS DE NEGOCIO
-- ------------------------------------------------------------
create or replace view public.supplier_overview with (security_invoker=true) as
select s.*,
       max(p.received_at) filter(where p.status='RECIBIDA') as last_purchase_at,
       coalesce(sum(p.total) filter(where p.status='RECIBIDA'),0) as total_purchased,
       count(p.id) filter(where p.status='RECIBIDA') as purchase_count
from public.suppliers s
left join public.purchases p on p.supplier_id=s.id
group by s.id;

create or replace view public.customer_overview with (security_invoker=true) as
select c.*,
       min(o.created_at) filter(where o.status<>'CANCELADO') as first_purchase_at,
       max(o.created_at) filter(where o.status<>'CANCELADO') as last_purchase_at,
       coalesce(sum(o.total) filter(where o.status<>'CANCELADO'),0) as total_purchased,
       count(o.id) filter(where o.status<>'CANCELADO') as order_count,
       coalesce(avg(o.total) filter(where o.status<>'CANCELADO'),0) as average_ticket
from public.customers c
left join public.orders o on o.customer_id=c.id
group by c.id;

-- ------------------------------------------------------------
-- IMPORTAR CATÁLOGO TIENDANUBE (JSON NORMALIZADO POR LA APP)
-- ------------------------------------------------------------
create or replace function public.import_tiendanube_catalog(p_products jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_p jsonb; v_v jsonb; v_product_id uuid; v_variant_id uuid;
  v_new_p int:=0; v_upd_p int:=0; v_new_v int:=0; v_upd_v int:=0;
  v_handle text; v_name text; v_sku text; v_mode text; v_kind text; v_unit text;
  v_import uuid;
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_products)<>'array' then raise exception 'Formato de importación inválido'; end if;

  for v_p in select * from jsonb_array_elements(p_products) loop
    v_handle:=nullif(trim(v_p->>'handle'),''); v_name:=nullif(trim(v_p->>'name'),'');
    if v_handle is null or v_name is null then raise exception 'Producto sin Identificador de URL o nombre'; end if;
    v_kind:=coalesce(v_p->>'product_kind','INSUMO');
    v_mode:=coalesce(v_p->>'inventory_mode','PROPIO');
    v_unit:=coalesce(v_p->>'base_unit','g');

    select id into v_product_id from public.products where tiendanube_handle=v_handle limit 1;
    if v_product_id is null then
      select pv.product_id into v_product_id
      from jsonb_array_elements(coalesce(v_p->'variants','[]'::jsonb)) x
      join public.product_variants pv on pv.sku=x->>'sku'
      where nullif(x->>'sku','') is not null limit 1;
    end if;

    if v_product_id is null then
      insert into public.products(name,product_kind,inventory_mode,base_unit,description,category,visible,published,tiendanube_handle,metadata)
      values(v_name,v_kind,v_mode,v_unit,nullif(v_p->>'description',''),nullif(v_p->>'category',''),coalesce((v_p->>'visible')::boolean,true),coalesce((v_p->>'published')::boolean,true),v_handle,
             jsonb_build_object('tags',v_p->>'tags','brand',v_p->>'brand','seo_title',v_p->>'seo_title','seo_description',v_p->>'seo_description'))
      returning id into v_product_id;
      if v_mode in ('PROPIO','PRODUCIDO') then insert into public.inventory_balances(product_id,on_hand,reserved) values(v_product_id,0,0) on conflict do nothing; end if;
      v_new_p:=v_new_p+1;
    else
      update public.products set name=v_name,description=coalesce(nullif(v_p->>'description',''),description),category=coalesce(nullif(v_p->>'category',''),category),
        product_kind=v_kind,inventory_mode=v_mode,base_unit=v_unit,visible=coalesce((v_p->>'visible')::boolean,visible),published=coalesce((v_p->>'published')::boolean,published),
        tiendanube_handle=v_handle,metadata=metadata||jsonb_build_object('tags',v_p->>'tags','brand',v_p->>'brand','seo_title',v_p->>'seo_title','seo_description',v_p->>'seo_description')
      where id=v_product_id;
      if v_mode in ('PROPIO','PRODUCIDO') then insert into public.inventory_balances(product_id,on_hand,reserved) values(v_product_id,0,0) on conflict do nothing; end if;
      v_upd_p:=v_upd_p+1;
    end if;

    for v_v in select * from jsonb_array_elements(coalesce(v_p->'variants','[]'::jsonb)) loop
      v_sku:=nullif(trim(v_v->>'sku'),''); if v_sku is null then continue; end if;
      select id into v_variant_id from public.product_variants where sku=v_sku limit 1;
      if v_variant_id is null then
        insert into public.product_variants(product_id,name,sku,base_quantity,price,promo_price,cost,shipping_weight_g,height_cm,width_cm,depth_cm,tiendanube_stock,barcode,active,visible)
        values(v_product_id,coalesce(nullif(v_v->>'name',''),'Única'),v_sku,greatest(coalesce((v_v->>'base_quantity')::numeric,1),0.001),coalesce((v_v->>'price')::numeric,0),
               nullif(v_v->>'promo_price','')::numeric,nullif(v_v->>'cost','')::numeric,nullif(v_v->>'weight_g','')::numeric,nullif(v_v->>'height_cm','')::numeric,
               nullif(v_v->>'width_cm','')::numeric,nullif(v_v->>'depth_cm','')::numeric,nullif(v_v->>'stock','')::numeric,nullif(v_v->>'barcode',''),
               coalesce((v_v->>'active')::boolean,true),coalesce((v_v->>'visible')::boolean,true));
        v_new_v:=v_new_v+1;
      else
        update public.product_variants set product_id=v_product_id,name=coalesce(nullif(v_v->>'name',''),name),base_quantity=greatest(coalesce((v_v->>'base_quantity')::numeric,base_quantity),0.001),
          price=coalesce((v_v->>'price')::numeric,price),promo_price=nullif(v_v->>'promo_price','')::numeric,cost=nullif(v_v->>'cost','')::numeric,
          shipping_weight_g=nullif(v_v->>'weight_g','')::numeric,height_cm=nullif(v_v->>'height_cm','')::numeric,width_cm=nullif(v_v->>'width_cm','')::numeric,
          depth_cm=nullif(v_v->>'depth_cm','')::numeric,tiendanube_stock=nullif(v_v->>'stock','')::numeric,barcode=coalesce(nullif(v_v->>'barcode',''),barcode),
          active=coalesce((v_v->>'active')::boolean,active),visible=coalesce((v_v->>'visible')::boolean,visible)
        where id=v_variant_id;
        v_upd_v:=v_upd_v+1;
      end if;
    end loop;
  end loop;

  insert into public.catalog_imports(products_new,products_updated,variants_new,variants_updated,created_by)
  values(v_new_p,v_upd_p,v_new_v,v_upd_v,auth.uid()) returning id into v_import;
  return jsonb_build_object('import_id',v_import,'products_new',v_new_p,'products_updated',v_upd_p,'variants_new',v_new_v,'variants_updated',v_upd_v,'errors','[]'::jsonb);
end; $$;

-- ------------------------------------------------------------
-- COMPRA MULTILÍNEA ATÓMICA
-- ------------------------------------------------------------
create or replace function public.receive_purchase(p_payload jsonb)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_purchase uuid; v_supplier uuid; v_supplier_name text; v_item jsonb; v_item_id uuid; v_pid uuid;
  v_qty numeric; v_unit_cost numeric; v_discount numeric; v_line numeric; v_products_total numeric:=0;
  v_shipping numeric:=coalesce((p_payload->>'shipping_cost')::numeric,0); v_other numeric:=coalesce((p_payload->>'other_costs')::numeric,0);
  v_general numeric; v_alloc numeric; v_effective numeric; v_on numeric; v_res numeric; v_old numeric; v_new numeric; v_mode text;
  v_distribute boolean:=coalesce((p_payload->>'distribute_general_costs')::boolean,true); v_idem text:=nullif(p_payload->>'idempotency_key','');
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if v_idem is not null then select id into v_purchase from public.purchases where idempotency_key=v_idem; if v_purchase is not null then return v_purchase; end if; end if;
  v_supplier:=nullif(p_payload->>'supplier_id','')::uuid; v_supplier_name:=nullif(trim(p_payload->>'supplier_name'),'');
  if v_supplier is null then
    if v_supplier_name is null then raise exception 'Proveedor requerido'; end if;
    select id into v_supplier from public.suppliers where lower(name)=lower(v_supplier_name) limit 1;
    if v_supplier is null then insert into public.suppliers(name) values(v_supplier_name) returning id into v_supplier; end if;
  else select name into v_supplier_name from public.suppliers where id=v_supplier; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_qty:=coalesce((v_item->>'quantity_base')::numeric,0); v_unit_cost:=coalesce((v_item->>'unit_cost')::numeric,0); v_discount:=coalesce((v_item->>'discount')::numeric,0);
    if v_qty<=0 or v_unit_cost<0 or v_discount<0 then raise exception 'Línea de compra inválida'; end if;
    v_products_total:=v_products_total+greatest(v_qty*v_unit_cost-v_discount,0);
  end loop;
  if v_products_total<=0 then raise exception 'La compra no tiene líneas válidas'; end if;
  v_general:=v_shipping+v_other;

  insert into public.purchases(supplier_id,supplier_name,status,total,products_total,shipping_cost,other_costs,distribute_general_costs,document_number,notes,received_at,created_by,idempotency_key)
  values(v_supplier,v_supplier_name,'RECIBIDA',v_products_total+v_general,v_products_total,v_shipping,v_other,v_distribute,nullif(p_payload->>'document_number',''),nullif(p_payload->>'notes',''),now(),auth.uid(),v_idem)
  returning id into v_purchase;

  for v_item in select * from jsonb_array_elements(p_payload->'items') order by (value->>'product_id') loop
    v_pid:=(v_item->>'product_id')::uuid; v_qty:=(v_item->>'quantity_base')::numeric; v_unit_cost:=(v_item->>'unit_cost')::numeric; v_discount:=coalesce((v_item->>'discount')::numeric,0);
    v_line:=greatest(v_qty*v_unit_cost-v_discount,0); v_alloc:=case when v_distribute and v_products_total>0 then v_general*(v_line/v_products_total) else 0 end;
    v_effective:=(v_line+v_alloc)/v_qty;
    select inventory_mode,current_cost into v_mode,v_old from public.products where id=v_pid for update;
    if v_mode is null or v_mode='DERIVADO' then raise exception 'La compra contiene un producto sin stock físico'; end if;
    select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=v_pid for update;
    if v_on is null then insert into public.inventory_balances(product_id,on_hand,reserved) values(v_pid,0,0) returning on_hand,reserved into v_on,v_res; end if;
    v_new:=case when v_on+v_qty>0 then ((v_on*coalesce(v_old,0))+(v_qty*v_effective))/(v_on+v_qty) else v_effective end;
    insert into public.purchase_items(purchase_id,product_id,quantity_base,unit_cost,discount,allocated_general_cost,effective_unit_cost,total_cost)
    values(v_purchase,v_pid,v_qty,v_unit_cost,v_discount,v_alloc,v_effective,v_line+v_alloc) returning id into v_item_id;
    update public.inventory_balances set on_hand=v_on+v_qty,updated_at=now() where product_id=v_pid;
    update public.products set current_cost=v_new where id=v_pid;
    insert into public.product_cost_history(product_id,source_type,source_id,previous_cost,new_cost,effective_unit_cost,metadata,created_by)
    values(v_pid,'PURCHASE',v_purchase::text,v_old,v_new,v_effective,jsonb_build_object('purchase_item_id',v_item_id),auth.uid());
    insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,idempotency_key,metadata,created_by)
    values(v_pid,'PURCHASE',v_qty,'PURCHASE',v_purchase::text,'COMPRA',format('PURCHASE:%s:%s',v_purchase,v_item_id),jsonb_build_object('supplier',v_supplier_name,'effective_unit_cost',v_effective),auth.uid()) on conflict(idempotency_key) do nothing;
  end loop;
  return v_purchase;
end; $$;

-- ------------------------------------------------------------
-- VENTA MANUAL ATÓMICA + RESERVA
-- ------------------------------------------------------------
create or replace function public.create_manual_order(p_payload jsonb)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_order uuid; v_customer uuid; v_item jsonb; v_pid uuid; v_vid uuid; v_qty int; v_price numeric; v_discount numeric;
  v_pname text; v_vname text; v_sku text; v_base numeric; v_costbase numeric; v_line numeric; v_cost numeric;
  v_subtotal numeric:=0; v_cost_total numeric:=0; v_shipping_charge numeric:=coalesce((p_payload->>'shipping_charge')::numeric,0);
  v_shipping_actual numeric:=coalesce((p_payload->>'shipping_cost_actual')::numeric,0); v_total numeric; v_profit numeric; v_margin numeric;
  v_order_number text; v_status text:=coalesce(nullif(p_payload->>'status',''),'CONFIRMADO'); v_idem text:=nullif(p_payload->>'idempotency_key','');
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  if v_idem is not null then select id into v_order from public.orders where idempotency_key=v_idem; if v_order is not null then return v_order; end if; end if;
  v_customer:=nullif(p_payload->>'customer_id','')::uuid;
  if v_customer is null then
    if nullif(trim(p_payload->>'customer_name'),'') is null then raise exception 'Cliente requerido'; end if;
    insert into public.customers(name,email,phone,address,source)
    values(trim(p_payload->>'customer_name'),nullif(p_payload->>'customer_email',''),nullif(p_payload->>'customer_phone',''),nullif(p_payload->>'shipping_address',''),'MANUAL') returning id into v_customer;
  else
    update public.customers set email=coalesce(nullif(p_payload->>'customer_email',''),email),phone=coalesce(nullif(p_payload->>'customer_phone',''),phone),address=coalesce(nullif(p_payload->>'shipping_address',''),address) where id=v_customer;
  end if;
  v_order_number:='V-'||lpad(nextval('public.manual_order_seq')::text,6,'0');
  insert into public.orders(source,order_number,customer_id,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,status,payment_status,channel,payment_method,shipping_method,shipping_address,shipping_charge,shipping_cost,shipping_cost_actual,notes,idempotency_key)
  select 'MANUAL',v_order_number,c.id,c.name,c.email,c.phone,'NUEVO',coalesce(nullif(p_payload->>'payment_status',''),'PENDIENTE'),nullif(p_payload->>'channel',''),nullif(p_payload->>'payment_method',''),nullif(p_payload->>'shipping_method',''),
         case when nullif(p_payload->>'shipping_address','') is null then null else jsonb_build_object('address',p_payload->>'shipping_address') end,v_shipping_charge,v_shipping_charge,v_shipping_actual,nullif(p_payload->>'notes',''),v_idem
  from public.customers c where c.id=v_customer returning id into v_order;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_pid:=(v_item->>'product_id')::uuid; v_vid:=(v_item->>'variant_id')::uuid; v_qty:=coalesce((v_item->>'quantity')::int,0); v_price:=coalesce((v_item->>'unit_price')::numeric,0); v_discount:=coalesce((v_item->>'discount')::numeric,0);
    if v_qty<=0 or v_price<0 then raise exception 'Línea de venta inválida'; end if;
    select p.name,p.current_cost,pv.name,pv.sku,pv.base_quantity into v_pname,v_costbase,v_vname,v_sku,v_base from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=v_vid and p.id=v_pid and pv.active=true;
    if v_base is null then raise exception 'Variante inválida'; end if;
    v_line:=greatest(v_price*v_qty-v_discount,0); v_cost:=coalesce(v_costbase,0)*v_base*v_qty;
    insert into public.order_items(order_id,product_id,variant_id,product_name_snapshot,variant_name_snapshot,sku_snapshot,quantity,base_quantity_per_unit,unit_price,discount,total_price,cost_total)
    values(v_order,v_pid,v_vid,v_pname,v_vname,v_sku,v_qty,v_base,v_price,v_discount,v_line,v_cost);
    v_subtotal:=v_subtotal+v_line; v_cost_total:=v_cost_total+v_cost;
  end loop;
  if not exists(select 1 from public.order_items where order_id=v_order) then raise exception 'La venta no tiene productos'; end if;
  v_total:=v_subtotal+v_shipping_charge; v_cost_total:=v_cost_total+v_shipping_actual; v_profit:=v_total-v_cost_total; v_margin:=case when v_total>0 then v_profit/v_total*100 else 0 end;
  update public.orders set subtotal=v_subtotal,total=v_total,cost_total=v_cost_total,profit=v_profit,margin_percentage=v_margin where id=v_order;
  if v_status<>'NUEVO' then perform public.set_order_status(v_order,v_status); end if;
  return v_order;
end; $$;

-- Extiende el workflow del pedido para ENTREGADO.
create or replace function public.set_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_current text; v_inventory text;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  if p_status not in ('NUEVO','CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO','ENTREGADO','CANCELADO') then raise exception 'Estado inválido'; end if;
  select status,inventory_state into v_current,v_inventory from public.orders where id=p_order_id for update;
  if v_current is null then raise exception 'Pedido inexistente'; end if;
  if p_status in ('CONFIRMADO','PREPARANDO','PREPARADO','ENVIADO','ENTREGADO') and v_inventory in ('PENDIENTE','RELEASED','ERROR') then perform public.reserve_order(p_order_id); select inventory_state into v_inventory from public.orders where id=p_order_id; end if;
  if p_status='CANCELADO' and v_inventory='RESERVED' then perform public.release_order_reservation(p_order_id); end if;
  if p_status in ('ENVIADO','ENTREGADO') and v_inventory='RESERVED' then perform public.consume_order_stock(p_order_id); end if;
  update public.orders set status=p_status,
    shipping_status=case when p_status='PREPARADO' then 'LISTO' when p_status='ENVIADO' then 'DESPACHADO' when p_status='ENTREGADO' then 'ENTREGADO' else shipping_status end
  where id=p_order_id;
end; $$;

-- ------------------------------------------------------------
-- BORRADORES Y CREACIÓN DE COMBO / MIX / ELABORADO
-- ------------------------------------------------------------
create or replace function public.save_formula_draft(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_type text:=upper(coalesce(p_payload->>'type','')); v_name text:=nullif(trim(p_payload->>'name'),'');
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Sin permiso'; end if;
  if v_type not in ('COMBO','MIX','ELABORADO') or v_name is null then raise exception 'Borrador inválido'; end if;
  insert into public.formula_drafts(formula_type,name,payload,created_by) values(v_type,v_name,p_payload,auth.uid()) returning id into v_id; return v_id;
end; $$;

create or replace function public.create_formula_product(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid; v_recipe uuid; v_type text:=upper(coalesce(p_payload->>'type','')); v_name text:=nullif(trim(p_payload->>'name'),'');
  v_mode text; v_unit text; v_output numeric; v_total_cost numeric:=coalesce((p_payload->>'total_cost')::numeric,0); v_price numeric:=coalesce((p_payload->>'proposed_price')::numeric,0);
  v_component jsonb; v_multiplier jsonb; v_n int;
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Sin permiso'; end if;
  if v_type not in ('COMBO','MIX','ELABORADO') or v_name is null then raise exception 'Fórmula inválida'; end if;
  v_mode:=case when v_type='ELABORADO' then 'PRODUCIDO' else 'DERIVADO' end; v_unit:=case when v_type='COMBO' then 'u' else 'g' end;
  v_output:=case when v_type='COMBO' then 1 else greatest(coalesce((p_payload->>'output_quantity_base')::numeric,0),0.001) end;
  insert into public.products(name,product_kind,inventory_mode,base_unit,current_cost,active,visible,published)
  values(v_name,v_type,v_mode,v_unit,case when v_output>0 then v_total_cost/v_output else 0 end,true,true,false) returning id into v_id;
  if v_mode='PRODUCIDO' then insert into public.inventory_balances(product_id,on_hand,reserved) values(v_id,0,0) on conflict do nothing; end if;
  insert into public.recipes(output_product_id,name,status,output_quantity_base,waste_percentage,packaging_cost,labor_cost,energy_cost,other_costs,prep_minutes,cook_minutes,hourly_cost)
  values(v_id,'Receta de '||v_name,'ACTIVA',v_output,coalesce((p_payload->>'waste_percentage')::numeric,0),coalesce((p_payload->>'packaging_cost')::numeric,0),coalesce((p_payload->>'labor_cost')::numeric,0),coalesce((p_payload->>'energy_cost')::numeric,0),coalesce((p_payload->>'other_costs')::numeric,0),coalesce((p_payload->>'prep_minutes')::numeric,0),coalesce((p_payload->>'cook_minutes')::numeric,0),coalesce((p_payload->>'hourly_cost')::numeric,0)) returning id into v_recipe;
  for v_component in select * from jsonb_array_elements(coalesce(p_payload->'components','[]'::jsonb)) loop
    insert into public.recipe_items(recipe_id,ingredient_product_id,quantity_base)
    values(v_recipe,(v_component->>'product_id')::uuid,(v_component->>'quantity_base')::numeric);
  end loop;
  if not exists(select 1 from public.recipe_items where recipe_id=v_recipe) then raise exception 'La fórmula no tiene componentes'; end if;

  if v_type='COMBO' then
    for v_multiplier in select * from jsonb_array_elements(coalesce(p_payload->'variant_multipliers','[1]'::jsonb)) loop
      v_n:=(v_multiplier#>>'{}')::int; if v_n>0 then insert into public.product_variants(product_id,name,base_quantity,price,active,visible) values(v_id,case when v_n=1 then '1 unidad' else v_n||' unidades' end,v_n,v_price*v_n,true,true); end if;
    end loop;
  elsif v_type='MIX' then
    foreach v_n in array array[100,250,500,1000] loop
      insert into public.product_variants(product_id,name,base_quantity,price,active,visible)
      values(v_id,case when v_n=1000 then '1 kg' else v_n||' g' end,v_n,case when v_output>0 then v_price*v_n/v_output else 0 end,true,true);
    end loop;
  else
    insert into public.product_variants(product_id,name,base_quantity,price,active,visible) values(v_id,'Presentación inicial',v_output,v_price,true,true);
  end if;
  return v_id;
end; $$;

-- ------------------------------------------------------------
-- PRODUCCIÓN V2: MERMA Y COSTO REAL
-- ------------------------------------------------------------
create or replace function public.produce_product_v2(p_product_id uuid,p_output_quantity_base numeric,p_waste_quantity numeric,p_actual_cost numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_mode text; v_recipe uuid; v_recipe_output numeric; v_batch uuid; req record; v_on numeric; v_res numeric; v_needed numeric; v_calc_cost numeric:=0; v_final_cost numeric; v_old_cost numeric;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if p_output_quantity_base<=0 or coalesce(p_waste_quantity,0)<0 then raise exception 'Cantidad inválida'; end if;
  select inventory_mode,current_cost into v_mode,v_old_cost from public.products where id=p_product_id for update;
  if v_mode<>'PRODUCIDO' then raise exception 'El producto no está configurado como PRODUCIDO'; end if;
  select id,output_quantity_base into v_recipe,v_recipe_output from public.recipes where output_product_id=p_product_id and status='ACTIVA'; if v_recipe is null then raise exception 'El producto no tiene receta activa'; end if;
  v_needed:=p_output_quantity_base+coalesce(p_waste_quantity,0);
  insert into public.production_batches(output_product_id,recipe_id,output_quantity_base,waste_quantity,actual_cost,notes,created_by)
  values(p_product_id,v_recipe,p_output_quantity_base,coalesce(p_waste_quantity,0),p_actual_cost,p_notes,auth.uid()) returning id into v_batch;
  for req in
    select r.inventory_product_id,sum(r.quantity_base) quantity_base
    from public.recipe_items ri cross join lateral private.product_requirements(ri.ingredient_product_id,(v_needed*ri.quantity_base/v_recipe_output)) r
    where ri.recipe_id=v_recipe group by r.inventory_product_id order by r.inventory_product_id
  loop
    select ib.on_hand,ib.reserved into v_on,v_res from public.inventory_balances ib where ib.product_id=req.inventory_product_id for update;
    if v_on is null or v_on-v_res<req.quantity_base then raise exception 'Stock insuficiente para producir'; end if;
    v_calc_cost:=v_calc_cost + req.quantity_base*coalesce((select current_cost from public.products where id=req.inventory_product_id),0);
    update public.inventory_balances set on_hand=v_on-req.quantity_base,updated_at=now() where product_id=req.inventory_product_id;
    insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,idempotency_key,created_by)
    values(req.inventory_product_id,'PRODUCTION_OUT',-req.quantity_base,'PRODUCTION',v_batch::text,'PRODUCCION',format('PROD:%s:OUT:%s',v_batch,req.inventory_product_id),auth.uid()) on conflict(idempotency_key) do nothing;
  end loop;
  select on_hand,reserved into v_on,v_res from public.inventory_balances where product_id=p_product_id for update;
  if v_on is null then insert into public.inventory_balances(product_id,on_hand,reserved) values(p_product_id,0,0) returning on_hand,reserved into v_on,v_res; end if;
  update public.inventory_balances set on_hand=coalesce(v_on,0)+p_output_quantity_base,updated_at=now() where product_id=p_product_id;
  insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reference_type,reference_id,reason,idempotency_key,metadata,created_by)
  values(p_product_id,'PRODUCTION_IN',p_output_quantity_base,'PRODUCTION',v_batch::text,'PRODUCCION',format('PROD:%s:IN:%s',v_batch,p_product_id),jsonb_build_object('waste_quantity',coalesce(p_waste_quantity,0)),auth.uid()) on conflict(idempotency_key) do nothing;
  select v_calc_cost + r.packaging_cost+r.labor_cost+r.energy_cost+r.other_costs into v_calc_cost from public.recipes r where r.id=v_recipe;
  v_final_cost:=coalesce(nullif(p_actual_cost,0),v_calc_cost);
  update public.production_batches set actual_cost=v_final_cost,actual_unit_cost=v_final_cost/p_output_quantity_base where id=v_batch;
  update public.products set current_cost=v_final_cost/p_output_quantity_base where id=p_product_id;
  insert into public.product_cost_history(product_id,source_type,source_id,previous_cost,new_cost,effective_unit_cost,metadata,created_by)
  values(p_product_id,'PRODUCTION',v_batch::text,v_old_cost,v_final_cost/p_output_quantity_base,v_final_cost/p_output_quantity_base,jsonb_build_object('waste_quantity',coalesce(p_waste_quantity,0)),auth.uid());
  return v_batch;
end; $$;

-- ------------------------------------------------------------
-- SEGURIDAD / RLS DE LAS NUEVAS TABLAS
-- ------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['suppliers','product_cost_history','order_status_history','formula_drafts','catalog_imports'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

do $$ declare pol record; begin
  for pol in select schemaname,tablename,policyname from pg_policies where schemaname='public' and policyname like 'pt2_%' loop
    execute format('drop policy if exists %I on %I.%I',pol.policyname,pol.schemaname,pol.tablename);
  end loop;
end $$;
create policy pt2_profiles_admin_read on public.profiles for select to authenticated using(id=auth.uid() or private.has_role(array['ADMIN']));
create policy pt2_suppliers_read on public.suppliers for select to authenticated using(private.is_active_user());
create policy pt2_suppliers_write on public.suppliers for all to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
create policy pt2_cost_history_read on public.product_cost_history for select to authenticated using(private.is_active_user());
create policy pt2_order_history_read on public.order_status_history for select to authenticated using(private.is_active_user());
create policy pt2_formula_drafts_read on public.formula_drafts for select to authenticated using(private.has_role(array['ADMIN']));
create policy pt2_formula_drafts_write on public.formula_drafts for all to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));
create policy pt2_catalog_imports_read on public.catalog_imports for select to authenticated using(private.has_role(array['ADMIN']));

grant select on public.supplier_overview,public.customer_overview to authenticated;
grant select on public.suppliers,public.product_cost_history,public.order_status_history,public.formula_drafts,public.catalog_imports to authenticated;
grant insert,update,delete on public.suppliers,public.formula_drafts to authenticated;

revoke all on function public.import_tiendanube_catalog(jsonb) from public,anon;
revoke all on function public.receive_purchase(jsonb) from public,anon;
revoke all on function public.create_manual_order(jsonb) from public,anon;
revoke all on function public.save_formula_draft(jsonb) from public,anon;
revoke all on function public.create_formula_product(jsonb) from public,anon;
revoke all on function public.produce_product_v2(uuid,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.import_tiendanube_catalog(jsonb) to authenticated;
grant execute on function public.receive_purchase(jsonb) to authenticated;
grant execute on function public.create_manual_order(jsonb) to authenticated;
grant execute on function public.save_formula_draft(jsonb) to authenticated;
grant execute on function public.create_formula_product(jsonb) to authenticated;
grant execute on function public.produce_product_v2(uuid,numeric,numeric,numeric,text) to authenticated;

commit;

-- Verificación rápida al final del mismo script (solo SELECT; no modifica datos).
select 'products' objeto, count(*) cantidad from public.products
union all select 'product_variants',count(*) from public.product_variants
union all select 'inventory_movements',count(*) from public.inventory_movements
union all select 'suppliers',count(*) from public.suppliers
union all select 'orders',count(*) from public.orders
union all select 'purchases',count(*) from public.purchases;

-- ============================================================
-- CARGA MASIVA PROPIA (formato interno validado por la app)
-- ============================================================
begin;

create or replace function public.import_internal_catalog(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_existing_by_sku uuid;
  v_kind text;
  v_mode text;
  v_unit text;
  v_code text;
  v_sku text;
  v_name text;
  v_variant_name text;
  v_products_created integer := 0;
  v_products_updated integer := 0;
  v_variants_upserted integer := 0;
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'No hay filas para importar'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name := nullif(trim(v_row->>'name'),'');
    v_code := nullif(trim(v_row->>'code'),'');
    v_sku := nullif(trim(v_row->>'sku'),'');
    v_variant_name := coalesce(nullif(trim(v_row->>'variant_name'),''),'Presentación base');
    v_kind := upper(coalesce(nullif(trim(v_row->>'product_kind'),''),'INSUMO'));
    v_mode := upper(coalesce(nullif(trim(v_row->>'inventory_mode'),''),'PROPIO'));
    v_unit := lower(coalesce(nullif(trim(v_row->>'base_unit'),''),'g'));

    if v_name is null then raise exception 'Hay una fila sin nombre'; end if;
    if v_kind not in ('INSUMO','MIX','ELABORADO','COMBO') then raise exception 'Tipo inválido: %',v_kind; end if;
    if v_mode not in ('PROPIO','DERIVADO','PRODUCIDO') then raise exception 'Modo de inventario inválido: %',v_mode; end if;
    if v_unit not in ('g','ml','u') then raise exception 'Unidad base inválida: %',v_unit; end if;
    if coalesce((v_row->>'base_quantity')::numeric,0) <= 0 then raise exception 'Cantidad base inválida para %',v_name; end if;

    v_product_id := null;
    v_existing_by_sku := null;

    if v_code is not null then
      select id into v_product_id from public.products where code=v_code limit 1;
    end if;
    if v_sku is not null then
      select product_id into v_existing_by_sku from public.product_variants where sku=v_sku limit 1;
      if v_product_id is not null and v_existing_by_sku is not null and v_existing_by_sku <> v_product_id then
        raise exception 'El SKU % ya pertenece a otro producto',v_sku;
      end if;
      v_product_id := coalesce(v_product_id,v_existing_by_sku);
    end if;
    if v_product_id is null and v_code is null and v_sku is null then
      select id into v_product_id from public.products where lower(name)=lower(v_name) limit 1;
    end if;

    if v_product_id is null then
      insert into public.products(name,code,product_kind,inventory_mode,base_unit,current_cost,minimum_stock,active,visible,published)
      values(v_name,v_code,v_kind,v_mode,v_unit,greatest(coalesce((v_row->>'current_cost')::numeric,0),0),greatest(coalesce((v_row->>'minimum_stock')::numeric,0),0),true,true,false)
      returning id into v_product_id;
      v_products_created := v_products_created + 1;
    else
      update public.products
      set name=v_name,
          code=coalesce(v_code,code),
          product_kind=v_kind,
          inventory_mode=v_mode,
          base_unit=v_unit,
          current_cost=greatest(coalesce((v_row->>'current_cost')::numeric,current_cost),0),
          minimum_stock=greatest(coalesce((v_row->>'minimum_stock')::numeric,minimum_stock),0),
          updated_at=now()
      where id=v_product_id;
      v_products_updated := v_products_updated + 1;
    end if;

    if v_mode in ('PROPIO','PRODUCIDO') then
      insert into public.inventory_balances(product_id,on_hand,reserved) values(v_product_id,0,0) on conflict(product_id) do nothing;
    end if;

    v_variant_id := null;
    if v_sku is not null then
      select id into v_variant_id from public.product_variants where sku=v_sku limit 1;
    else
      select id into v_variant_id
      from public.product_variants
      where product_id=v_product_id and lower(name)=lower(v_variant_name)
      order by created_at limit 1;
    end if;

    if v_variant_id is null then
      insert into public.product_variants(product_id,name,sku,base_quantity,price,cost,active,visible)
      values(v_product_id,v_variant_name,v_sku,(v_row->>'base_quantity')::numeric,greatest(coalesce((v_row->>'price')::numeric,0),0),greatest(coalesce((v_row->>'current_cost')::numeric,0),0),true,true);
    else
      update public.product_variants
      set name=v_variant_name,
          base_quantity=(v_row->>'base_quantity')::numeric,
          price=greatest(coalesce((v_row->>'price')::numeric,price),0),
          cost=greatest(coalesce((v_row->>'current_cost')::numeric,cost),0),
          active=true,
          updated_at=now()
      where id=v_variant_id;
    end if;
    v_variants_upserted := v_variants_upserted + 1;
  end loop;

  return jsonb_build_object(
    'products_created',v_products_created,
    'products_updated',v_products_updated,
    'variants_upserted',v_variants_upserted
  );
end;
$$;

revoke all on function public.import_internal_catalog(jsonb) from public,anon;
grant execute on function public.import_internal_catalog(jsonb) to authenticated;

commit;
