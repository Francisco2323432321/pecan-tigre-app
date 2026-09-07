# Cambios de UI — versión analítica

## Qué se mejoró
- Rediseño global con estética más avanzada, limpia y con mejor contraste.
- Sidebar desktop y navegación mobile renovadas.
- Dashboard de inicio con:
  - métricas clave,
  - accesos rápidos,
  - gráfico de ventas de 7 días,
  - composición del catálogo,
  - foco de reposición,
  - pedidos a preparar,
  - alertas del sistema.
- Página de Finanzas con:
  - KPIs más claros,
  - gráfico de flujo ventas vs compras,
  - bloque de Mercado Pago más prolijo,
  - ranking visual de productos para reponer.
- Listado de productos renovado con mejor jerarquía visual y barra de salud de stock.
- Botones y campos unificados para dar una sensación más profesional.

## Archivos principales tocados
- `app/globals.css`
- `components/app-navigation.tsx`
- `components/ui/page-header.tsx`
- `components/ui/section-nav.tsx`
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/finanzas/page.tsx`
- `components/products/product-list.tsx`
- `components/tiendanube/sync-products-button.tsx`
- `components/tiendanube/sync-prices-button.tsx`

## Siguiente mejora recomendada
- Extender este mismo lenguaje visual a Ventas, Compras, Pedidos y Configuración.
- Agregar más analítica real: top productos, rentabilidad por producto, evolución mensual y ventas por canal.
