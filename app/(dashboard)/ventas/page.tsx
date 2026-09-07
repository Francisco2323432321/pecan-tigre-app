import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { argentinaTodayRangeUTC } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import SalesList from "@/components/sales/sales-list";
import SectionNav from "@/components/ui/section-nav";

export default async function VentasPage() {
  const supabase = await createClient();
  const { start } = argentinaTodayRangeUTC();
  const { data, error } = await supabase.from("orders").select("id,order_number,customer_name_snapshot,total,currency,status,payment_status,inventory_state,shipping_method,created_at,order_items(quantity)").order("created_at", { ascending: false }).limit(150);
  const orders = data ?? [];
  const today = orders.filter((order) => order.created_at >= start && order.status !== "CANCELADO");
  const total = today.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const average = today.length ? total / today.length : 0;

  return <main className="pt-page">
    <PageHeader eyebrow="Operación comercial" title="Ventas" description="Ventas, pedidos, clientes y preparación desde una sola sección." actions={<Link href="/ventas/nueva" className="pt-button-primary inline-flex items-center gap-2 px-4 text-sm"><span className="text-base leading-none">+</span>Nueva venta</Link>} />
    <SectionNav items={[
      { label: "Ventas", href: "/ventas" },
      { label: "Pedidos", href: "/pedidos" },
      { label: "Clientes", href: "/clientes" },
      { label: "Preparación", href: "/pedidos/preparacion" },
    ]} />
    <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Mini label="Facturación hoy" value={formatMoney(total)} /><Mini label="Pedidos hoy" value={String(today.length)} /><Mini label="Ticket promedio" value={formatMoney(average)} /><Mini label="Pendientes" value={String(orders.filter((order) => ["NUEVO", "CONFIRMADO", "PREPARANDO", "PREPARADO"].includes(order.status)).length)} /></section>
    {error ? <div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudieron cargar las ventas: {error.message}</div> : <SalesList orders={orders} todayStart={start} />}
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-[20px] border border-[#ecd6e0] bg-white p-4 shadow-[0_6px_18px_rgba(82,42,60,.035)]"><p className="text-[10px] font-extrabold uppercase tracking-wide text-[#917380]">{label}</p><p className="mt-1 text-xl font-black tracking-[-0.02em] text-[#3e2833] sm:text-2xl">{value}</p></div>; }
