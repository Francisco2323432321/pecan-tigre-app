-- PECÁN TIGRE V3 · LIMPIEZA SEGURA
-- No elimina auth.users, profiles, productos, ventas, compras ni movimientos históricos.
-- Ejecutar ANTES de 07-v3-operational.sql.
begin;

-- 1) El rol VENTAS deja de existir en V3. Los usuarios se conservan y pasan a OPERADOR.
update public.profiles set role = 'OPERADOR' where role = 'VENTAS';

-- 2) Tabla de prueba inicial, si todavía existe.
drop table if exists public.prueba;

-- 3) Archivar presentaciones antiguas de productos por peso cuando existe la presentación de 100 g.
-- No se borran: pueden estar referenciadas por pedidos históricos.
update public.product_variants pv
set active = false, visible = false, updated_at = now()
from public.products p
where p.id = pv.product_id
  and p.base_unit = 'g'
  and pv.base_quantity <> 100
  and exists (
    select 1 from public.product_variants keep
    where keep.product_id = p.id and keep.base_quantity = 100
  );

-- 4) Resolver eventos informativos antiguos ya cerrados sin tocar los abiertos.
delete from public.system_events
where resolved = true
  and coalesce(resolved_at, created_at) < now() - interval '180 days';

commit;

select 'usuarios_conservados' as control, count(*)::text as valor from public.profiles
union all select 'productos', count(*)::text from public.products
union all select 'ventas', count(*)::text from public.orders
union all select 'movimientos_stock', count(*)::text from public.inventory_movements;
