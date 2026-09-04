import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { argentinaTodayRangeUTC } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icons";

export default async function HomePage() {
  const supabase = await createClient();
  const { start, end } = argentinaTodayRangeUTC();

  const [ordersResult, pendingResult, stockResult, eventsResult] = await Promise.all([
    supabase.from("orders").select("id,total,status,payment_status").gte("created_at", start).lt("created_at", end),
    supabase.from("orders").select("id,order_number,customer_name_snapshot,total,status,payment_status,created_at,order_items(quantity,product_name_snapshot,variant_name_snapshot)").in("status", ["NUEVO", "CONFIRMADO", "PREPARANDO"]).order("created_at", { ascending: true }).limit(6),
    supabase.from("product_stock_overview").select("id,name,base_unit,available_base,minimum_stock,inventory_mode").eq("active", true).limit(200),
    supabase.from("system_events").select("id,severity,title,message,created_at").eq("resolved", false).order("created_at", { ascending: false }).limit(4),
  ]);

  const todayOrders = ordersResult.data ?? [];
  const salesToday = todayOrders.filter((o) => o.status !== "CANCELADO").reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const paidToday = todayOrders.filter((o) => o.payment_status === "PAGADO").length;
  const toPrepare = (pendingResult.data ?? []).filter((o) => o.status !== "PREPARANDO").length;
  const critical = (stockResult.data ?? []).filter((p) => p.inventory_mode !== "DERIVADO" && Number(p.minimum_stock ?? 0) > 0 && Number(p.available_base ?? 0) <= Number(p.minimum_stock ?? 0));

  return (
    <main className="pt-page">
      <PageHeader eyebrow="Resumen de hoy" title="Inicio" description="Lo importante para vender, preparar pedidos y cuidar el stock sin perder tiempo." />

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Quick href="/ventas/nueva" icon="sales" title="Nueva venta" subtitle="Crear pedido" />
        <Quick href="/compras/nueva" icon="purchases" title="Cargar compra" subtitle="Ingresar stock" />
        <Quick href="/stock" icon="stock" title="Stock" subtitle="Ver disponible" />
        <Quick href="/combos" icon="combo" title="Nuevo combo" subtitle="Calcular margen" />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Ventas hoy" value={formatMoney(salesToday)} detail={`${todayOrders.length} pedidos · ${paidToday} pagados`} icon="sales" emphasized />
        <Metric label="Pedidos" value={String(todayOrders.length)} detail="Recibidos hoy" icon="orders" />
        <Metric label="A preparar" value={String(toPrepare)} detail="Requieren acción" icon="package" />
        <Metric label="Stock crítico" value={String(critical.length)} detail="Productos bajo mínimo" icon="alert" danger={critical.length > 0} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="pt-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#f2e0e8] px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-bold text-[#3e2833]">Pedidos a preparar</h2>
              <p className="mt-0.5 text-xs text-[#896b78]">Prioridad operativa</p>
            </div>
            <Link href="/pedidos" className="pt-button-secondary px-3 py-2 text-xs">Ver todos</Link>
          </div>
          {(pendingResult.data ?? []).length === 0 ? (
            <div className="flex min-h-52 items-center justify-center p-5 text-center">
              <div>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f2] text-[#36785b]"><Icon name="check" className="h-6 w-6" /></div>
                <p className="mt-3 font-bold text-[#3e2833]">Todo preparado</p>
                <p className="mt-1 text-sm text-[#80616f]">No hay pedidos pendientes en este momento.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#f5e7ed]">
              {(pendingResult.data ?? []).map((order) => {
                const units = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
                return (
                  <Link key={order.id} href={`/ventas/${order.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#fffafd] sm:px-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f6] text-xs font-extrabold text-[#ad416f]">#{order.order_number}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#3e2833]">{order.customer_name_snapshot || "Cliente"}</p>
                      <p className="mt-0.5 text-xs text-[#8a6c79]">{units} unidades · {formatMoney(order.total)}</p>
                    </div>
                    <div className="hidden sm:block"><StatusBadge value={order.status} /></div>
                    <Icon name="arrow" className="h-4 w-4 shrink-0 text-[#b99aa8]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="pt-card overflow-hidden">
            <div className="border-b border-[#f2e0e8] px-4 py-4"><h2 className="font-bold text-[#3e2833]">Stock a revisar</h2></div>
            <div className="p-4">
              {critical.length === 0 ? <p className="text-sm text-[#80616f]">No hay productos por debajo del mínimo.</p> : (
                <div className="space-y-2.5">
                  {critical.slice(0, 4).map((p) => (
                    <Link key={p.id} href={`/productos/${p.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#fff6f8] px-3 py-2.5">
                      <span className="truncate text-sm font-bold text-[#4a303b]">{p.name}</span>
                      <span className="shrink-0 text-xs font-extrabold text-[#b9475f]">{formatQuantity(p.available_base)} {p.base_unit}</span>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/stock" className="mt-3 inline-flex text-xs font-bold text-[#ad416f]">Abrir stock →</Link>
            </div>
          </div>

          <div className="pt-card overflow-hidden">
            <div className="border-b border-[#f2e0e8] px-4 py-4"><h2 className="font-bold text-[#3e2833]">Alertas del sistema</h2></div>
            <div className="p-4">
              {(eventsResult.data ?? []).length === 0 ? <p className="text-sm text-[#80616f]">Sin incidencias activas.</p> : (
                <div className="space-y-3">{(eventsResult.data ?? []).map((e) => <div key={e.id}><p className="text-sm font-bold text-[#4a303b]">{e.title}</p><p className="mt-0.5 text-xs leading-5 text-[#80616f]">{e.message}</p></div>)}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Quick href="/stock/conteo" icon="stock" title="Conteo" subtitle="Control semanal" />
        <Quick href="/productos" icon="products" title="Productos" subtitle="Precios y recetas" />
        <Quick href="/pedidos/preparacion" icon="print" title="Preparación" subtitle="Hoja / PDF" />
        <Quick href="/compras" icon="purchases" title="Compra" subtitle="Ingresar mercadería" />
      </section>
    </main>
  );
}

function Metric({ label, value, detail, icon, emphasized, danger }: { label: string; value: string; detail: string; icon: Parameters<typeof Icon>[0]["name"]; emphasized?: boolean; danger?: boolean }) {
  return <div className={`rounded-[18px] border p-4 shadow-[0_6px_20px_rgba(92,43,65,0.045)] sm:p-5 ${emphasized ? "border-[#edbfd2] bg-gradient-to-br from-[#fff0f6] to-white" : danger ? "border-[#f0c5ce] bg-[#fff8f9]" : "border-[#efd8e2] bg-white"}`}>
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-[#8c6e7b]">{label}</p><Icon name={icon} className={`h-4 w-4 ${danger ? "text-[#b9475f]" : "text-[#c35a86]"}`} /></div>
    <p className={`mt-2 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl ${danger ? "text-[#a94658]" : "text-[#3e2833]"}`}>{value}</p>
    <p className="mt-1 text-[11px] text-[#987b88]">{detail}</p>
  </div>;
}

function Quick({ href, icon, title, subtitle }: { href: string; icon: Parameters<typeof Icon>[0]["name"]; title: string; subtitle: string }) {
  return <Link href={href} className="rounded-2xl border border-[#efd8e2] bg-white p-3.5 transition active:scale-[0.99] md:hover:border-[#e6b2c8] md:hover:shadow-[0_8px_22px_rgba(92,43,65,0.06)]">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0f6] text-[#bd4d7a]"><Icon name={icon} className="h-5 w-5" /></div>
    <p className="mt-2.5 text-sm font-bold text-[#3e2833]">{title}</p><p className="mt-0.5 text-[11px] text-[#8d707d]">{subtitle}</p>
  </Link>;
}
