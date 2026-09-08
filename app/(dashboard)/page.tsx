import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { argentinaTodayRangeUTC } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icons";
import ProductCarousel from "@/components/products/product-carousel";

function shortDayLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(new Date(value))
    .replace(".", "")
    .slice(0, 3);
}

export default async function HomePage() {
  const supabase = await createClient();
  const { start, end } = argentinaTodayRangeUTC();

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);

  const [ordersResult, pendingResult, stockResult, eventsResult, weekOrdersResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,total,status,payment_status,created_at")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("orders")
      .select(
        "id,order_number,customer_name_snapshot,total,status,payment_status,created_at,order_items(quantity,product_name_snapshot,variant_name_snapshot)",
      )
      .in("status", ["NUEVO", "CONFIRMADO", "PREPARANDO"])
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("product_stock_overview")
      .select("id,name,base_unit,available_base,minimum_stock,inventory_mode,product_kind,current_cost,image_url")
      .eq("active", true)
      .limit(300),
    supabase
      .from("system_events")
      .select("id,severity,title,message,created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("orders")
      .select("id,total,status,payment_status,created_at")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const todayOrders = ordersResult.data ?? [];
  const pendingOrders = pendingResult.data ?? [];
  const stock = stockResult.data ?? [];
  const openEvents = eventsResult.data ?? [];
  const weekOrders = weekOrdersResult.data ?? [];

  const salesToday = todayOrders.filter((o) => o.status !== "CANCELADO").reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const paidToday = todayOrders.filter((o) => o.payment_status === "PAGADO").length;
  const toPrepare = pendingOrders.filter((o) => o.status !== "PREPARANDO").length;
  const critical = stock.filter(
    (p) =>
      p.inventory_mode !== "DERIVADO" &&
      Number(p.minimum_stock ?? 0) > 0 &&
      Number(p.available_base ?? 0) <= Number(p.minimum_stock ?? 0),
  );

  const weekRevenue = weekOrders
    .filter((order) => order.status !== "CANCELADO")
    .reduce((sum, order) => sum + Number(order.total ?? 0), 0);

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    date.setUTCHours(0, 0, 0, 0);
    const ymd = date.toISOString().slice(0, 10);
    const orders = weekOrders.filter((order) => (order.created_at ?? "").slice(0, 10) === ymd && order.status !== "CANCELADO");
    return {
      key: ymd,
      label: shortDayLabel(date.toISOString()),
      revenue: orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
      count: orders.length,
    };
  });

  const maxRevenue = Math.max(...recentDays.map((day) => day.revenue), 1);
  const stockSummary = {
    materias: stock.filter((item) => item.product_kind === "INSUMO").length,
    mixes: stock.filter((item) => item.product_kind === "MIX").length,
    elaborados: stock.filter((item) => item.product_kind === "ELABORADO").length,
    combos: stock.filter((item) => item.product_kind === "COMBO").length,
  };
  const totalProducts = stock.length || 1;
  const expensiveReplenishment = critical
    .map((item) => {
      const shortage = Math.max(0, Number(item.minimum_stock ?? 0) - Number(item.available_base ?? 0));
      return {
        ...item,
        shortage,
        estimated: shortage * Number(item.current_cost ?? 0),
      };
    })
    .sort((a, b) => b.estimated - a.estimated)
    .slice(0, 5);

  return (
    <main className="pt-page">
      <PageHeader
        eyebrow="Panel analítico"
        title="Inicio"
        description="Una vista clara de ventas, pedidos, stock y alertas para tomar decisiones rápidas todos los días."
      />

      <section className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="pt-card-elevated overflow-hidden p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-stretch">
            <div className="flex min-w-0 flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f3efff] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#6d5cff]">
                <span className="h-2 w-2 rounded-full bg-[#6d5cff]" /> Hoy en operación
              </div>
              <h2 className="mt-3 text-[28px] font-black leading-[1.03] tracking-[-0.05em] text-[#261d31] sm:text-[34px]">{formatMoney(salesToday)} vendidos hoy</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#6b6076]">{todayOrders.length} pedidos cargados, {paidToday} ya pagados y {toPrepare} esperando preparación.</p>
              <div className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Quick href="/ventas/nueva" icon="sales" title="Nueva venta" subtitle="Registrar pedido" />
                <Quick href="/compras/nueva" icon="purchases" title="Cargar compra" subtitle="Ingresar stock" />
                <Quick href="/productos?view=stock" icon="stock" title="Stock rápido" subtitle="Editar físico" />
                <Quick href="/productos?view=formulas" icon="combo" title="Fórmulas" subtitle="Mix y combos" />
              </div>
            </div>
            <ProductCarousel slides={stock.filter((p) => Boolean(p.image_url)).slice(0, 8).map((p) => ({ id: p.id, name: p.name, image_url: String(p.image_url) }))} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Metric label="Semana" value={formatMoney(weekRevenue)} detail="Ingresos de los últimos 7 días" icon="finance" />
          <Metric label="Pedidos" value={String(todayOrders.length)} detail="Pedidos creados hoy" icon="orders" />
          <Metric label="Por preparar" value={String(toPrepare)} detail="Requieren acción" icon="package" />
          <Metric label="Stock crítico" value={String(critical.length)} detail="Productos bajo mínimo" icon="alert" danger={critical.length > 0} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="pt-chart-shell overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#efe7f2] px-5 py-4">
            <div>
              <p className="pt-section-title">Ventas</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Ingresos de los últimos 7 días</h2>
            </div>
            <span className="rounded-full bg-[#f7f3ff] px-3 py-1 text-[11px] font-bold text-[#6d5cff]">
              {weekOrders.length} pedidos
            </span>
          </div>
          <div className="p-5">
            <div className="grid h-[250px] grid-cols-7 items-end gap-3">
              {recentDays.map((day) => {
                const height = `${Math.max(10, Math.round((day.revenue / maxRevenue) * 100))}%`;
                return (
                  <div key={day.key} className="flex h-full flex-col justify-end gap-2">
                    <div className="text-center text-[10px] font-bold text-[#998ba2]">{day.count}</div>
                    <div className="relative flex-1 rounded-[18px] bg-[#f6f2fb] p-1">
                      <div
                        className="absolute bottom-1 left-1 right-1 rounded-[14px] bg-[linear-gradient(180deg,#7a6cff_0%,#ca4d87_100%)] shadow-[0_12px_24px_rgba(95,76,255,.18)]"
                        style={{ height }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#75697f]">{day.label}</p>
                      <p className="mt-0.5 text-[10px] text-[#998ba2]">{formatMoney(day.revenue)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="pt-chart-shell p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="pt-section-title">Catálogo</p>
                <h2 className="mt-1 text-lg font-black text-[#2c2237]">Composición del negocio</h2>
              </div>
              <Icon name="products" className="h-5 w-5 text-[#6d5cff]" />
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div
                className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#6d5cff 0 ${Math.max(4, (stockSummary.materias / totalProducts) * 100)}%, #ca4d87 0 ${Math.max(8, ((stockSummary.materias + stockSummary.mixes) / totalProducts) * 100)}%, #8dd6a2 0 ${Math.max(12, ((stockSummary.materias + stockSummary.mixes + stockSummary.elaborados) / totalProducts) * 100)}%, #ffca6b 0 100%)`,
                }}
              >
                <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(230,219,233,.8)]">
                  <span className="text-[11px] font-bold text-[#8d7f96]">Productos</span>
                  <span className="text-3xl font-black tracking-[-0.05em] text-[#2f2438]">{stock.length}</span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <Legend label="Materias primas" value={stockSummary.materias} color="#6d5cff" />
                <Legend label="Mixes" value={stockSummary.mixes} color="#ca4d87" />
                <Legend label="Elaborados" value={stockSummary.elaborados} color="#8dd6a2" />
                <Legend label="Combos" value={stockSummary.combos} color="#ffca6b" />
              </div>
            </div>
          </div>

          <div className="pt-chart-shell p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="pt-section-title">Reposición</p>
                <h2 className="mt-1 text-lg font-black text-[#2c2237]">Foco de compras</h2>
              </div>
              <Link href="/finanzas" className="text-xs font-black text-[#6d5cff] hover:underline">
                Ver finanzas
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {expensiveReplenishment.length === 0 ? (
                <p className="rounded-[18px] bg-[#f8f5fb] px-4 py-4 text-sm text-[#72657c]">No hay faltantes relevantes en este momento.</p>
              ) : (
                expensiveReplenishment.map((item) => (
                  <Link
                    key={item.id}
                    href={`/productos/${item.id}`}
                    className="block rounded-[18px] border border-[#efe7f2] bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(38,23,46,.05)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2f2438]">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#8f8299]">
                          Faltan {formatQuantity(item.shortage)} {item.base_unit === "g" ? "g" : "u"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-[#ca4d87]">{formatMoney(item.estimated)}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="pt-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#efe7f2] px-5 py-4">
            <div>
              <p className="pt-section-title">Operación</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Pedidos a preparar</h2>
            </div>
            <Link href="/pedidos" className="pt-button-secondary inline-flex px-3 text-xs">
              Ver todos
            </Link>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="flex min-h-60 items-center justify-center p-6 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#effbf4] text-[#25966b]">
                  <Icon name="check" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-base font-black text-[#2f2438]">Todo al día</p>
                <p className="mt-1 text-sm text-[#7a6f84]">No hay pedidos pendientes en este momento.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#f2ebf4]">
              {pendingOrders.map((order) => {
                const units = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
                return (
                  <Link key={order.id} href={`/ventas/${order.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[#fcfaff]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#f5f2ff] text-[12px] font-black text-[#6d5cff]">
                      #{order.order_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#2f2438]">{order.customer_name_snapshot || "Cliente"}</p>
                      <p className="mt-1 text-xs text-[#83778d]">{units} unidades · {formatMoney(order.total)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <StatusBadge value={order.status} />
                    </div>
                    <Icon name="arrow" className="h-4 w-4 shrink-0 text-[#9d91a8]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="pt-card overflow-hidden">
            <div className="border-b border-[#efe7f2] px-5 py-4">
              <p className="pt-section-title">Stock</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Productos a revisar</h2>
            </div>
            <div className="p-5">
              {critical.length === 0 ? (
                <p className="text-sm text-[#75697f]">No hay productos por debajo del mínimo.</p>
              ) : (
                <div className="space-y-2.5">
                  {critical.slice(0, 5).map((product) => (
                    <Link
                      key={product.id}
                      href={`/productos/${product.id}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fbf8fd] px-3.5 py-3 transition hover:bg-white hover:shadow-[0_10px_24px_rgba(38,23,46,.05)]"
                    >
                      <span className="truncate text-sm font-black text-[#2f2438]">{product.name}</span>
                      <span className="shrink-0 text-xs font-black text-[#cf4b63]">
                        {formatQuantity(product.available_base)} {product.base_unit}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/productos?view=stock" className="mt-4 inline-flex text-xs font-black text-[#6d5cff] hover:underline">
                Abrir editor de stock →
              </Link>
            </div>
          </div>

          <div className="pt-card overflow-hidden">
            <div className="border-b border-[#efe7f2] px-5 py-4">
              <p className="pt-section-title">Alertas</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Eventos del sistema</h2>
            </div>
            <div className="p-5">
              {openEvents.length === 0 ? (
                <p className="text-sm text-[#75697f]">Sin incidencias activas.</p>
              ) : (
                <div className="space-y-3">
                  {openEvents.map((event) => (
                    <div key={event.id} className="rounded-[18px] bg-[#fbf8fd] p-3.5">
                      <p className="text-sm font-black text-[#2f2438]">{event.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#7a6f84]">{event.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  danger,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  danger?: boolean;
}) {
  return (
    <div className={`pt-kpi-card p-4 sm:p-5 ${danger ? "bg-[linear-gradient(180deg,#fff8fa_0%,#ffffff_100%)]" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8c8097]">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${danger ? "bg-[#fff0f3] text-[#cf4b63]" : "bg-[#f5f1ff] text-[#6d5cff]"}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className={`pt-kpi-value mt-4 ${danger ? "text-[#c04961]" : "text-[#2f2438]"}`}>{value}</p>
      <p className="mt-2 text-[12px] text-[#8a7d95]">{detail}</p>
    </div>
  );
}

function Quick({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="pt-card-interactive rounded-[20px] border border-white/75 bg-white/80 p-3.5 shadow-[0_10px_24px_rgba(38,23,46,.05)]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#f3efff_0%,#fff1f7_100%)] text-[#6d5cff] shadow-[inset_0_0_0_1px_rgba(95,76,255,.08)]">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-black tracking-[-0.02em] text-[#2f2438]">{title}</p>
      <p className="mt-1 text-[11px] text-[#867a91]">{subtitle}</p>
    </Link>
  );
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="pt-dot" style={{ background: color }} />
        <span className="text-sm font-medium text-[#584c64]">{label}</span>
      </div>
      <span className="text-sm font-black text-[#2f2438]">{value}</span>
    </div>
  );
}
