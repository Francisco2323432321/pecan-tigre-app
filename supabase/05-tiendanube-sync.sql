-- Pecán Tigre · integración operativa Tiendanube
-- Ejecutar una vez en Supabase SQL Editor. Es idempotente.

create table if not exists public.tiendanube_order_links (
  store_id text not null,
  tiendanube_order_id text not null,
  local_order_id uuid null,
  status text not null default 'PROCESSING',
  last_event text null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, tiendanube_order_id)
);

alter table public.tiendanube_order_links enable row level security;

create or replace function public.get_tiendanube_connection_status()
returns table (store_id text, connected_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select tc.store_id, tc.connected_at
  from public.tiendanube_connections tc
  order by tc.connected_at desc
  limit 1;
$$;
revoke all on function public.get_tiendanube_connection_status() from public;
grant execute on function public.get_tiendanube_connection_status() to authenticated;

create or replace function public.update_tiendanube_stock_cache(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer := 0;
begin
  update public.product_variants pv
  set tiendanube_stock = data.stock,
      updated_at = now()
  from (
    select x.id::uuid as id, x.stock
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, stock numeric)
  ) data
  where pv.id = data.id;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
revoke all on function public.update_tiendanube_stock_cache(jsonb) from public;
grant execute on function public.update_tiendanube_stock_cache(jsonb) to service_role;

create or replace function public.sync_tiendanube_catalog_bulk(p_variants jsonb, p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variants_updated integer := 0;
  v_products_updated integer := 0;
begin
  update public.product_variants pv
  set tiendanube_variant_id = data.tiendanube_variant_id,
      tiendanube_stock = data.tiendanube_stock
  from (
    select x.id::uuid as id, x.tiendanube_variant_id, x.tiendanube_stock
    from jsonb_to_recordset(coalesce(p_variants, '[]'::jsonb)) as x(
      id text,
      tiendanube_variant_id text,
      tiendanube_stock numeric
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
    select x.id::uuid as id, x.tiendanube_product_id, x.tiendanube_handle, x.image_url
    from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as x(
      id text,
      tiendanube_product_id text,
      tiendanube_handle text,
      image_url text
    )
  ) data
  where p.id = data.id;
  get diagnostics v_products_updated = row_count;

  return jsonb_build_object(
    'variants_updated', v_variants_updated,
    'products_updated', v_products_updated
  );
end;
$$;
revoke all on function public.sync_tiendanube_catalog_bulk(jsonb, jsonb) from public;
grant execute on function public.sync_tiendanube_catalog_bulk(jsonb, jsonb) to service_role;
