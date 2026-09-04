import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { SyncCatalogButton } from "@/components/tiendanube/sync-catalog-button";
import { SyncProductsButton } from "@/components/tiendanube/sync-products-button";
import { SyncPricesButton } from "@/components/tiendanube/sync-prices-button";
import { SyncStockButton } from "@/components/tiendanube/sync-stock-button";
import { SyncAutomationButton } from "@/components/tiendanube/sync-automation-button";

type TiendanubeConnection = { store_id: string; connected_at: string };

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const [productsResult, ordersResult, eventsResult, tiendanubeResult] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("system_events").select("id", { count: "exact", head: true }),
    supabase.rpc("get_tiendanube_connection_status").maybeSingle(),
  ]);

  const tiendanubeConnection = tiendanubeResult.data as TiendanubeConnection | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-500">Estado general e integraciones de Pecán Tigre.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">Sistema</h2>
            <p className="mt-1 text-sm text-zinc-500">Estado de los servicios principales.</p>
          </div>
          <div className="space-y-3">
            <Status label="Supabase" detail="Base de datos conectada" ok />
            <Status label="Autenticación" detail={profile ? "Sesión iniciada correctamente" : "Sin sesión activa"} ok={Boolean(profile)} />
            <Status label="Tiendanube" detail={tiendanubeConnection ? `Conectado · Tienda ${tiendanubeConnection.store_id}` : "Pendiente de conexión"} ok={Boolean(tiendanubeConnection)} />
            <Status label="Emails" detail="Preparado para integrar Resend" />
          </div>
        </div>

        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">Tiendanube</h2>
            <p className="mt-1 text-sm text-zinc-500">Pecán Tigre es la fuente de verdad para productos, precios y stock.</p>
          </div>

          {tiendanubeConnection ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="font-medium text-green-900">✓ Tiendanube conectada</div>
                <div className="mt-1 text-sm text-green-700">Tienda {tiendanubeConnection.store_id}</div>
              </div>

              <SyncSection title="Catálogo e imágenes" description="Tiendanube → App. Vincula IDs por SKU y trae la imagen principal sin tocar el stock real de la app.">
                <SyncCatalogButton />
              </SyncSection>
              <SyncSection title="Productos y características" description="App → Tiendanube. Envía nombre, descripción, publicación, SKU, peso, medidas y código de barras.">
                <SyncProductsButton />
              </SyncSection>
              <SyncSection title="Precios" description="App → Tiendanube. Envía precio normal y promocional por variante.">
                <SyncPricesButton />
              </SyncSection>
              <SyncSection title="Stock" description="App → Tiendanube. Calcula cada presentación con floor(stock disponible / cantidad base) y actualiza en lotes de hasta 50 variantes.">
                <SyncStockButton />
              </SyncSection>
              <SyncSection title="Pedidos y stock automático" description="Registra webhooks de pedido creado/cancelado. Al entrar un pedido, se reserva en la app y se recalculan todas las presentaciones en Tiendanube.">
                <SyncAutomationButton />
              </SyncSection>

              <div className="rounded-xl bg-zinc-50 p-4 text-xs leading-5 text-zinc-500">
                El botón de stock queda como respaldo manual. Las compras, ventas, ajustes, conteos, producción y pedidos de Tiendanube intentan sincronizar el stock automáticamente.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">Primero conectá Tiendanube para usar las sincronizaciones.</div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900">Datos</h2>
          <p className="mt-1 text-sm text-zinc-500">Resumen rápido de la información almacenada.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DataCard label="Productos" value={productsResult.count ?? 0} />
          <DataCard label="Pedidos" value={ordersResult.count ?? 0} />
          <DataCard label="Eventos del sistema" value={eventsResult.count ?? 0} />
        </div>
      </section>
    </div>
  );
}

function SyncSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="border-t border-zinc-100 pt-5 first:border-t-0 first:pt-0"><div className="mb-3"><div className="text-sm font-medium text-zinc-900">{title}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div></div>{children}</div>;
}

function Status({ label, detail, ok = false }: { label: string; detail: string; ok?: boolean }) {
  return <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3"><div className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold", ok ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"].join(" ")}>{ok ? "✓" : "•"}</div><div className="min-w-0"><div className="text-sm font-medium text-zinc-900">{label}</div><div className="mt-0.5 text-xs leading-5 text-zinc-500">{detail}</div></div></div>;
}

function DataCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm"><div className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</div><div className="mt-1 text-sm text-zinc-500">{label}</div></div>;
}
