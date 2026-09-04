import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import PrintButton from "./print-button";

export default async function PreparationPage(){
  const supabase=await createClient();
  const {data:orders}=await supabase.from("orders").select("id,order_number,customer_name_snapshot,status,created_at,notes,order_items(quantity,product_name_snapshot,variant_name_snapshot,sku_snapshot)").in("status",["NUEVO","CONFIRMADO","PREPARANDO"]).order("created_at",{ascending:true});
  const list=orders??[];
  const consolidated=new Map<string,number>();
  list.forEach(o=>(o.order_items??[]).forEach(i=>{const key=`${i.product_name_snapshot}${i.variant_name_snapshot?` · ${i.variant_name_snapshot}`:""}`;consolidated.set(key,(consolidated.get(key)??0)+Number(i.quantity??0));}));
  return <main className="w-full p-4 sm:p-5 md:p-6 xl:p-8 print:p-0"><div className="no-print"><PageHeader eyebrow="Armado de pedidos" title="Hoja de preparación" description="Usala desde el celular o guardala como PDF. Resume primero todo lo necesario y después separa pedido por pedido." actions={<PrintButton/>}/></div>
    <div className="mx-auto max-w-5xl space-y-4 print:max-w-none print:space-y-3">
      <section className="rounded-2xl border border-[#efd8e2] bg-white p-5 print:rounded-none print:border-black"><div className="flex items-end justify-between"><div><p className="text-xs font-extrabold tracking-[0.2em] text-[#ad416f] print:text-black">PECÁN TIGRE</p><h1 className="mt-1 text-2xl font-extrabold text-[#3e2833] print:text-black">Preparación de pedidos</h1></div><p className="text-xs text-[#80616f] print:text-black">{list.length} pedidos</p></div><h2 className="mt-5 border-b border-[#eadce2] pb-2 text-sm font-extrabold uppercase tracking-wide print:border-black">Total a preparar</h2><div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">{Array.from(consolidated.entries()).map(([name,qty])=><div key={name} className="flex justify-between gap-4 text-sm"><span>{name}</span><strong>{qty}×</strong></div>)}</div></section>
      {list.map((o,index)=><section key={o.id} className="break-inside-avoid rounded-2xl border border-[#efd8e2] bg-white p-5 print:rounded-none print:border-black"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-[#ad416f] print:text-black">PEDIDO {index+1} · #{o.order_number}</p><h2 className="mt-1 text-lg font-extrabold text-[#3e2833] print:text-black">{o.customer_name_snapshot||"Cliente"}</h2><p className="mt-0.5 text-xs text-[#80616f] print:text-black">{formatDateTime(o.created_at)}</p></div><div className="h-6 w-6 border-2 border-[#ba8da0] print:border-black"/></div><div className="mt-4 divide-y divide-[#f0e4e9] print:divide-black">{(o.order_items??[]).map((i,idx)=><div key={idx} className="flex items-center gap-3 py-2.5"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#fff0f6] px-1 text-sm font-extrabold print:bg-white">{i.quantity}×</span><span className="font-bold">{i.product_name_snapshot}</span><span className="ml-auto text-sm">{i.variant_name_snapshot||""}</span></div>)}</div>{o.notes&&<p className="mt-3 text-xs"><strong>Nota:</strong> {o.notes}</p>}</section>)}
    </div>
  </main>
}
