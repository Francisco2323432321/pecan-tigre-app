# Tiendanube en Pecán Tigre V3

## Uso normal

En `Configuración → Tiendanube` la interfaz principal queda reducida a vincular/mostrar el estado de la tienda. Las acciones manuales quedan en **Opciones avanzadas / Diagnóstico**.

La automatización cubre pedidos, stock y detección de cambios/productos. Los precios pueden seguir administrándose por CSV si preferís.

## Webhooks V3

Al revisar la automatización se contemplan:

- `order/created`
- `order/cancelled`
- `product/created`
- `product/updated`
- `product/deleted`

Los eventos de producto fuerzan una actualización del catálogo local. Un producto remoto con una sola opción puede importarse automáticamente; si aparecen múltiples opciones, la app genera una alerta y evita adivinar la lógica de stock.

## Después de instalar V3

Entrá una vez en `Configuración → Tiendanube` y ejecutá **revisar automatización**. Los botones de catálogo, precios y stock quedan disponibles en Diagnóstico para uso excepcional.
