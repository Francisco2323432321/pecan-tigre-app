import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import SectionNav from "@/components/ui/section-nav";
import { Icon } from "@/components/ui/icons";

type Rel = { name: string; base_unit: string };

export default async function ComprasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchases").select("id,supplier_name,status,total,products_total,shipping_cost,other_costs,document_number,notes,received_at,created_at,purchase_items(quantity_base,unit_cost,effective_unit_cost,total_cost,product:products(name,base_unit))").order("created_at", { ascending: false }).limit(80);
  const list = data ?? [];
  const total = list.filter((purchase) => purchase.status === "RECIBIDA").reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0);

  return <main className="pt-page">
    <PageHeader eyebrow="Abastecimiento" title="Compras" description="Compras, proveedores, comprobantes y costos de ingreso en una sola sección." actions={<Link href="/compras/nueva" className="pt-button-primary inline-flex items-center gap-2 px-4 text-sm"><Icon name="plus" className="h-4 w-4" />Cargar compra</Link>} />
    <SectionNav items={[
      { label: "Compras", href: "/compras" },
      { label: "Proveedores", href: "/proveedores" },
    ]} />
    <section className="mb-4 grid grid-cols-2 gap-3"><Mini label="Compras registradas" value={String(list.length)} /><Mini label="Valor registrado" value={formatMoney(total)} /></section>
    {error ? <div className="rounded-2xl bg-[#fff3f4] p-4 text-sm text-[#a94658]">{error.message}</div> : <section className="pt-card overflow-hidden">{list.length === 0 ? <EmptyState icon="purchases" title="Todavía no hay compras" description="Usá Cargar compra para ingresar mercadería y actualizar stock." /> : <div className="divide-y divide-[#f5e7ed]">{list.map((purchase) => <div key={purchase.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-[#3e2833]">{purchase.supplier_name}</p><p className="mt-0.5 text-xs text-[#987b88]">{formatDateTime(purchase.received_at || purchase.created_at)} · {purchase.status}{purchase.document_number ? ` · Comprobante ${purchase.document_number}` : ""}</p></div><p className="font-black text-[#3e2833]">{formatMoney(purchase.total)}</p></div><div className="mt-3 grid gap-1.5">{(purchase.purchase_items ?? []).map((item, index) => { const relation = (Array.isArray(item.product) ? item.product[0] : item.product) as Rel | undefined; return <p key={index} className="text-sm text-[#725562]"><strong>{relation?.name ?? "Producto"}</strong> · {formatQuantity(item.quantity_base)} {relation?.base_unit ?? ""} · costo efectivo {formatMoney(item.effective_unit_cost ?? item.unit_cost)}</p>; })}</div>{Number(purchase.shipping_cost) > 0 && <p className="mt-2 text-xs text-[#987b88]">Envío: {formatMoney(purchase.shipping_cost)}{Number(purchase.other_costs) > 0 ? ` · otros: ${formatMoney(purchase.other_costs)}` : ""}</p>}</div>)}</div>}</section>}
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-[20px] border border-[#ecd6e0] bg-white p-4 shadow-[0_6px_18px_rgba(82,42,60,.035)]"><p className="text-[10px] font-extrabold uppercase tracking-wide text-[#917380]">{label}</p><p className="mt-1 text-xl font-black text-[#3e2833] sm:text-2xl">{value}</p></div>; }
