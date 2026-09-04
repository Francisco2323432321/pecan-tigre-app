import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { argentinaTodayRangeUTC } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import SalesList from "@/components/sales/sales-list";

export default async function VentasPage(){
  const supabase=await createClient();
  const {start}=argentinaTodayRangeUTC();
  const {data,error}=await supabase.from("orders").select("id,order_number,customer_name_snapshot,total,currency,status,payment_status,inventory_state,shipping_method,created_at,order_items(quantity)").order("created_at",{ascending:false}).limit(150);
  const orders=data??[];
  const today=orders.filter(o=>o.created_at>=start&&o.status!=="CANCELADO");
  const total=today.reduce((s,o)=>s+Number(o.total??0),0);
  const avg=today.length?total/today.length:0;
  return <main className="pt-page"><PageHeader eyebrow="Operación comercial" title="Ventas" description="Cada venta con pago, envío, reserva de stock y detalle de productos en un solo lugar." actions={<Link href="/ventas/nueva" className="pt-button-primary inline-flex items-center px-4 text-sm">+ Nueva venta</Link>} />
    <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Mini label="Facturación hoy" value={formatMoney(total)}/><Mini label="Pedidos hoy" value={String(today.length)}/><Mini label="Ticket promedio" value={formatMoney(avg)}/><Mini label="Pendientes" value={String(orders.filter(o=>["NUEVO","CONFIRMADO","PREPARANDO","PREPARADO"].includes(o.status)).length)}/></section>
    {error?<div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudieron cargar las ventas: {error.message}</div>:<SalesList orders={orders} todayStart={start}/>}</main>
}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-[#efd8e2] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#917380]">{label}</p><p className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#3e2833] sm:text-2xl">{value}</p></div>}
