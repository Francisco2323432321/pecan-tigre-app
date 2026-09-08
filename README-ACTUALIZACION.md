# Pecán Tigre V3 — actualización

Esta carpeta contiene la versión V3 completa de la app y los SQL necesarios para dejar Supabase alineado con ella.

## Antes de empezar

1. Hacé un backup de Supabase desde el panel.
2. No borres usuarios manualmente.
3. No reemplaces tus variables reales por `.env.example`: ese archivo solo documenta nombres de variables.

La limpieza V3 **no elimina `auth.users` ni `public.profiles`**. Tampoco elimina productos, ventas, compras ni movimientos históricos.

## Orden exacto de SQL

Ejecutá en **Supabase → SQL Editor**, uno por uno y en este orden:

1. `supabase/01-BASE-COMPLETA.sql`
2. `supabase/04-tiendanube.sql`
3. `supabase/05-tiendanube-sync.sql`
4. `supabase/06-unified-products-finance.sql`
5. `supabase/00-LIMPIEZA-V3-SIN-BORRAR-USUARIOS.sql`
6. `supabase/07-v3-operational.sql`
7. `supabase/08-VERIFICACION-V3.sql`

Si un script da error, **no sigas con el siguiente**: guardá el mensaje exacto para corregirlo.

### Qué limpia el script 00

- conserva todos los usuarios y perfiles;
- convierte el rol legado `VENTAS` a `OPERADOR`;
- elimina únicamente la tabla de prueba `public.prueba`, si todavía existe;
- archiva las presentaciones locales antiguas de 250 g / 500 g / 1 kg cuando el producto tiene una presentación de 100 g;
- no borra esas variantes, para conservar referencias históricas;
- elimina solamente eventos del sistema ya resueltos con más de 180 días.

## Actualizar la app

Después de terminar los SQL:

```bash
npm install --no-audit --no-fund
npm run build
```

Si el build termina correctamente:

```bash
git add .
git commit -m "Pecan Tigre V3"
git push
```

Cloudflare debería desplegar la rama conectada automáticamente. Si usás el deploy manual de Vinext:

```bash
npm run build:vinext
npm run deploy:vinext
```

## Cambios principales incluidos

- Venta manual corregida y redirección a la venta recién creada.
- Vista de detalle de venta y remito para cliente imprimible / guardable como PDF.
- Previsualización interna del pedido con desglose de recetas y preparación consolidada.
- Productos por peso con presentación comercial normal de 100 g; variantes técnicas antiguas ocultas/archivadas.
- SKU automático en nuevos productos y detección de duplicados/legados.
- Ficha del producto reorganizada como **Datos del producto**.
- Tipo operativo editable: simple/comprado, mix, elaborado o combo.
- Stock rápido con dos modos: **Sumar/restar** y **Establecer stock**.
- Campo de ajuste inicia en 0 y se separa del stock actual.
- Confirmación visual de stock actualizado.
- Nueva pestaña **Productos → Movimientos** con historial global.
- Centro **Errores y alertas**: fotos, SKU, costos, margen, stock, recetas y Tiendanube.
- Margen mínimo configurable, por defecto 20 %, y alertas ignorables por fingerprint.
- Solo roles `ADMIN` y `OPERADOR`; el último ADMIN está protegido.
- ADMIN puede gestionar roles desde la app.
- Logo y favicon editables desde Configuración.
- Tiendanube simplificada y webhooks de producto añadidos.
- Carrusel liviano de imágenes en Inicio.
- Botón Volver en pantallas internas.
- Corrección de padding de buscadores.
- Estilos de impresión A4 limpios.

## Notas importantes

- Un producto importado automáticamente desde Tiendanube con una única variante entra como producto de 100 g y queda marcado **pendiente de revisión**. Confirmá su tipo/unidad desde su ficha, especialmente si en realidad se vende por unidad.
- Si Tiendanube detecta varias variantes, la app no inventa una lógica de stock: crea una alerta para revisión.
- Los SKU existentes no se renombran automáticamente para no romper referencias externas. Los SKU nuevos sí se generan automáticamente. Los SKU viejos `PT-...` aparecen como información para que puedas corregirlos desde el producto.
- Los encabezados/pies que Chrome agrega al imprimir (URL, fecha, número de página) se desactivan desde la opción **Encabezados y pies de página** del cuadro de impresión del navegador.

## Validación de esta entrega

- Se revisaron 113 archivos TypeScript/TSX con el parser de TypeScript: 0 errores de sintaxis.
- Se verificaron los imports internos `@/...`: 0 rutas faltantes.
- El build completo no pudo ejecutarse dentro del entorno de preparación porque la instalación de dependencias quedó incompleta por timeout. Por eso el paso `npm run build` de arriba es obligatorio antes de hacer push.
