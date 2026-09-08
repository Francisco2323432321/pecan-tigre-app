import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import ProductList from "@/components/products/product-list";
import QuickStockEditor from "@/components/products/quick-stock-editor";
import NewProductButton from "./new-product-button";
import SectionNav from "@/components/ui/section-nav";
import { Icon } from "@/components/ui/icons";
import { formatDateTime, formatQuantity } from "@/lib/format";

function choosePrimaryVariant<T extends { base_quantity: number | string | null; tiendanube_variant_id: string | null; active: boolean | null }>(variants: T[], baseUnit: string) {
  const active = variants.filter((variant) => variant.active !== false);
  const target = baseUnit === "g" ? 100 : 1;
  return active.find((variant) => Number(variant.base_quantity) === target && variant.tiendanube_variant_id)
    ?? active.find((variant) => Number(variant.base_quantity) === target)
    ?? active.find((variant) => variant.tiendanube_variant_id)
    ?? active[0]
    ?? null;
}

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; type?: string }> }) {
  const params = await searchParams;
  const view = params.view ?? "catalogo";
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
    return { ...product, sale_sku: primary?.sku ?? null, sale_price: primary?.price ?? null, linked_variant_count: productVariants.filter((variant) => variant.active !== false && variant.tiendanube_variant_id).length, observed_variant_count: observedCountByProduct.get(product.id) ?? 0 };
  });

  const physicalStock = list.filter((product) => product.active && product.inventory_mode !== "DERIVADO").map((product) => ({
    id: product.id, name: product.name, code: product.code, base_unit: product.base_unit,
    on_hand: Number(product.on_hand ?? 0), available_base: Number(product.available_base ?? 0), inventory_mode: product.inventory_mode, image_url: product.image_url,
  }));

  const actions = <>
    <Link href="/productos/importar" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="upload" className="h-4 w-4" />Tiendanube</Link>
    {profile?.role === "ADMIN" && <NewProductButton />}
  </>;

  return <main className="pt-page">
    <PageHeader eyebrow="Catálogo central" title="Productos" description="Producto, stock, precio, mix, combo, receta y trazabilidad desde una sola sección." actions={actions} />
    <SectionNav items={[
      { label: "Catálogo", href: "/productos" },
      { label: "Stock rápido", href: "/productos?view=stock", match: "view=stock" },
      { label: "Movimientos", href: "/productos?view=movimientos", match: "view=movimientos" },
      { label: "Mix · combos · recetas", href: "/productos?view=formulas", match: "view=formulas" },
    ]} />

    {view === "stock" ? <QuickStockEditor items={physicalStock} />
      : view === "movimientos" ? <MovementsView q={params.q ?? ""} type={params.type ?? ""} />
      : view === "formulas" ? <FormulaHub />
      : <>
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

async function MovementsView({ q, type }: { q: string; type: string }) {
  const supabase = await createClient();
  let query = supabase.from("inventory_movements").select("id,product_id,movement_type,on_hand_delta,reserved_delta,reference_type,reference_id,reason,metadata,created_by,created_at,product:products(name,code,base_unit)").order("created_at", { ascending: false }).limit(500);
  if (type) query = query.eq("movement_type", type);
  const { data, error } = await query;
  const rows = (data ?? []).filter((row) => {
    if (!q.trim()) return true;
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    return `${product?.name ?? ""} ${product?.code ?? ""} ${row.reason ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });
  const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const users = userIds.length ? (await supabase.from("profiles").select("id,full_name").in("id", userIds)).data ?? [] : [];
  const userMap = new Map(users.map((u) => [u.id, u.full_name || "Usuario"]));
  const types = [...new Set((data ?? []).map((r) => r.movement_type))].sort();

  return <section className="pt-card overflow-hidden">
    <div className="border-b border-[#f0dce5] p-4 sm:p-5">
      <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]" method="get">
        <input type="hidden" name="view" value="movimientos" />
        <div className="relative"><Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9f8490]" /><input name="q" defaultValue={q} className="pt-input !pl-11" placeholder="Buscar producto, código o motivo…" /></div>
        <select name="type" defaultValue={type} className="pt-input"><option value="">Todos los movimientos</option>{types.map((t) => <option key={t} value={t}>{movementLabel(t)}</option>)}</select>
        <button className="pt-button-secondary px-4">Filtrar</button>
      </form>
    </div>
    {error ? <div className="p-5 text-sm text-[#a54558]">No se pudo cargar el historial: {error.message}</div> : rows.length === 0 ? <div className="p-8 text-center text-sm text-[#80616f]">No hay movimientos para estos filtros.</div> : <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-xs">
        <thead className="bg-[#fbf8fd] text-[10px] uppercase tracking-wide text-[#8d7480]"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Movimiento</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Anterior → Nuevo</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Referencia</th></tr></thead>
        <tbody className="divide-y divide-[#f2e7ec]">{rows.map((row) => {
          const product = Array.isArray(row.product) ? row.product[0] : row.product;
          const unit = product?.base_unit === "g" ? "g" : "u";
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          const before = typeof meta.previous_on_hand === "number" ? meta.previous_on_hand : null;
          const after = typeof meta.new_on_hand === "number" ? meta.new_on_hand : null;
          const delta = Number(row.on_hand_delta ?? 0);
          return <tr key={row.id} className="align-top hover:bg-[#fffafd]"><td className="whitespace-nowrap px-4 py-3 text-[#80616f]">{formatDateTime(row.created_at)}</td><td className="px-4 py-3"><Link href={`/productos/${row.product_id}`} className="font-black text-[#3e2833] hover:underline">{product?.name ?? "Producto"}</Link><div className="mt-0.5 text-[10px] text-[#9a808b]">{product?.code || "Sin código"}</div></td><td className="px-4 py-3 font-black text-[#5c4852]">{movementLabel(row.movement_type)}</td><td className={`px-4 py-3 font-black ${delta > 0 ? "text-[#2f825f]" : delta < 0 ? "text-[#b0445a]" : "text-[#6d5cff]"}`}>{delta > 0 ? "+" : ""}{formatQuantity(delta)} {unit}</td><td className="px-4 py-3 text-[#5f4c57]">{before !== null && after !== null ? `${formatQuantity(before)} → ${formatQuantity(after)} ${unit}` : "—"}</td><td className="px-4 py-3 text-[#80616f]">{row.reason || row.reference_type || "—"}</td><td className="px-4 py-3 text-[#80616f]">{row.created_by ? userMap.get(row.created_by) ?? "Usuario" : "Sistema"}</td><td className="px-4 py-3 text-[#80616f]">{row.reference_type ? `${row.reference_type}${row.reference_id ? ` · ${row.reference_id}` : ""}` : "—"}</td></tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}

function movementLabel(value: string) {
  const labels: Record<string, string> = { PURCHASE: "Compra", SALE: "Venta", RESERVE: "Reserva", RELEASE: "Liberación", ADJUSTMENT: "Ajuste manual", STOCK_SET: "Stock establecido", STOCK_COUNT: "Conteo físico", PRODUCTION_IN: "Producción", PRODUCTION_OUT: "Consumo receta", CANCEL: "Cancelación" };
  return labels[value] ?? value.replaceAll("_", " ");
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
