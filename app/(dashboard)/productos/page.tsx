import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import ProductList from "@/components/products/product-list";
import QuickStockEditor from "@/components/products/quick-stock-editor";
import NewProductButton from "./new-product-button";
import SectionNav from "@/components/ui/section-nav";
import { Icon } from "@/components/ui/icons";

function choosePrimaryVariant<T extends { base_quantity: number | string | null; tiendanube_variant_id: string | null; active: boolean | null }>(variants: T[], baseUnit: string) {
  const active = variants.filter((variant) => variant.active !== false);
  const target = baseUnit === "g" ? 100 : 1;
  return active.find((variant) => Number(variant.base_quantity) === target && variant.tiendanube_variant_id)
    ?? active.find((variant) => variant.tiendanube_variant_id)
    ?? active.find((variant) => Number(variant.base_quantity) === target)
    ?? active[0]
    ?? null;
}

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "catalogo" } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [productsResult, variantsResult, observationsResult] = await Promise.all([
    supabase.from("product_stock_overview").select("id,name,code,description,product_kind,inventory_mode,base_unit,on_hand,reserved,available_base,minimum_stock,active,image_url,category,visible,published,tiendanube_handle").order("name"),
    supabase.from("product_variants").select("id,product_id,sku,base_quantity,price,tiendanube_variant_id,active"),
    supabase.from("tiendanube_variant_observations").select("linked_local_product_id,tiendanube_variant_id"),
  ]);

  const list = productsResult.data ?? [];
  const variants = variantsResult.data ?? [];
  const observations = observationsResult.error ? [] : (observationsResult.data ?? []);
  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const group = variantsByProduct.get(variant.product_id) ?? [];
    group.push(variant);
    variantsByProduct.set(variant.product_id, group);
  }

  const observedCountByProduct = new Map<string, number>();
  let unlinkedObservations = 0;
  for (const observation of observations) {
    if (!observation.linked_local_product_id) { unlinkedObservations += 1; continue; }
    observedCountByProduct.set(observation.linked_local_product_id, (observedCountByProduct.get(observation.linked_local_product_id) ?? 0) + 1);
  }

  const enriched = list.map((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const primary = choosePrimaryVariant(productVariants, product.base_unit);
    return {
      ...product,
      sale_sku: primary?.sku ?? null,
      sale_price: primary?.price ?? null,
      linked_variant_count: productVariants.filter((variant) => variant.active !== false && variant.tiendanube_variant_id).length,
      observed_variant_count: observedCountByProduct.get(product.id) ?? 0,
    };
  });

  const physicalStock = list
    .filter((product) => product.active && product.inventory_mode !== "DERIVADO")
    .map((product) => ({
      id: product.id,
      name: product.name,
      code: product.code,
      base_unit: product.base_unit,
      on_hand: Number(product.on_hand ?? 0),
      available_base: Number(product.available_base ?? 0),
      inventory_mode: product.inventory_mode,
      image_url: product.image_url,
    }));

  const actions = <>
    <Link href="/productos/importar" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="upload" className="h-4 w-4" />Tiendanube</Link>
    {profile?.role === "ADMIN" && <NewProductButton />}
  </>;

  return <main className="pt-page">
    <PageHeader eyebrow="Catálogo central" title="Productos" description="Producto, stock, precio, mix, combo y receta desde una sola sección." actions={actions} />

    <SectionNav items={[
      { label: "Catálogo", href: "/productos" },
      { label: "Stock rápido", href: "/productos?view=stock", match: "view=stock" },
      { label: "Mix · combos · recetas", href: "/productos?view=formulas", match: "view=formulas" },
    ]} />

    {view === "stock" ? <QuickStockEditor items={physicalStock} /> : view === "formulas" ? <FormulaHub /> : <>
      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini label="Productos" value={String(list.length)} detail="activos e históricos" />
        <Mini label="100 g" value={String(list.filter((product) => product.base_unit === "g").length)} detail="venta por packs" />
        <Mini label="Unidad" value={String(list.filter((product) => product.base_unit !== "g").length)} detail="venta por unidad" />
        <Mini label="Alertas Tiendanube" value={String(unlinkedObservations)} detail="opciones no vinculadas" danger={unlinkedObservations > 0} />
      </section>
      {productsResult.error ? <div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudo cargar el catálogo: {productsResult.error.message}</div> : <ProductList products={enriched} />}
    </>}
  </main>;
}

function FormulaHub() {
  const cards = [
    ["Mixes", "/mixes", "mix", "Porcentajes, ingredientes y costo del mix."],
    ["Combos", "/combos", "combo", "Productos agrupados, ahorro y margen."],
    ["Recetas", "/recetas", "recipe", "Ingredientes y cantidades para elaborados."],
    ["Producción", "/produccion", "production", "Registrar lotes y consumo de ingredientes."],
  ] as const;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, href, icon, description]) => <Link key={href} href={href} className="pt-card group p-5 transition hover:-translate-y-0.5 hover:border-[#e6b2c8]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f6] text-[#bd4d7a]"><Icon name={icon} className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-black text-[#3e2833]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#80616f]">{description}</p><span className="mt-4 inline-flex text-xs font-extrabold text-[#ad416f]">Abrir →</span></Link>)}</div>;
}

function Mini({ label, value, detail, danger }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-[#efc3cc] bg-[#fff8f9]" : "border-[#efd8e2] bg-white"}`}><p className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#917380]">{label}</p><p className={`mt-1 text-2xl font-black ${danger ? "text-[#aa4558]" : "text-[#3e2833]"}`}>{value}</p><p className="mt-0.5 text-[11px] text-[#987b88]">{detail}</p></div>;
}
