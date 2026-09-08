import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type TNImage = { id?: number | string; src?: string | null; position?: number | null };
type TNVariant = { id: number | string; sku?: string | null; stock?: number | null; price?: string | number | null; promotional_price?: string | number | null; values?: unknown[] | null };
type TNProduct = { id: number | string; name?: { es?: string } | string | null; handle?: { es?: string } | string | null; images?: TNImage[] | null; variants?: TNVariant[] | null };
type LocalVariant = {
  id: string;
  product_id: string;
  sku: string | null;
  base_quantity: number | string | null;
  tiendanube_variant_id: string | null;
  products: { tiendanube_product_id: string | null; base_unit: string } | Array<{ tiendanube_product_id: string | null; base_unit: string }>;
};
type ProductLink = { id: string; tiendanube_product_id: string; tiendanube_handle: string | null; image_url: string | null; variant_count: number };

const normalizeSku = (value?: string | null) => value?.trim() ?? "";
function relation<T>(value: T | T[]): T | undefined { return Array.isArray(value) ? value[0] : value; }
function getHandle(product: TNProduct) { return typeof product.handle === "string" ? product.handle : product.handle?.es ?? null; }
function chooseMainImage(images?: TNImage[] | null) {
  const valid = (images ?? []).filter((image) => typeof image.src === "string" && image.src.trim().length > 0);
  if (!valid.length) return null;
  const main = valid.find((image) => Number(image.position) === 1) ?? [...valid].sort((a, b) => Number(a.position ?? 9999) - Number(b.position ?? 9999))[0];
  return main?.src?.trim() ?? null;
}
function extractImages(payload: unknown): TNImage[] {
  if (Array.isArray(payload)) return payload as TNImage[];
  if (payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: TNImage[] }).data;
  if (payload && typeof payload === "object" && "images" in payload && Array.isArray((payload as { images?: unknown }).images)) return (payload as { images: TNImage[] }).images;
  return [];
}
function optionLabel(variant: TNVariant) {
  const values = (variant.values ?? []).flatMap((value) => {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      const candidate = object.es ?? object.name ?? object.value;
      return typeof candidate === "string" ? [candidate] : [];
    }
    return [];
  }).filter(Boolean);
  return values.length ? values.join(" · ") : null;
}

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();
    const { data: connection, error: connectionError } = await supabase.from("tiendanube_connections").select("store_id,access_token").order("connected_at", { ascending: false }).limit(1).maybeSingle();
    if (connectionError) throw new Error(connectionError.message);
    if (!connection) return NextResponse.json({ ok: false, error: "Tiendanube no está conectada" }, { status: 400 });

    const appId = process.env.TIENDANUBE_APP_ID;
    if (!appId) return NextResponse.json({ ok: false, error: "Falta TIENDANUBE_APP_ID" }, { status: 500 });
    const headers = { Authorization: `Bearer ${connection.access_token}`, "User-Agent": `Pecan Tigre (${appId})`, Accept: "application/json" };

    const { data: localVariantsRaw, error: localVariantsError } = await supabase.from("product_variants").select(`id,product_id,sku,base_quantity,tiendanube_variant_id,products!inner(tiendanube_product_id,base_unit)`);
    if (localVariantsError) throw new Error(localVariantsError.message);
    const localVariants = (localVariantsRaw ?? []) as unknown as LocalVariant[];

    const bySku = new Map<string, LocalVariant>();
    const byTnVariantId = new Map<string, LocalVariant>();
    const variantsByLocalProduct = new Map<string, LocalVariant[]>();
    const localProductByTnProductId = new Map<string, string>();
    for (const variant of localVariants) {
      const sku = normalizeSku(variant.sku);
      if (sku) bySku.set(sku, variant);
      if (variant.tiendanube_variant_id) byTnVariantId.set(String(variant.tiendanube_variant_id), variant);
      const group = variantsByLocalProduct.get(variant.product_id) ?? [];
      group.push(variant);
      variantsByLocalProduct.set(variant.product_id, group);
      const product = relation(variant.products);
      if (product?.tiendanube_product_id) localProductByTnProductId.set(String(product.tiendanube_product_id), variant.product_id);
    }

    const productsResponse = await fetch(tiendanubeApiUrl(connection.store_id, "products?per_page=200"), { headers, cache: "no-store" });
    if (!productsResponse.ok) {
      const detail = await productsResponse.text();
      return NextResponse.json({ ok: false, error: "Tiendanube rechazó la consulta de productos", status: productsResponse.status, detail }, { status: 502 });
    }
    const payload: unknown = await productsResponse.json();
    if (!Array.isArray(payload)) throw new Error("Formato inesperado de productos Tiendanube");
    const tnProducts = payload as TNProduct[];

    const variantUpdates = new Map<string, { id: string; tiendanube_variant_id: string; tiendanube_stock: number | null; sku: string | null }>();
    const productLinks = new Map<string, { localProductId: string; tnProduct: TNProduct }>();
    const observations: Array<{ tiendanube_product_id: string; tiendanube_variant_id: string; linked_local_product_id: string | null; sku: string | null; stock: number | null; option_label: string | null }> = [];
    let linkedVariants = 0;
    let unmatchedVariants = 0;

    for (const tnProduct of tnProducts) {
      let localProductId = localProductByTnProductId.get(String(tnProduct.id)) ?? null;
      const tnVariants = tnProduct.variants ?? [];

      // Producto nuevo en Tiendanube: si tiene una sola variante, lo importamos como
      // producto simple de 100 g y lo marcamos para revisión. No adivinamos productos
      // con múltiples variantes.
      if (!localProductId && tnVariants.length === 1) {
        const remote = tnVariants[0];
        const remoteName = typeof tnProduct.name === "string" ? tnProduct.name : tnProduct.name?.es ?? `Producto ${tnProduct.id}`;
        const { data: createdId, error: createError } = await supabase.rpc("import_tiendanube_product_v3", {
          p_name: remoteName,
          p_tiendanube_product_id: String(tnProduct.id),
          p_tiendanube_variant_id: String(remote.id),
          p_sku: normalizeSku(remote.sku) || null,
          p_price: Number(remote.promotional_price ?? remote.price ?? 0) || 0,
          p_image_url: chooseMainImage(tnProduct.images),
          p_handle: getHandle(tnProduct),
        });
        if (!createError && createdId) {
          localProductId = String(createdId);
          localProductByTnProductId.set(String(tnProduct.id), localProductId);
          const { data: createdVariant } = await supabase.from("product_variants").select("id,product_id,sku,base_quantity,tiendanube_variant_id,products!inner(tiendanube_product_id,base_unit)").eq("product_id", localProductId).eq("active", true).limit(1).maybeSingle();
          if (createdVariant) {
            const localVariant = createdVariant as unknown as LocalVariant;
            byTnVariantId.set(String(remote.id), localVariant);
            if (localVariant.sku) bySku.set(localVariant.sku, localVariant);
            variantsByLocalProduct.set(localProductId, [localVariant]);
          }
        }
      }

      for (const tnVariant of tnVariants) {
        const sku = normalizeSku(tnVariant.sku);
        let localVariant = byTnVariantId.get(String(tnVariant.id)) ?? (sku ? bySku.get(sku) : undefined);

        if (!localVariant && localProductId && tnVariants.length === 1) {
          const candidates = variantsByLocalProduct.get(localProductId) ?? [];
          const baseUnit = relation(candidates[0]?.products)?.base_unit;
          const target = baseUnit === "g" ? 100 : 1;
          localVariant = candidates.find((candidate) => Number(candidate.base_quantity) === target) ?? candidates[0];
        }

        if (localVariant) {
          localProductId = localVariant.product_id;
          variantUpdates.set(localVariant.id, {
            id: localVariant.id,
            tiendanube_variant_id: String(tnVariant.id),
            tiendanube_stock: typeof tnVariant.stock === "number" ? tnVariant.stock : null,
            sku: sku || localVariant.sku,
          });
          linkedVariants += 1;
        } else {
          unmatchedVariants += 1;
        }

        observations.push({
          tiendanube_product_id: String(tnProduct.id),
          tiendanube_variant_id: String(tnVariant.id),
          linked_local_product_id: localProductId,
          sku: sku || null,
          stock: typeof tnVariant.stock === "number" ? tnVariant.stock : null,
          option_label: optionLabel(tnVariant),
        });
      }

      if (localProductId) productLinks.set(localProductId, { localProductId, tnProduct });
    }

    const productsToUpdate: ProductLink[] = [];
    let imagesFound = 0;
    let productsWithoutImages = 0;
    let imageFetchErrors = 0;
    const imageErrors: Array<{ productId: string; status?: number; detail: string }> = [];

    for (const { localProductId, tnProduct } of productLinks.values()) {
      let imageUrl = chooseMainImage(tnProduct.images);
      if (!imageUrl) {
        try {
          const imageResponse = await fetch(tiendanubeApiUrl(connection.store_id, `products/${tnProduct.id}/images`), { headers, cache: "no-store" });
          if (imageResponse.ok) imageUrl = chooseMainImage(extractImages(await imageResponse.json()));
          else {
            imageFetchErrors += 1;
            imageErrors.push({ productId: String(tnProduct.id), status: imageResponse.status, detail: (await imageResponse.text()).slice(0, 300) || "Sin detalle" });
          }
        } catch (error) {
          imageFetchErrors += 1;
          imageErrors.push({ productId: String(tnProduct.id), detail: error instanceof Error ? error.message : "Error desconocido" });
        }
      }
      if (imageUrl) imagesFound += 1; else productsWithoutImages += 1;
      productsToUpdate.push({
        id: localProductId,
        tiendanube_product_id: String(tnProduct.id),
        tiendanube_handle: getHandle(tnProduct),
        image_url: imageUrl,
        variant_count: (tnProduct.variants ?? []).length,
      });
    }

    const [{ data: bulkResult, error: bulkError }, { data: observationsSaved, error: observationsError }] = await Promise.all([
      supabase.rpc("sync_tiendanube_catalog_bulk", { p_variants: Array.from(variantUpdates.values()), p_products: productsToUpdate }),
      supabase.rpc("replace_tiendanube_variant_observations", { p_store_id: String(connection.store_id), p_items: observations }),
    ]);
    if (bulkError) throw new Error(`Error guardando catálogo en Supabase: ${bulkError.message}`);

    const result = bulkResult as { variants_updated?: number; products_updated?: number; variants_archived?: number } | null;
    const unlinkedProducts = new Set(observations.filter((item) => !item.linked_local_product_id).map((item) => item.tiendanube_product_id)).size;
    const productsWithMultipleVariants = tnProducts.filter((product) => (product.variants ?? []).length > 1).length;

    return NextResponse.json({
      ok: true,
      tiendanubeProducts: tnProducts.length,
      linkedProducts: productLinks.size,
      linkedVariants,
      unmatchedVariants,
      unlinkedProducts,
      productsWithMultipleVariants,
      imagesFound,
      imagesUpdated: result?.products_updated ?? 0,
      productsWithoutImages,
      imageFetchErrors,
      variantsUpdated: result?.variants_updated ?? 0,
      variantsArchived: result?.variants_archived ?? 0,
      observationsSaved: observationsError ? 0 : Number(observationsSaved ?? 0),
      observationsWarning: observationsError ? observationsError.message : null,
      imageErrors: imageErrors.slice(0, 10),
    });
  } catch (error) {
    console.error("[Tiendanube] sync-catalog", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error sincronizando catálogo" }, { status: 500 });
  }
}
