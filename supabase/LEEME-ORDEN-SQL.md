# Orden SQL — Pecán Tigre V3

Hacer backup antes de ejecutar.

1. `01-BASE-COMPLETA.sql`
2. `04-tiendanube.sql`
3. `05-tiendanube-sync.sql`
4. `06-unified-products-finance.sql`
5. `00-LIMPIEZA-V3-SIN-BORRAR-USUARIOS.sql`
6. `07-v3-operational.sql`
7. `08-VERIFICACION-V3.sql`

**No elimina usuarios.** El script de limpieza conserva `auth.users` y `public.profiles`.

Al finalizar, `08-VERIFICACION-V3.sql` debe mostrar al menos un ADMIN y permite ver SKU duplicados, productos sin foto, recetas incompletas y totales de datos históricos.
