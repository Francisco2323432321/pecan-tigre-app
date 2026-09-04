# Pecán Tigre · Tiendanube

## Qué quedó corregido

- Se corrigieron las rutas vacías/mal ubicadas de `sync-products` y `sync-stock`.
- Configuración muestra botones separados para catálogo/imágenes, productos/características, precios y stock.
- El stock se calcula desde `product_stock_overview.available_base` y `product_variants.base_quantity`.
- El stock se envía App → Tiendanube en lotes de máximo 50 variantes para evitar el problema de `Too many subrequests` de Cloudflare.
- Compras, ventas, cambios de estado, producción, ajustes y conteos intentan sincronizar el stock automáticamente después de modificar inventario.
- Se agregaron webhooks `order/created` y `order/cancelled` con validación HMAC.
- Al entrar un pedido de Tiendanube, se vincula por `tiendanube_variant_id`, se crea como pedido local CONFIRMADO (reserva stock) y luego se recalculan todas las presentaciones en Tiendanube.
- La sincronización de catálogo/imágenes conserva el enfoque masivo ya corregido para no repetir el límite de subrequests.

## Antes de desplegar

1. Conservá tu `.env.local` actual. Por seguridad no está incluido en este ZIP.
2. En Supabase → SQL Editor ejecutá completo `supabase/05-tiendanube-sync.sql`.
3. En la carpeta del proyecto ejecutá:

```bash
npm install --no-audit --no-fund
npm run build
```

4. Si el build termina bien:

```bash
git add .
git commit -m "Completar sincronizacion Tiendanube y stock automatico"
git push
```

5. Esperá el deploy verde de Cloudflare.
6. En Configuración → Tiendanube, primero probá **Sincronizar stock**.
7. Si el resultado es correcto, tocá **Activar / revisar sincronización automática** para confirmar que los webhooks estén registrados.

## Importante sobre “carrito”

Tiendanube no expone un webhook `cart/created` en la API pública usada por esta app. La automatización está conectada a `order/created`, que se dispara cuando el cliente completa el checkout y se crea el pedido. Ese es el momento en que la app reserva el inventario y recalcula el stock compartido de todas las presentaciones.

## Fuente de verdad

El stock real sigue siendo Supabase/Pecán Tigre. Tiendanube no pisa `on_hand`, `reserved` ni `available_base` de la app. El botón de stock y la automatización publican hacia Tiendanube el stock calculado por presentación.
