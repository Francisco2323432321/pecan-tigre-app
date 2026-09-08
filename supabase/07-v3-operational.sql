-- PECÁN TIGRE V3 · OPERACIÓN, ALERTAS, STOCK, SKU Y PERMISOS
-- Idempotente. No elimina usuarios ni datos operativos.
begin;

-- ============================================================
-- ROLES: sólo ADMIN / OPERADOR
-- ============================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('ADMIN','OPERADOR')) not valid;
update public.profiles set role='OPERADOR' where role not in ('ADMIN','OPERADOR');
alter table public.profiles validate constraint profiles_role_check;

create or replace function private.can_operate_or_system()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.role()='service_role' or private.has_role(array['ADMIN','OPERADOR']); $$;

grant execute on function private.can_operate_or_system() to authenticated;


-- ============================================================
-- RLS V3: ADMIN y OPERADOR trabajan; configuración sensible queda ADMIN
-- ============================================================
drop policy if exists pt_products_admin_all on public.products;
drop policy if exists pt3_products_write on public.products;
create policy pt3_products_write on public.products for all to authenticated
  using(private.has_role(array['ADMIN','OPERADOR']))
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_variants_admin_all on public.product_variants;
drop policy if exists pt3_variants_write on public.product_variants;
create policy pt3_variants_write on public.product_variants for all to authenticated
  using(private.has_role(array['ADMIN','OPERADOR']))
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_recipes_admin_all on public.recipes;
drop policy if exists pt3_recipes_write on public.recipes;
create policy pt3_recipes_write on public.recipes for all to authenticated
  using(private.has_role(array['ADMIN','OPERADOR']))
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_recipe_items_admin_all on public.recipe_items;
drop policy if exists pt3_recipe_items_write on public.recipe_items;
create policy pt3_recipe_items_write on public.recipe_items for all to authenticated
  using(private.has_role(array['ADMIN','OPERADOR']))
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_customers_write on public.customers;
drop policy if exists pt3_customers_write on public.customers;
create policy pt3_customers_write on public.customers for all to authenticated
  using(private.has_role(array['ADMIN','OPERADOR']))
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_orders_write on public.orders;
drop policy if exists pt3_orders_insert on public.orders;
create policy pt3_orders_insert on public.orders for insert to authenticated
  with check(private.has_role(array['ADMIN','OPERADOR']));

drop policy if exists pt_order_items_write on public.order_items;
drop policy if exists pt3_order_items_insert on public.order_items;
create policy pt3_order_items_insert on public.order_items for insert to authenticated
  with check(private.has_role(array['ADMIN','OPERADOR']));

-- ============================================================
-- SKU AUTOMÁTICO
-- ============================================================
create or replace function public.next_sku_v3(p_name text)
returns text language plpgsql security definer set search_path=public as $$
declare
  v_clean text;
  v_prefix text;
  v_n integer := 1;
  v_sku text;
begin
  v_clean := upper(regexp_replace(translate(coalesce(p_name,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),'[^A-Z0-9]','','g'));
  v_prefix := substring(v_clean from 1 for 3);
  if length(v_prefix) < 2 then v_prefix := 'PRD'; end if;
  loop
    v_sku := 'FS-' || rpad(v_prefix,3,'X') || '-' || lpad(v_n::text,2,'0');
    exit when not exists(select 1 from public.product_variants where upper(coalesce(sku,''))=upper(v_sku));
    v_n := v_n + 1;
    if v_n > 999 then raise exception 'No se pudo generar un SKU único'; end if;
  end loop;
  return v_sku;
end; $$;

create or replace function public.create_product_v3(
  p_name text,
  p_code text default null,
  p_product_kind text default 'INSUMO',
  p_inventory_mode text default 'PROPIO',
  p_base_unit text default 'g',
  p_sku text default null,
  p_price numeric default 0
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_sku text; v_q numeric; v_label text;
begin
  if auth.uid() is null or not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permisos para crear productos'; end if;
  if p_base_unit not in ('g','u') then raise exception 'Unidad inválida'; end if;
  if p_product_kind not in ('INSUMO','MIX','ELABORADO','COMBO') then raise exception 'Tipo inválido'; end if;
  if p_inventory_mode not in ('PROPIO','DERIVADO','PRODUCIDO') then raise exception 'Modo de stock inválido'; end if;
  v_sku := nullif(trim(coalesce(p_sku,'')),'');
  if v_sku is null then v_sku := public.next_sku_v3(p_name); end if;
  if exists(select 1 from public.product_variants where upper(coalesce(sku,''))=upper(v_sku)) then raise exception 'El SKU % ya existe', v_sku; end if;
  v_q := case when p_base_unit='g' then 100 else 1 end;
  v_label := case when p_base_unit='g' then '100 g' else 'Unidad' end;
  insert into public.products(name,code,product_kind,inventory_mode,base_unit,active,visible,published)
  values(trim(p_name),nullif(trim(coalesce(p_code,'')),''),p_product_kind,p_inventory_mode,p_base_unit,true,true,false) returning id into v_id;
  insert into public.product_variants(product_id,name,sku,base_quantity,price,active,visible)
  values(v_id,v_label,v_sku,v_q,greatest(coalesce(p_price,0),0),true,true);
  if p_inventory_mode in ('PROPIO','PRODUCIDO') then
    insert into public.inventory_balances(product_id,on_hand,reserved) values(v_id,0,0) on conflict(product_id) do nothing;
  end if;
  return v_id;
end; $$;
revoke all on function public.create_product_v3(text,text,text,text,text,text,numeric) from public,anon;
grant execute on function public.create_product_v3(text,text,text,text,text,text,numeric) to authenticated;


-- Fórmulas V3: una sola presentación comercial (100 g o Unidad) + SKU automático.
create or replace function public.save_formula_draft(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_type text:=upper(coalesce(p_payload->>'type','')); v_name text:=nullif(trim(p_payload->>'name'),'');
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if v_type not in ('COMBO','MIX','ELABORADO') or v_name is null then raise exception 'Borrador inválido'; end if;
  insert into public.formula_drafts(formula_type,name,payload,created_by) values(v_type,v_name,p_payload,auth.uid()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.create_formula_product(p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid; v_recipe uuid; v_type text:=upper(coalesce(p_payload->>'type','')); v_name text:=nullif(trim(p_payload->>'name'),'');
  v_mode text; v_unit text; v_output numeric; v_total_cost numeric:=coalesce((p_payload->>'total_cost')::numeric,0); v_price numeric:=coalesce((p_payload->>'proposed_price')::numeric,0);
  v_component jsonb; v_base numeric; v_sale_price numeric; v_sku text;
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  if v_type not in ('COMBO','MIX','ELABORADO') or v_name is null then raise exception 'Fórmula inválida'; end if;
  v_mode:=case when v_type='ELABORADO' then 'PRODUCIDO' else 'DERIVADO' end;
  v_unit:=case when v_type='COMBO' then 'u' else 'g' end;
  v_output:=case when v_type='COMBO' then 1 else greatest(coalesce((p_payload->>'output_quantity_base')::numeric,0),0.001) end;
  v_base:=case when v_unit='g' then 100 else 1 end;
  v_sale_price:=case when v_unit='g' and v_output>0 then v_price*v_base/v_output else v_price end;
  v_sku:=public.next_sku_v3(v_name);
  insert into public.products(name,product_kind,inventory_mode,base_unit,current_cost,active,visible,published)
  values(v_name,v_type,v_mode,v_unit,case when v_output>0 then v_total_cost/v_output else 0 end,true,true,false) returning id into v_id;
  if v_mode='PRODUCIDO' then insert into public.inventory_balances(product_id,on_hand,reserved) values(v_id,0,0) on conflict(product_id) do nothing; end if;
  insert into public.recipes(output_product_id,name,status,output_quantity_base,waste_percentage,packaging_cost,labor_cost,energy_cost,other_costs,prep_minutes,cook_minutes,hourly_cost)
  values(v_id,'Receta de '||v_name,'ACTIVA',v_output,coalesce((p_payload->>'waste_percentage')::numeric,0),coalesce((p_payload->>'packaging_cost')::numeric,0),coalesce((p_payload->>'labor_cost')::numeric,0),coalesce((p_payload->>'energy_cost')::numeric,0),coalesce((p_payload->>'other_costs')::numeric,0),coalesce((p_payload->>'prep_minutes')::numeric,0),coalesce((p_payload->>'cook_minutes')::numeric,0),coalesce((p_payload->>'hourly_cost')::numeric,0)) returning id into v_recipe;
  for v_component in select * from jsonb_array_elements(coalesce(p_payload->'components','[]'::jsonb)) loop
    insert into public.recipe_items(recipe_id,ingredient_product_id,quantity_base)
    values(v_recipe,(v_component->>'product_id')::uuid,(v_component->>'quantity_base')::numeric);
  end loop;
  if not exists(select 1 from public.recipe_items where recipe_id=v_recipe) then raise exception 'La fórmula no tiene componentes'; end if;
  insert into public.product_variants(product_id,name,sku,base_quantity,price,active,visible)
  values(v_id,case when v_unit='g' then '100 g' else 'Unidad' end,v_sku,v_base,greatest(v_sale_price,0),true,true);
  return v_id;
end; $$;

-- Garantiza balance al cambiar un producto de derivado a stock físico.
create or replace function private.ensure_product_balance_v3()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.inventory_mode in ('PROPIO','PRODUCIDO') then
    insert into public.inventory_balances(product_id,on_hand,reserved) values(new.id,0,0) on conflict(product_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists products_ensure_balance_v3 on public.products;
create trigger products_ensure_balance_v3 after insert or update of inventory_mode on public.products for each row execute function private.ensure_product_balance_v3();


-- Alta segura para productos nuevos detectados en Tiendanube (una sola variante).
create or replace function public.import_tiendanube_product_v3(
  p_name text,
  p_tiendanube_product_id text,
  p_tiendanube_variant_id text,
  p_sku text default null,
  p_price numeric default 0,
  p_image_url text default null,
  p_handle text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_sku text;
begin
  if auth.role() <> 'service_role' then raise exception 'Solo servicio'; end if;
  select id into v_id from public.products where tiendanube_product_id=p_tiendanube_product_id limit 1;
  if v_id is not null then return v_id; end if;
  v_sku:=nullif(trim(coalesce(p_sku,'')),'');
  if v_sku is null or exists(select 1 from public.product_variants where upper(coalesce(sku,''))=upper(v_sku)) then v_sku:=public.next_sku_v3(p_name); end if;
  insert into public.products(name,product_kind,inventory_mode,base_unit,image_url,tiendanube_product_id,tiendanube_handle,active,visible,published,metadata)
  values(trim(p_name),'INSUMO','PROPIO','g',nullif(p_image_url,''),p_tiendanube_product_id,nullif(p_handle,''),true,true,false,jsonb_build_object('source','TIENDANUBE','needs_review',true,'imported_at',now())) returning id into v_id;
  insert into public.product_variants(product_id,name,sku,base_quantity,price,tiendanube_variant_id,active,visible)
  values(v_id,'100 g',v_sku,100,greatest(coalesce(p_price,0),0),p_tiendanube_variant_id,true,true);
  insert into public.inventory_balances(product_id,on_hand,reserved) values(v_id,0,0) on conflict(product_id) do nothing;
  insert into public.system_events(severity,event_type,title,message,details)
  values('INFO','TIENDANUBE_PRODUCT_CREATED','Producto nuevo de Tiendanube',format('%s fue importado automáticamente y requiere revisión de tipo/unidad.',trim(p_name)),jsonb_build_object('product_id',v_id,'tiendanube_product_id',p_tiendanube_product_id));
  return v_id;
end; $$;
revoke all on function public.import_tiendanube_product_v3(text,text,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.import_tiendanube_product_v3(text,text,text,text,numeric,text,text) to service_role;

create or replace function public.mark_product_reviewed_v3(p_product_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not private.has_role(array['ADMIN','OPERADOR']) then raise exception 'Sin permiso'; end if;
  update public.products set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('needs_review',false,'reviewed_at',now()) where id=p_product_id;
end; $$;
revoke all on function public.mark_product_reviewed_v3(uuid) from public,anon;
grant execute on function public.mark_product_reviewed_v3(uuid) to authenticated;

-- ============================================================
-- STOCK RÁPIDO: DELTA O ESTABLECER VALOR
-- ============================================================
create or replace function public.apply_stock_changes_v3(p_items jsonb, p_notes text default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_item jsonb; v_id uuid; v_mode text; v_value numeric; v_before numeric; v_reserved numeric; v_after numeric; v_count integer:=0;
begin
  if not private.can_operate_or_system() then raise exception 'Sin permiso'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_id := (v_item->>'product_id')::uuid;
    v_mode := upper(coalesce(v_item->>'mode','DELTA'));
    v_value := coalesce((v_item->>'value')::numeric,0);
    select on_hand,reserved into v_before,v_reserved from public.inventory_balances where product_id=v_id for update;
    if v_before is null then raise exception 'El producto % no maneja stock físico', v_id; end if;
    if v_mode='DELTA' then v_after := v_before + v_value;
    elsif v_mode='SET' then v_after := v_value;
    else raise exception 'Modo de stock inválido'; end if;
    if v_after < 0 then raise exception 'El stock no puede quedar negativo'; end if;
    if v_after < v_reserved then raise exception 'El stock contado no puede quedar por debajo de lo reservado (%).', v_reserved; end if;
    if v_after = v_before then continue; end if;
    update public.inventory_balances set on_hand=v_after,updated_at=now() where product_id=v_id;
    insert into public.inventory_movements(product_id,movement_type,on_hand_delta,reason,metadata,created_by)
    values(v_id,case when v_mode='SET' then 'STOCK_SET' else 'ADJUSTMENT' end,v_after-v_before,coalesce(nullif(p_notes,''),'Stock rápido'),jsonb_build_object('mode',v_mode,'previous_on_hand',v_before,'new_on_hand',v_after,'entered_value',v_value),auth.uid());
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.apply_stock_changes_v3(jsonb,text) from public,anon;
grant execute on function public.apply_stock_changes_v3(jsonb,text) to authenticated;

-- ============================================================
-- ALERTAS: configuración + ignorar por fingerprint
-- ============================================================
create table if not exists public.alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  fingerprint text not null,
  dismissed_by uuid references public.profiles(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  unique(alert_key,fingerprint)
);
alter table public.alert_dismissals enable row level security;
drop policy if exists pt3_alerts_read on public.alert_dismissals;
drop policy if exists pt3_alerts_write on public.alert_dismissals;
create policy pt3_alerts_read on public.alert_dismissals for select to authenticated using(private.is_active_user());
create policy pt3_alerts_write on public.alert_dismissals for all to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
grant select,insert,update,delete on public.alert_dismissals to authenticated;

insert into public.app_settings(key,value) values('alerts',jsonb_build_object('minimum_margin_percentage',20)) on conflict(key) do nothing;

-- ============================================================
-- ADMINISTRACIÓN DE ROLES
-- ============================================================
create or replace function public.set_profile_role_v3(p_profile_id uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
declare v_old text; v_admins integer;
begin
  if not private.has_role(array['ADMIN']) then raise exception 'Solo ADMIN puede cambiar roles'; end if;
  if p_role not in ('ADMIN','OPERADOR') then raise exception 'Rol inválido'; end if;
  select role into v_old from public.profiles where id=p_profile_id for update;
  if v_old is null then raise exception 'Usuario inexistente'; end if;
  if v_old='ADMIN' and p_role='OPERADOR' then
    select count(*) into v_admins from public.profiles where role='ADMIN' and active=true;
    if v_admins <= 1 then raise exception 'No se puede quitar el último ADMIN'; end if;
  end if;
  update public.profiles set role=p_role,updated_at=now() where id=p_profile_id;
  insert into public.system_events(severity,event_type,title,message,details)
  values('INFO','ROLE_CHANGED','Permiso actualizado','Se cambió el rol de un usuario.',jsonb_build_object('profile_id',p_profile_id,'old_role',v_old,'new_role',p_role,'changed_by',auth.uid()));
end; $$;
revoke all on function public.set_profile_role_v3(uuid,text) from public,anon;
grant execute on function public.set_profile_role_v3(uuid,text) to authenticated;

drop policy if exists pt3_profiles_admin_update on public.profiles;
create policy pt3_profiles_admin_update on public.profiles for update to authenticated using(private.has_role(array['ADMIN'])) with check(private.has_role(array['ADMIN']));

-- ============================================================
-- IDENTIDAD VISUAL EN STORAGE
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('brand','brand',true,2097152,array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

insert into public.app_settings(key,value) values('brand_identity','{}'::jsonb) on conflict(key) do nothing;

-- ============================================================
-- ÍNDICES/PROTECCIONES ÚTILES
-- ============================================================
do $$ begin
  if not exists (select 1 from (select upper(trim(sku)) s,count(*) c from public.product_variants where sku is not null and trim(sku)<>'' group by upper(trim(sku)) having count(*)>1) d) then
    execute $sql$create unique index if not exists product_variants_sku_unique_ci_v3 on public.product_variants(upper(trim(sku))) where sku is not null and trim(sku) <> ''$sql$;
  else
    insert into public.system_events(severity,event_type,title,message) values('ERROR','DUPLICATE_SKU','SKU duplicados','No se creó el índice de SKU sin distinción de mayúsculas porque existen duplicados. Resolvelos desde Errores y alertas.');
  end if;
end $$;

drop policy if exists pt3_events_update on public.system_events;
create policy pt3_events_update on public.system_events for update to authenticated using(private.has_role(array['ADMIN','OPERADOR'])) with check(private.has_role(array['ADMIN','OPERADOR']));
grant update on public.system_events to authenticated;

commit;
