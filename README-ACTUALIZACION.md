# Pecán Tigre · actualización 100 g / unidad + app unificada

Esta versión parte de la app existente y reorganiza la operación diaria alrededor de cinco áreas: Productos, Ventas, Compras, Finanzas y Configuración.

## Antes de reemplazar archivos

- Conservá tu carpeta `.git` actual si vas a mantener el mismo repositorio.
- Conservá tu `.env.local` actual. Este ZIP no incluye secretos.
- `node_modules`, `.next` y `dist` no vienen en el ZIP: se regeneran con npm/build.

## 1. Actualizar Supabase

Abrí `supabase/06-unified-products-finance.sql` y ejecutá **el contenido completo** en Supabase SQL Editor.

La migración:
- crea el alta simple de productos 100 g / unidad;
- agrega observación segura de futuras variantes de Tiendanube;
- mejora la sincronización de catálogo y archiva presentaciones locales antiguas cuando Tiendanube ya tiene una sola opción;
- crea la base protegida para conectar Mercado Pago en Finanzas.

No borra las variantes históricas de la base: las desactiva cuando ya no existen en Tiendanube para conservar referencias de pedidos anteriores.

## 2. Instalar y verificar

```bash
npm install --no-audit --no-fund
npm run build
```

Después hacé commit/push normalmente para que Cloudflare despliegue.

## 3. Primera sincronización después del despliegue

Entrá a **Configuración → Tiendanube** y ejecutá primero **Catálogo e imágenes** una vez.

Esto es importante porque:
- vuelve a vincular la única opción que dejaste en Tiendanube;
- toma el SKU actual de Tiendanube;
- archiva 250 g / 500 g / 1 kg locales antiguos cuando corresponda;
- guarda una observación de las opciones actuales de Tiendanube.

Luego ejecutá **Stock** una vez para verificar.

Modelo actual:
- producto por peso: stock Tiendanube = `floor(stock_disponible_en_gramos / 100)`;
- producto por unidad: stock Tiendanube = `floor(unidades_disponibles)`.

Si en el futuro un producto aparece con más de una variante en Tiendanube, Pecán Tigre la muestra como alerta y **pausa la sincronización automática de stock de ese producto** hasta que definamos su regla. Así no se descuenta inventario incorrectamente.

## 4. Navegación nueva

Menú principal:
- Inicio
- Productos
- Ventas
- Compras
- Finanzas (solo ADMIN)
- Configuración

Productos concentra catálogo, Stock rápido, Mixes, Combos, Recetas y Producción.
Ventas concentra ventas, pedidos, clientes y preparación.
Compras concentra compras y proveedores.

## 5. Finanzas / Mercado Pago

La primera etapa está implementada con una conexión OAuth protegida para ADMIN. Todavía **no usa un saldo de Mercado Pago para calcular caja real**: eso se hará en una segunda etapa con movimientos/reportes financieros y conciliación.

Para habilitar el botón de conexión agregá en Cloudflare:
- `MERCADOPAGO_CLIENT_ID` (variable)
- `MERCADOPAGO_CLIENT_SECRET` (secret)
- `MERCADOPAGO_REDIRECT_URI` (variable)

La redirect URI debe ser exactamente:

```text
https://TU-DOMINIO/api/mercadopago/callback
```

No pegues ni publiques el Client Secret en código o GitHub.

## 6. Logo y favicon

Podés reemplazar directamente:

```text
public/brand/logo.svg
public/brand/favicon.svg
```

Manteniendo esos nombres, no necesitás modificar componentes.

## 7. Interfaz renovada

Esta entrega también incluye una renovación visual general:
- navegación lateral más clara en escritorio y barra inferior optimizada en móvil;
- botones, inputs, tarjetas, filtros y estados con una estética más consistente;
- tipografía y jerarquía visual mejoradas;
- catálogo en grilla con tarjetas cuadradas e imágenes protagonistas;
- Stock rápido con búsqueda, controles +/- y guardado en bloque;
- login y panel de inicio actualizados para una experiencia más limpia y ágil.

La paleta sigue siendo rosa pastel, pero con mayor contraste para conservar legibilidad.
