import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import NewProductionButton from "@/components/production/new-production-button";
import EmptyState from "@/components/ui/empty-state";

type ProductRelation = { name: string; base_unit: string };

export default async function ProduccionPage() {
  const supabase = await createClient();
  const [{ data: batches }, { data: products }] = await Promise.all([
    supabase.from("production_batches").select("id,output_quantity_base,waste_quantity,actual_cost,status,notes,created_at,product:products(name,base_unit)").order("created_at", { ascending: false }).limit(60),
    supabase.from("products").select("id,name,base_unit").eq("active", true).eq("inventory_mode", "PRODUCIDO").order("name"),
  ]);

  return (
    <main className="pt-page">
      <PageHeader
        eyebrow="Elaboraciones"
        title="Producción"
        description="Transformá ingredientes en stock de granola u otros elaborados sin descontar dos veces la receta."
        actions={<NewProductionButton products={products ?? []} />}
      />
      <section className="pt-card overflow-hidden">
        {(batches ?? []).length === 0 ? (
          <EmptyState icon="production" title="Sin producciones registradas" description="Primero configurá un producto como Elaborado previamente y definí su receta." />
        ) : (
          <div className="divide-y divide-[#f5e7ed]">
            {(batches ?? []).map((batch) => {
              const relation = (Array.isArray(batch.product) ? batch.product[0] : batch.product) as ProductRelation | undefined;
              return (
                <div key={batch.id} className="flex items-start gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#3e2833]">{relation?.name ?? "Elaborado"}</p>
                    <p className="mt-0.5 text-xs text-[#987b88]">{formatDateTime(batch.created_at)}{batch.notes ? ` · ${batch.notes}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="font-extrabold text-[#ad416f]">+{formatQuantity(batch.output_quantity_base)} {relation?.base_unit ?? ""}</p>{Number(batch.waste_quantity)>0&&<p className="text-[10px] text-[#a94658]">merma {formatQuantity(batch.waste_quantity)}</p>}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
