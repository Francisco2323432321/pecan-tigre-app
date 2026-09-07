import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";
import { SyncCatalogButton } from "@/components/tiendanube/sync-catalog-button";
import { SyncProductsButton } from "@/components/tiendanube/sync-products-button";
import { SyncPricesButton } from "@/components/tiendanube/sync-prices-button";
import { SyncStockButton } from "@/components/tiendanube/sync-stock-button";
import { SyncAutomationButton } from "@/components/tiendanube/sync-automation-button";

type TiendanubeConnection = { store_id: string; connected_at: string };
type MercadoPagoStatus = { account_user_id: string; connected_at: string; expires_at: string | null };

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "ADMIN";

  const [productsResult, ordersResult, eventsResult, tiendanubeResult, observationsResult, mpResult] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("system_events").select("id", { count: "exact", head: true }),
    supabase.rpc("get_tiendanube_connection_status").maybeSingle(),
    supabase.from("tiendanube_variant_observations").select("tiendanube_variant_id,linked_local_product_id"),
    isAdmin ? supabase.rpc("get_mercadopago_connection_status").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const tiendanubeConnection = tiendanubeResult.data as TiendanubeConnection | null;
  const mpConnection = mpResult.data as MercadoPagoStatus | null;
  const observed = observationsResult.error ? [] : (observationsResult.data ?? []);
  const observedByProduct = new Map<string, number>();
  let unlinkedOptions = 0;
  for (const row of observed) {
    if (!row.linked_local_product_id) {
      unlinkedOptions += 1;
      continue;
    }
    observedByProduct.set(row.linked_local_product_id, (observedByProduct.get(row.linked_local_product_id) ?? 0) + 1);
  }
  const multiVariantProducts = [...observedByProduct.values()].filter((count) => count > 1).length;

  return (
    <main className="pt-page">
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Integraciones, automatizaciones, identidad visual y estado general de Pecán Tigre."
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(productsResult.count ?? 0)} detail="catálogo central" />
        <Metric label="Pedidos" value={String(ordersResult.count ?? 0)} detail="historial cargado" />
        <Metric label="Tiendanube" value={tiendanubeConnection ? "Conectada" : "Pendiente"} detail={tiendanubeConnection ? `Tienda ${tiendanubeConnection.store_id}` : "requiere OAuth"} ok={Boolean(tiendanubeConnection)} />
        <Metric label="Alertas TN" value={String(unlinkedOptions + multiVariantProducts)} detail={`${multiVariantProducts} productos con múltiples opciones`} danger={unlinkedOptions + multiVariantProducts > 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="pt-card overflow-hidden">
          <div className="border-b border-[#f2e0e8] bg-gradient-to-r from-white to-[#fff7fa] px-5 py-4">
            <p className="pt-section-title">Integración comercial</p>
            <h2 className="mt-1 text-lg font-black text-[#3e2833]">Tiendanube</h2>
            <p className="mt-1 text-sm leading-6 text-[#80616f]">Hoy el modelo operativo es simple: cada producto se vende por <strong>100 g</strong> o por <strong>unidad</strong>. Pecán Tigre conserva una capa técnica para reconocer opciones de Tiendanube sin convertirlas en el centro de la app.</p>
          </div>

          <div className="p-5">
            {tiendanubeConnection ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#cfe8db] bg-[#f5fbf8] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f5eb] text-[#36785b]"><Icon name="check" className="h-5 w-5" /></span>
                    <div><p className="font-black text-[#315e4a]">Tiendanube conectada</p><p className="mt-1 text-xs text-[#5d7d6e]">Tienda {tiendanubeConnection.store_id}. La app sigue siendo la fuente de verdad del inventario.</p></div>
                  </div>
                </div>

                <SyncSection title="1 · Catálogo e imágenes" description="Tiendanube → App. Revisa IDs, SKU e imagen principal. Si en Tiendanube quedó una sola opción de venta, archiva las presentaciones locales antiguas sin borrar historial. También registra cualquier futura variante para mostrar una alerta.">
                  <SyncCatalogButton />
                </SyncSection>
                <SyncSection title="2 · Productos" description="App → Tiendanube. Actualiza datos comerciales del producto y de su única opción activa. La compatibilidad técnica con variantes queda oculta del flujo diario.">
                  <SyncProductsButton />
                </SyncSection>
                <SyncSection title="3 · Precios" description="App → Tiendanube. Envía precio normal y promocional de la opción de venta activa.">
                  <SyncPricesButton />
                </SyncSection>
                <SyncSection title="4 · Stock" description="App → Tiendanube. Productos por peso publican floor(stock disponible en gramos / 100). Productos por unidad publican floor(unidades disponibles). Si se detectan múltiples variantes en un producto, su stock se pausa para evitar una sincronización incorrecta.">
                  <SyncStockButton />
                </SyncSection>
                <SyncSection title="5 · Pedidos y automatización" description="Mantiene los webhooks de pedidos. Las compras, ventas, ajustes, conteos y pedidos intentan publicar el nuevo stock automáticamente; el botón de stock queda como respaldo manual.">
                  <SyncAutomationButton />
                </SyncSection>

                {(multiVariantProducts > 0 || unlinkedOptions > 0) && (
                  <div className="rounded-2xl border border-[#efc3cc] bg-[#fff8f9] p-4 text-sm leading-6 text-[#8f4352]">
                    <strong>Atención Tiendanube:</strong> se detectaron {multiVariantProducts} productos con más de una opción y {unlinkedOptions} opciones sin vínculo local. Podés visualizarlas dentro de Productos; la app no intenta adivinar cómo descontar ese stock.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#f0d7b6] bg-[#fffaf2] p-4 text-sm leading-6 text-[#89653d]">Primero conectá Tiendanube para habilitar las sincronizaciones.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="pt-card overflow-hidden">
            <div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Identidad</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Logo y favicon</h2></div>
            <div className="p-5">
              <div className="flex items-center gap-4 rounded-2xl bg-[#fff7fa] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo.svg" alt="Logo actual" className="h-14 w-14 rounded-2xl border border-[#efd8e2] bg-white object-contain p-2" />
                <div><p className="font-black text-[#3e2833]">Archivos reemplazables</p><p className="mt-1 text-xs leading-5 text-[#80616f]">No hace falta tocar componentes para cambiar la marca.</p></div>
              </div>
              <div className="mt-4 space-y-2 font-mono text-xs text-[#725562]"><p className="rounded-xl bg-[#f8f2f5] px-3 py-2">public/brand/logo.svg</p><p className="rounded-xl bg-[#f8f2f5] px-3 py-2">public/brand/favicon.svg</p></div>
              <p className="mt-3 text-xs leading-5 text-[#987b88]">Reemplazá esos archivos manteniendo el nombre. El logo se usa en navegación y el favicon en la pestaña del navegador.</p>
            </div>
          </div>

          {isAdmin && <div className="pt-card overflow-hidden">
            <div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Capa privada</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Finanzas + Mercado Pago</h2></div>
            <div className="p-5">
              <Status label="Acceso" detail="Solo usuarios ADMIN" ok />
              <div className="mt-3"><Status label="Mercado Pago" detail={mpConnection ? `Cuenta ${mpConnection.account_user_id} conectada` : "Base OAuth preparada; faltan credenciales/conexión si aún no las configuraste"} ok={Boolean(mpConnection)} /></div>
              <p className="mt-4 text-xs leading-5 text-[#80616f]">Esta primera etapa conecta la cuenta de forma segura. El saldo real todavía no se usa para calcular caja disponible hasta integrar y conciliar los movimientos financieros.</p>
              <Link href="/finanzas" className="pt-button-secondary mt-4 inline-flex items-center gap-2 px-4 text-sm"><Icon name="finance" className="h-4 w-4" />Abrir Finanzas</Link>
            </div>
          </div>}

          <div className="pt-card p-5">
            <p className="pt-section-title">Sistema</p>
            <div className="mt-3 space-y-3">
              <Status label="Supabase" detail="Base de datos conectada" ok />
              <Status label="Autenticación" detail={profile ? "Sesión iniciada" : "Sin sesión activa"} ok={Boolean(profile)} />
              <Status label="Eventos" detail={`${eventsResult.count ?? 0} eventos registrados`} ok />
              <Status label="Emails" detail="Preparado para integrar Resend" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SyncSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="border-t border-[#f2e0e8] pt-5 first:border-t-0 first:pt-0"><div className="mb-3"><div className="text-sm font-black text-[#3e2833]">{title}</div><div className="mt-1 text-xs leading-5 text-[#80616f]">{description}</div></div>{children}</div>;
}

function Status({ label, detail, ok = false }: { label: string; detail: string; ok?: boolean }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#f0e1e8] bg-[#fffafd] p-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${ok ? "bg-[#e3f5eb] text-[#36785b]" : "bg-[#f3edf0] text-[#8f7480]"}`}>{ok ? "✓" : "•"}</div><div className="min-w-0"><div className="text-sm font-black text-[#3e2833]">{label}</div><div className="mt-0.5 text-xs leading-5 text-[#80616f]">{detail}</div></div></div>;
}

function Metric({ label, value, detail, ok, danger }: { label: string; value: string; detail: string; ok?: boolean; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-[#efc3cc] bg-[#fff8f9]" : ok ? "border-[#d3e9dd] bg-[#f8fcfa]" : "border-[#efd8e2] bg-white"}`}><p className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#917380]">{label}</p><p className={`mt-1 text-xl font-black ${danger ? "text-[#aa4558]" : ok ? "text-[#36785b]" : "text-[#3e2833]"}`}>{value}</p><p className="mt-0.5 text-[11px] text-[#987b88]">{detail}</p></div>;
}
