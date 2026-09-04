import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import StockCountForm from "./stock-count-form";

export default async function StockCountPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("product_stock_overview").select("id,name,code,base_unit,on_hand,inventory_mode").eq("active", true).in("inventory_mode", ["PROPIO", "PRODUCIDO"]).order("name");
  return <main className="w-full p-4 sm:p-5 md:p-6 xl:p-8"><PageHeader eyebrow="Control físico" title="Conteo semanal" description="Ingresá lo que realmente tenés. El sistema guarda cada diferencia como movimiento auditado, sin borrar el historial." /><StockCountForm items={(data ?? []).map((i) => ({ ...i, on_hand: Number(i.on_hand ?? 0) }))} /></main>;
}
