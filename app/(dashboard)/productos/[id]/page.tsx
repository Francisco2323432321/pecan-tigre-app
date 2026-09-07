import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import RecipeManager from "@/components/products/recipe-manager";
import StockAdjustmentButton from "@/components/stock/stock-adjustment-button";
import { Icon } from "@/components/ui/icons";
import { updateProduct, updateSaleOption } from "./actions";

function choosePrimaryVariant<T extends { base_quantity: number | string | null; tiendanube_variant_id: string | null; active: boolean | null }>(variants: T[], baseUnit: string) {
  const active = variants.filter((variant) => variant.active !== false);
  const target = baseUnit === "g" ? 100 : 1;
  return active.find((variant) => Number(variant.base_quantity) === target && variant.tiendanube_variant_id)
    ?? active.find((variant) => variant.tiendanube_variant_id)
    ?? active.find((variant) => Number(variant.base_quantity) === target)
    ?? active[0]
    ?? null;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [productRes, variantsRes, recipeRes, optionsRes, movementsRes] = await Promise.all([
    supabase.from("product_stock_overview").select("id,name,code,description,category,product_kind,inventory_mode,base_unit,on_hand,reserved,available_base,minimum_stock,current_cost,image_url,visible,published,active,tiendanube_product_id,tiendanube_handle,tiendanube_last_sync_at").eq("id", id).maybeSingle(),
    supabase.from("product_variants").select("id,name,sku,base_quantity,price,promo_price,cost,shipping_weight_g,tiendanube_variant_id,tiendanube_stock,active,visible").eq("product_id", id).order("base_quantity", { ascending: true }),
    supabase.from("recipes").select("id,name,output_quantity_base,status,waste_percentage").eq("output_product_id", id).eq("status", "ACTIVA").maybeSingle(),
    supabase.from("products").select("id,name,base_unit,current_cost").eq("active", true).order("name"),
    supabase.from("inventory_movements").select("id,movement_type,on_hand_delta,reserved_delta,reason,reference_type,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(12),
  ]);

  const product = productRes.data;
  if (!product) notFound();

  const observationsRes = product.tiendanube_product_id
    ? await supabase.from("tiendanube_variant_observations").select("tiendanube_variant_id,sku,stock,option_label,seen_at").eq("tiendanube_product_id", String(product.tiendanube_product_id)).order("tiendanube_variant_id")
    : { data: [], error: null };

  const variants = variantsRes.data ?? [];
  const primaryVariant = choosePrimaryVariant(variants, product.base_unit);
  const observations = observationsRes.error ? [] : (observationsRes.data ?? []);
  const multipleTnOptions = observations.length > 1;

  const recipe = recipeRes.data;
  let recipeItems: Array<{ id: string; quantity_base: number | string; notes: string | null; ingredient: { id: string; name: string; base_unit: string } | null }> = [];
  if (recipe) {
    const { data: raw } = await supabase.from("recipe_items").select("id,ingredient_product_id,quantity_base,notes").eq("recipe_id", recipe.id).order("created_at");
    const options = optionsRes.data ?? [];
    const byId = new Map(options.map((option) => [option.id, option]));
    recipeItems = (raw ?? []).map((item) => ({ id: item.id, quantity_base: item.quantity_base, notes: item.notes, ingredient: byId.get(item.ingredient_product_id) ?? null }));
  }

  const canEdit = profile?.role === "ADMIN";
  const canAdjust = profile?.role === "ADMIN" || profile?.role === "OPERADOR";
  const hasPhysical = product.inventory_mode !== "DERIVADO";
  const usesRecipe = ["MIX", "COMBO", "ELABORADO"].includes(product.product_kind) || ["DERIVADO", "PRODUCIDO"].includes(product.inventory_mode);
  const saleUnit = product.base_unit === "g" ? "100 g" : "Unidad";
  const availablePacks = product.base_unit === "g" ? Math.floor(Number(product.available_base ?? 0) / 100) : Math.floor(Number(product.available_base ?? 0));

  return <main className="pt-page">
    <PageHeader eyebrow={kindLabel(product.product_kind)} title={product.name} description={`${product.code || product.tiendanube_handle || "Sin código"} · ${saleUnit}`} actions={hasPhysical && canAdjust ? <StockAdjustmentButton productId={product.id} productName={product.name} unit={product.base_unit === "g" ? "g" : "u"} current={Number(product.on_hand ?? 0)} /> : undefined} />

    {multipleTnOptions && <div className="mb-4 rounded-[18px] border border-[#ead7a9] bg-[#fffaf0] p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1c8] text-[#8c681d]"><Icon name="alert" className="h-5 w-5" /></span><div><p className="font-extrabold text-[#644d20]">Tiendanube tiene {observations.length} variantes para este producto</p><p className="mt-1 text-sm leading-6 text-[#806a3d]">La app las detectó y las muestra abajo, pero no sincronizará stock automáticamente para este producto hasta que definamos cómo debe repartirse. Así una variante futura no nos toma por sorpresa.</p></div></div></div>}

    <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Físico" value={hasPhysical ? `${formatQuantity(product.on_hand)} ${product.base_unit === "g" ? "g" : "u"}` : "—"} />
      <Metric label="Reservado" value={hasPhysical ? `${formatQuantity(product.reserved)} ${product.base_unit === "g" ? "g" : "u"}` : "—"} />
      <Metric label="Disponible" value={`${formatQuantity(product.available_base)} ${product.base_unit === "g" ? "g" : "u"}`} strong />
      <Metric label={product.base_unit === "g" ? "Packs vendibles" : "Unidades vendibles"} value={String(availablePacks)} />
    </section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.45fr_.8fr]">
      <div className="min-w-0 space-y-4">
        <section className="pt-card overflow-hidden">
          <div className="border-b border-[#f2e0e8] px-4 py-4 sm:px-5"><p className="pt-section-title">Venta</p><h2 className="mt-1 font-black text-[#3e2833]">{saleUnit}</h2><p className="mt-0.5 text-xs text-[#896b78]">La operación actual usa una sola presentación comercial por producto.</p></div>
          {primaryVariant ? canEdit ? <form action={updateSaleOption} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="variant_id" value={primaryVariant.id} />
            <Field label="SKU"><input className="pt-input" name="sku" defaultValue={primaryVariant.sku ?? ""} placeholder="FS-ALM-01" /></Field>
            <Field label="Precio"><input className="pt-input" type="number" min="0" step="0.01" name="price" defaultValue={String(primaryVariant.price ?? 0)} /></Field>
            <Field label="Precio promocional"><input className="pt-input" type="number" min="0" step="0.01" name="promo_price" defaultValue={primaryVariant.promo_price == null ? "" : String(primaryVariant.promo_price)} /></Field>
            <Field label="Costo de venta"><input className="pt-input" type="number" min="0" step="0.0001" name="cost" defaultValue={primaryVariant.cost == null ? "" : String(primaryVariant.cost)} /></Field>
            <Field label="Peso para envío (g)"><input className="pt-input" type="number" min="0" step="1" name="shipping_weight_g" defaultValue={primaryVariant.shipping_weight_g == null ? "" : String(primaryVariant.shipping_weight_g)} /></Field>
            <div className="flex items-end"><button className="pt-button-primary w-full px-4">Guardar venta</button></div>
          </form> : <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5"><Info k="SKU" v={primaryVariant.sku || "—"} /><Info k="Precio" v={formatMoney(primaryVariant.promo_price ?? primaryVariant.price)} /><Info k="Tiendanube" v={primaryVariant.tiendanube_variant_id ? "Vinculado" : "Pendiente"} /></div> : <div className="p-5 text-sm text-[#80616f]">Este producto todavía no tiene una opción de venta local. Volvé a sincronizar el catálogo de Tiendanube o recrealo desde Productos.</div>}
        </section>

        {usesRecipe && <RecipeManager productId={product.id} productName={product.name} unit={product.base_unit} recipe={recipe} items={recipeItems} options={optionsRes.data ?? []} canEdit={canEdit} mode={product.inventory_mode} />}

        {observations.length > 1 && <section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-4 py-4 sm:px-5"><p className="pt-section-title">Compatibilidad futura</p><h2 className="mt-1 font-black text-[#3e2833]">Variantes detectadas en Tiendanube</h2><p className="mt-0.5 text-xs text-[#896b78]">Solo lectura. Todavía no se usa esta información para descontar stock.</p></div><div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">{observations.map((option) => <div key={option.tiendanube_variant_id} className="rounded-2xl border border-[#f0dfe7] bg-[#fffafd] p-3"><p className="text-sm font-extrabold text-[#3e2833]">{option.option_label || option.sku || `Variante ${option.tiendanube_variant_id}`}</p><p className="mt-1 text-xs text-[#8d6878]">SKU: {option.sku || "—"}</p><p className="mt-0.5 text-xs text-[#8d6878]">Stock informado por TN: {option.stock ?? "—"}</p></div>)}</div></section>}

        <section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-4 py-4 sm:px-5"><h2 className="font-black text-[#3e2833]">Movimientos recientes</h2><p className="mt-0.5 text-xs text-[#896b78]">El inventario no se modifica sin dejar historial.</p></div>{(movementsRes.data ?? []).length === 0 ? <div className="p-6 text-sm text-[#80616f]">Todavía no hay movimientos registrados.</div> : <div className="divide-y divide-[#f5e7ed]">{(movementsRes.data ?? []).map((movement) => <div key={movement.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#3e2833]">{movementLabel(movement.movement_type)}</p><p className="mt-0.5 text-xs text-[#987b88]">{movement.reason || movement.reference_type || "Movimiento"} · {formatDateTime(movement.created_at)}</p></div><div className="shrink-0 text-right text-xs font-extrabold"><p className={Number(movement.on_hand_delta) >= 0 ? "text-[#36785b]" : "text-[#aa4558]"}>{Number(movement.on_hand_delta) === 0 ? "" : `${Number(movement.on_hand_delta) > 0 ? "+" : ""}${formatQuantity(movement.on_hand_delta)}`}</p>{Number(movement.reserved_delta) !== 0 && <p className="text-[#ad416f]">res {Number(movement.reserved_delta) > 0 ? "+" : ""}{formatQuantity(movement.reserved_delta)}</p>}</div></div>)}</div>}</section>
      </div>

      <aside className="min-w-0 space-y-4">
        <section className="pt-card overflow-hidden">
          <div className="aspect-square bg-gradient-to-br from-[#fff1f7] to-[#fffafd]">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#c65b88]"><Icon name="package" className="h-16 w-16" /></div>}</div>
          <div className="p-4 sm:p-5"><h2 className="font-black text-[#3e2833]">Ficha del producto</h2>{canEdit ? <form action={updateProduct} className="mt-4 space-y-3"><input type="hidden" name="product_id" value={product.id} /><Field label="Nombre"><input className="pt-input" name="name" defaultValue={product.name} required /></Field><div className="grid grid-cols-2 gap-3"><Field label="Código"><input className="pt-input" name="code" defaultValue={product.code ?? ""} /></Field><Field label="Categoría"><input className="pt-input" name="category" defaultValue={product.category ?? ""} /></Field></div><Field label="Descripción"><textarea className="pt-input min-h-24 resize-y" name="description" defaultValue={product.description ?? ""} /></Field><Field label="URL de imagen"><input className="pt-input" type="url" name="image_url" defaultValue={product.image_url ?? ""} placeholder="https://…" /></Field><div className="grid grid-cols-2 gap-3"><Field label={`Stock mínimo (${product.base_unit === "g" ? "g" : "u"})`}><input className="pt-input" type="number" min="0" step="1" name="minimum_stock" defaultValue={String(product.minimum_stock ?? 0)} /></Field><Field label="Costo base"><input className="pt-input" type="number" min="0" step="0.0001" name="current_cost" defaultValue={String(product.current_cost ?? 0)} /></Field></div><div className="flex flex-wrap gap-4"><Check name="active" label="Activo" checked={product.active} /><Check name="visible" label="Visible" checked={product.visible} /><Check name="published" label="Publicado" checked={product.published} /></div><button className="pt-button-primary w-full px-4">Guardar ficha</button></form> : <p className="mt-4 text-xs text-[#80616f]">Solo ADMIN puede editar la ficha.</p>}</div>
        </section>

        <section className="pt-card p-4 sm:p-5"><p className="pt-section-title">Tiendanube</p><div className="mt-4 space-y-3 text-xs"><InfoRow k="Identificador URL" v={product.tiendanube_handle || "No vinculado"} /><InfoRow k="Product ID" v={product.tiendanube_product_id || "Pendiente"} /><InfoRow k="Última sync" v={product.tiendanube_last_sync_at ? formatDateTime(product.tiendanube_last_sync_at) : "Nunca"} /><InfoRow k="Variantes vistas" v={observations.length ? String(observations.length) : "1 o sin sincronizar"} /></div></section>
      </aside>
    </div>
  </main>;
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={`rounded-2xl border p-4 ${strong ? "border-[#edbfd2] bg-[#fff0f6]" : "border-[#efd8e2] bg-white"}`}><p className="text-[10px] font-extrabold uppercase tracking-wide text-[#917380]">{label}</p><p className={`mt-1.5 text-xl font-black sm:text-2xl ${strong ? "text-[#ad416f]" : "text-[#3e2833]"}`}>{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="pt-label">{label}</span>{children}</label>; }
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="flex items-center gap-2 text-xs font-extrabold text-[#80616f]"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label>; }
function InfoRow({ k, v }: { k: string; v: string }) { return <div className="flex items-start justify-between gap-3"><span className="text-[#8d6878]">{k}</span><strong className="max-w-[65%] break-all text-right text-[#4d2938]">{v}</strong></div>; }
function Info({ k, v }: { k: string; v: string }) { return <div className="rounded-xl bg-[#fffafd] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wide text-[#9a7a88]">{k}</p><p className="mt-1 text-sm font-black text-[#3e2833]">{v}</p></div>; }
function kindLabel(value: string) { return ({ INSUMO: "Materia prima", MIX: "Mix", ELABORADO: "Elaborado", COMBO: "Combo" } as Record<string, string>)[value] ?? value; }
function movementLabel(value: string) { return ({ PURCHASE: "Compra", SALE: "Venta", RESERVATION: "Reserva", RELEASE: "Reserva liberada", ADJUSTMENT: "Ajuste", STOCK_COUNT: "Conteo físico", PRODUCTION_IN: "Producción ingresada", PRODUCTION_OUT: "Ingrediente consumido" } as Record<string, string>)[value] ?? value; }
