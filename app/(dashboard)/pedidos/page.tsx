import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import StatusBadge from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/format";
import { Icon } from "@/components/ui/icons";

export default async function PedidosPage(){
  const supabase=await createClient();
  const {data,error}=await supabase.from("orders").select("id,order_number,customer_name_snapshot,total,currency,status,payment_status,shipping_method,created_at,order_items(quantity,product_name_snapshot,variant_name_snapshot)").in("status",["NUEVO","CONFIRMADO","PREPARANDO","PREPARADO"]).order("created_at",{ascending:true}).limit(100);
  const orders=data??[];
  const preparing=orders.filter(o=>o.status==="PREPARANDO").length;
  const ready=orders.filter(o=>o.status==="PREPARADO").length;
  return <main className="w-full p-4 sm:p-5 md:p-6 xl:p-8"><PageHeader eyebrow="Preparación y despacho" title="Pedidos" description="Una vista operativa para preparar rápido y reducir errores de armado." actions={<Link href="/pedidos/preparacion" className="pt-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm"><Icon name="print" className="h-4 w-4"/>Hoja / PDF</Link>}/>
    <section className="mb-4 grid grid-cols-3 gap-3"><Mini label="Pendientes" value={String(orders.length)}/><Mini label="Preparando" value={String(preparing)}/><Mini label="Preparados" value={String(ready)}/></section>
    {error?<div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudieron cargar los pedidos.</div>:orders.length===0?<div className="pt-card p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef7f2] text-[#36785b]"><Icon name="check" className="h-6 w-6"/></div><p className="mt-3 font-bold text-[#3e2833]">No hay pedidos pendientes</p><p className="mt-1 text-sm text-[#80616f]">Cuando entren ventas aparecerán acá automáticamente.</p></div>:<div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{orders.map(o=>{const units=(o.order_items??[]).reduce((s,i)=>s+Number(i.quantity??0),0);return <Link href={`/ventas/${o.id}`} key={o.id} className="pt-card p-4 transition active:scale-[0.995] md:hover:border-[#e4aec5]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold text-[#ad416f]">PEDIDO #{o.order_number}</p><p className="mt-1 truncate font-bold text-[#3e2833]">{o.customer_name_snapshot||"Cliente"}</p></div><StatusBadge value={o.status}/></div><div className="mt-4 space-y-2">{(o.order_items??[]).slice(0,4).map((item,idx)=><div key={idx} className="flex items-start gap-2 text-sm"><span className="min-w-7 rounded-lg bg-[#fff0f6] px-1.5 py-0.5 text-center text-xs font-extrabold text-[#ad416f]">{item.quantity}×</span><span className="min-w-0 flex-1 font-semibold text-[#5c414d]">{item.product_name_snapshot}{item.variant_name_snapshot?` · ${item.variant_name_snapshot}`:""}</span></div>)}{(o.order_items??[]).length>4&&<p className="text-xs text-[#987b88]">+ {(o.order_items??[]).length-4} líneas más</p>}</div><div className="mt-4 flex items-center justify-between border-t border-[#f4e4eb] pt-3"><p className="text-xs text-[#80616f]">{units} unidades{o.shipping_method?` · ${o.shipping_method}`:""}</p><p className="font-extrabold text-[#3e2833]">{formatMoney(o.total,o.currency)}</p></div></Link>})}</div>}
  </main>
}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-[#efd8e2] bg-white p-3 sm:p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-[#917380]">{label}</p><p className="mt-1 text-xl font-extrabold text-[#3e2833] sm:text-2xl">{value}</p></div>}
