-- Pecán Tigre · productos simples 100 g / unidad + observación Tiendanube + Finanzas
-- Ejecutar UNA vez en Supabase SQL Editor antes de desplegar esta versión.

-- 1) Alta simple: cada producto nuevo nace con una única opción comercial.
create or replace function public.create_simple_product(
  p_name text,
  p_code text default null,
  p_product_kind text default 'INSUMO',
  p_inventory_mode text default 'PROPIO',
  p_base_unit text default 'g',
  p_sku text default null,
  p_price numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_quantity numeric;
  v_variant_name text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'ADMIN'
  ) then
    raise exception 'Sin permisos para crear productos';
  end if;

  if p_base_unit not in ('g', 'u') then
    raise exception 'La unidad actual debe ser g o u';
  end if;

  v_quantity := case when p_base_unit = 'g' then 100 else 1 end;
  v_variant_name := case when p_base_unit = 'g' then '100 g' else 'Unidad' end;

  insert into public.products (
    name, code, product_kind, inventory_mode, base_unit, active, visible, published
  ) values (
    trim(p_name), nullif(trim(coalesce(p_code, '')), ''), p_product_kind, p_inventory_mode, p_base_unit, true, true, false
  ) returning id into v_product_id;

  insert into public.product_variants (
    product_id, name, sku, base_quantity, price, active, visible
  ) values (
    v_product_id,
    v_variant_name,
    nullif(trim(coalesce(p_sku, '')), ''),
    v_quantity,
    greatest(coalesce(p_price, 0), 0),
    true,
    true
  );

  return v_product_id;
end;
$$;

revoke all on function public.create_simple_product(text,text,text,text,text,text,numeric) from public;
grant execute on function public.create_simple_product(text,text,text,text,text,text,numeric) to authenticated;

-- 2) Vista técnica no sensible de variantes observadas en Tiendanube.
-- No controla inventario; sirve para detectar futuras variantes antes de sincronizarlas mal.
create table if not exists public.tiendanube_variant_observations (
  store_id text not null,
  tiendanube_product_id text not null,
  tiendanube_variant_id text not null,
  linked_local_product_id uuid null references public.products(id) on delete set null,
  sku text null,
  stock numeric null,
  option_label text null,
  seen_at timestamptz not null default now(),
  primary key (store_id, tiendanube_variant_id)
);

create index if not exists tiendanube_variant_observations_local_product_idx
  on public.tiendanube_variant_observations(linked_local_product_id);

alter table public.tiendanube_variant_observations enable row level security;
drop policy if exists "authenticated read tiendanube observations" on public.tiendanube_variant_observations;
create policy "authenticated read tiendanube observations"
  on public.tiendanube_variant_observations
  for select to authenticated
  using (true);

create or replace function public.replace_tiendanube_variant_observations(p_store_id text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  delete from public.tiendanube_variant_observations where store_id = p_store_id;

  insert into public.tiendanube_variant_observations (
    store_id,
    tiendanube_product_id,
    tiendanube_variant_id,
    linked_local_product_id,
    sku,
    stock,
    option_label,
    seen_at
  )
  select
    p_store_id,
    x.tiendanube_product_id,
    x.tiendanube_variant_id,
    nullif(x.linked_local_product_id, '')::uuid,
    nullif(x.sku, ''),
    x.stock,
    nullif(x.option_label, ''),
    now()
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(
    tiendanube_product_id text,
    tiendanube_variant_id text,
    linked_local_product_id text,
    sku text,
    stock numeric,
    option_label text
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.replace_tiendanube_variant_observations(text,jsonb) from public;
grant execute on function public.replace_tiendanube_variant_observations(text,jsonb) to service_role;

-- 3) Reemplaza la sincronización de catálogo existente conservando la firma.
-- Prioridad: vínculo estable por ID Tiendanube, luego SKU. Cuando Tiendanube deja un
-- solo SKU en un producto, las presentaciones locales antiguas quedan archivadas.
create or replace function public.sync_tiendanube_catalog_bulk(p_variants jsonb, p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variants_updated integer := 0;
  v_products_updated integer := 0;
  v_variants_archived integer := 0;
begin
  -- Limpiar vínculos anteriores sólo dentro de los productos que estamos relincando.
  update public.product_variants pv
  set tiendanube_variant_id = null,
      tiendanube_stock = null
  where exists (
    select 1
    from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as p(id text, tiendanube_product_id text, tiendanube_handle text, image_url text, variant_count integer)
    where pv.product_id = p.id::uuid
  );

  update public.product_variants pv
  set tiendanube_variant_id = data.tiendanube_variant_id,
      tiendanube_stock = data.tiendanube_stock,
      sku = coalesce(nullif(data.sku, ''), pv.sku),
      active = true
  from (
    select x.id::uuid as id, x.tiendanube_variant_id, x.tiendanube_stock, x.sku
    from jsonb_to_recordset(coalesce(p_variants, '[]'::jsonb)) as x(
      id text,
      tiendanube_variant_id text,
      tiendanube_stock numeric,
      sku text
    )
  ) data
  where pv.id = data.id;
  get diagnostics v_variants_updated = row_count;

  update public.products p
  set tiendanube_product_id = data.tiendanube_product_id,
      tiendanube_handle = coalesce(data.tiendanube_handle, p.tiendanube_handle),
      image_url = coalesce(data.image_url, p.image_url),
      tiendanube_last_sync_at = now()
  from (
    select x.id::uuid as id, x.tiendanube_product_id, x.tiendanube_handle, x.image_url, x.variant_count
    from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as x(
      id text,
      tiendanube_product_id text,
      tiendanube_handle text,
      image_url text,
      variant_count integer
    )
  ) data
  where p.id = data.id;
  get diagnostics v_products_updated = row_count;

  -- Si Tiendanube ahora tiene UNA sola variante, archivamos las presentaciones locales
  -- que ya no existen allí. No se borran para preservar historial de pedidos.
  update public.product_variants pv
  set active = false,
      visible = false
  where pv.tiendanube_variant_id is null
    and exists (
      select 1
      from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as p(id text, tiendanube_product_id text, tiendanube_handle text, image_url text, variant_count integer)
      where pv.product_id = p.id::uuid and coalesce(p.variant_count, 0) = 1
    );
  get diagnostics v_variants_archived = row_count;

  return jsonb_build_object(
    'variants_updated', v_variants_updated,
    'products_updated', v_products_updated,
    'variants_archived', v_variants_archived
  );
end;
$$;
revoke all on function public.sync_tiendanube_catalog_bulk(jsonb,jsonb) from public;
grant execute on function public.sync_tiendanube_catalog_bulk(jsonb,jsonb) to service_role;

-- 4) Primer paso de Finanzas: conexión segura a Mercado Pago por OAuth.
create table if not exists public.mercadopago_connections (
  account_user_id text primary key,
  access_token text not null,
  refresh_token text null,
  token_type text null,
  scope text null,
  public_key text null,
  expires_at timestamptz null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercadopago_connections enable row level security;
-- Sin policy de lectura: los tokens sólo se acceden con service_role desde el servidor.

create or replace function public.get_mercadopago_connection_status()
returns table (account_user_id text, connected_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'ADMIN'
  ) then
    return;
  end if;

  return query
  select c.account_user_id, c.connected_at, c.expires_at
  from public.mercadopago_connections c
  order by c.connected_at desc
  limit 1;
end;
$$;
revoke all on function public.get_mercadopago_connection_status() from public;
grant execute on function public.get_mercadopago_connection_status() to authenticated;
