"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import StatusBadge from "@/components/ui/status-badge";
import { formatDateTime, formatMoney } from "@/lib/format";

type Order = {
  id: string;
  order_number: string;
  customer_name_snapshot: string | null;
  total: number | string;
  currency: string;
  status: string;
  payment_status: string;
  inventory_state: string;
  shipping_method: string | null;
  created_at: string;
  order_items: Array<{ quantity: number }> | null;
};

const filters = [["TODOS","Todos"],["HOY","Hoy"],["ABIERTOS","Abiertos"],["PAGADOS","Pagados"],["ENVIADOS","Enviados"]] as const;

export default function SalesList({ orders, todayStart }: { orders: Order[]; todayStart: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("TODOS");
  const list = useMemo(() => orders.filter((o) => {
    const q = query.trim().toLowerCase();
    if (q && !`${o.order_number} ${o.customer_name_snapshot ?? ""}`.toLowerCase().includes(q)) return false;
    if (filter === "HOY") return o.created_at >= todayStart;
    if (filter === "ABIERTOS") return ["NUEVO","CONFIRMADO","PREPARANDO","PREPARADO"].includes(o.status);
    if (filter === "PAGADOS") return o.payment_status === "PAGADO";
    if (filter === "ENVIADOS") return o.status === "ENVIADO";
    return true;
  }), [orders, query, filter, todayStart]);

  return <section className="pt-card overflow-hidden">
    <div className="border-b border-[#f2e0e8] p-3 sm:p-4"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a58a96]"/><input className="pt-input pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar pedido o cliente…"/></div><div className="pt-scrollbar-none mt-3 flex gap-2 overflow-x-auto">{filters.map(([k,l])=><button key={k} onClick={()=>setFilter(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter===k?"bg-[#d65f91] text-white":"bg-[#fff1f7] text-[#895f72]"}`}>{l}</button>)}</div></div>
    {list.length === 0 ? <div className="p-10 text-center text-sm text-[#80616f]">No hay ventas para mostrar.</div> : <div className="divide-y divide-[#f5e7ed]">{list.map((o)=>{const units=(o.order_items??[]).reduce((s,i)=>s+Number(i.quantity??0),0);return <Link key={o.id} href={`/ventas/${o.id}`} className="block p-4 transition hover:bg-[#fffafd] sm:p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f6] text-xs font-extrabold text-[#ad416f]">#{o.order_number}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#3e2833]">{o.customer_name_snapshot||"Cliente"}</p><p className="mt-0.5 text-xs text-[#987b88]">{formatDateTime(o.created_at)} · {units} unidades{o.shipping_method?` · ${o.shipping_method}`:""}</p><div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge value={o.status}/><StatusBadge value={o.payment_status}/><StatusBadge value={o.inventory_state}/></div></div><div className="shrink-0 text-right"><p className="font-extrabold text-[#3e2833]">{formatMoney(o.total,o.currency)}</p><Icon name="arrow" className="ml-auto mt-2 h-4 w-4 text-[#b69aa7]"/></div></div></Link>})}</div>}
  </section>;
}
