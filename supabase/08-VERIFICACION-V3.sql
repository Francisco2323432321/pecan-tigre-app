-- PECÁN TIGRE V3 · VERIFICACIÓN (solo lectura)
select 'usuarios' as objeto,count(*) as cantidad from public.profiles
union all select 'admins',count(*) from public.profiles where role='ADMIN'
union all select 'operadores',count(*) from public.profiles where role='OPERADOR'
union all select 'productos',count(*) from public.products
union all select 'variantes_activas',count(*) from public.product_variants where active=true
union all select 'sku_duplicados',count(*) from (select upper(sku) from public.product_variants where sku is not null and trim(sku)<>'' group by upper(sku) having count(*)>1) d
union all select 'productos_sin_foto',count(*) from public.products where active=true and coalesce(trim(image_url),'')=''
union all select 'recetas_activas_sin_ingredientes',count(*) from public.recipes r where r.status='ACTIVA' and not exists(select 1 from public.recipe_items ri where ri.recipe_id=r.id)
union all select 'movimientos_stock',count(*) from public.inventory_movements
union all select 'ventas',count(*) from public.orders
union all select 'compras',count(*) from public.purchases;

select key,value from public.app_settings where key in ('alerts','brand_identity') order by key;
