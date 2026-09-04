import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import StockList from "@/components/stock/stock-list";
import { Icon } from "@/components/ui/icons";
import { argentinaTodayRangeUTC } from "@/lib/date";

export default async function StockPage() {
  const supabase = await createClient();
  const { start } = argentinaTodayRangeUTC();
  const [{ data: items, error }, { count: movementsToday }] = await Promise.all([
    supabase.from("product_stock_overview").select("id,name,code,product_kind,inventory_mode,base_unit,on_hand,reserved,available_base,minimum_stock,active").eq("active", true).order("name"),
    supabase.from("inventory_movements").select("id", { count: "exact", head: true }).gte("created_at", start),
  ]);

  const list = items ?? [];
  const critical = list.filter((p) => p.inventory_mode !== "DERIVADO" && Number(p.minimum_stock ?? 0) > 0 && Number(p.available_base ?? 0) <= Number(p.minimum_stock ?? 0)).length;
  const reserved = list.filter((p) => Number(p.reserved ?? 0) > 0).length;
  const derived = list.filter((p) => p.inventory_mode === "DERIVADO").length;

  return (
    <main className="w-full p-4 sm:p-5 md:p-6 xl:p-8">
      <PageHeader eyebrow="Inventario central" title="Stock" description="Una sola fuente de verdad para físico, reservado y disponible. Los mixes y combos se calculan desde sus ingredientes." actions={<><Link href="/stock/conteo" className="pt-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"><Icon name="stock" className="h-4 w-4" />Conteo semanal</Link><Link href="/productos" className="pt-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm"><Icon name="plus" className="h-4 w-4" />Producto</Link></>} />

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini label="Productos" value={String(list.length)} detail="Activos" />
        <Mini label="Stock crítico" value={String(critical)} detail="Bajo mínimo" danger={critical > 0} />
        <Mini label="Con reservas" value={String(reserved)} detail="Pedidos pendientes" />
        <Mini label="Movimientos hoy" value={String(movementsToday ?? 0)} detail={`${derived} derivados`} />
      </section>

      {error ? <div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudo cargar el stock: {error.message}</div> : <StockList items={list} />}
    </main>
  );
}

function Mini({ label, value, detail, danger }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-[#efc3cc] bg-[#fff8f9]" : "border-[#efd8e2] bg-white"}`}><p className="text-[11px] font-bold uppercase tracking-wide text-[#8f7180]">{label}</p><p className={`mt-1.5 text-2xl font-extrabold ${danger ? "text-[#aa4558]" : "text-[#3e2833]"}`}>{value}</p><p className="mt-0.5 text-[11px] text-[#987b88]">{detail}</p></div>;
}
