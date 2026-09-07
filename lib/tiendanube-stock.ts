import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type StockOverviewRow = { id: string; available_base: number | string | null; active: boolean | null };
type VariantRow = {
  id: string;
  product_id: string;
  base_quantity: number | string | null;
  tiendanube_variant_id: string | null;
  active: boolean | null;
  products: { tiendanube_product_id: string | null; active: boolean | null; base_unit: string } | Array<{ tiendanube_product_id: string | null; active: boolean | null; base_unit: string }>;
};
type ObservationRow = { linked_local_product_id: string | null; tiendanube_variant_id: string };
type CalculatedStock = { localVariantId: string; localProductId: string; tnProductId: string; tnVariantId: string; stock: number };
type BatchVariant = { id: number; inventory_levels: Array<{ stock: number }> };
type BatchProduct = { id: number; variants: BatchVariant[] };
type TiendanubeBatchResponse = Array<{ id: number; variants?: Array<{ id: number; success?: boolean }> }>;

export type StockSyncResult = {
  ok: boolean;
  products: number;
  variants: number;
  sentVariants: number;
  updatedVariants: number;
  rejectedVariants: number;
  batches: number;
  skipped: number;
  cacheUpdated: number;
  errors: Array<{ batch: number; status: number; detail: string }>;
  rejectedDetails: Array<{ productId: string; variantId: string; reason: string }>;
  skippedDetails: Array<{ variantId: string; reason: string }>;
};

function asNumber(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function relation<T>(value: T | T[]): T | undefined { return Array.isArray(value) ? value[0] : value; }

function buildBatches(products: BatchProduct[], maxVariants = 50) {
  const batches: BatchProduct[][] = [];
  let current: BatchProduct[] = [];
  let count = 0;
  const flush = () => { if (current.length) batches.push(current); current = []; count = 0; };
  for (const product of products) {
    if (product.variants.length > maxVariants) {
      flush();
      for (let i = 0; i < product.variants.length; i += maxVariants) batches.push([{ id: product.id, variants: product.variants.slice(i, i + maxVariants) }]);
      continue;
    }
    if (count > 0 && count + product.variants.length > maxVariants) flush();
    current.push(product);
    count += product.variants.length;
  }
  flush();
  return batches;
}

export async function syncTiendanubeStock(): Promise<StockSyncResult> {
  const supabase = tiendanubeAdmin();
  const { data: connection, error: connectionError } = await supabase.from("tiendanube_connections").select("store_id,access_token").order("connected_at", { ascending: false }).limit(1).maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Tiendanube no esta conectada");
  const appId = process.env.TIENDANUBE_APP_ID;
  if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");

  const [overviewResult, variantsResult, observationsResult] = await Promise.all([
    supabase.from("product_stock_overview").select("id,available_base,active").eq("active", true),
    supabase.from("product_variants").select(`id,product_id,base_quantity,tiendanube_variant_id,active,products!inner(tiendanube_product_id,active,base_unit)`).eq("active", true).not("tiendanube_variant_id", "is", null),
    supabase.from("tiendanube_variant_observations").select("linked_local_product_id,tiendanube_variant_id").eq("store_id", String(connection.store_id)),
  ]);
  if (overviewResult.error) throw new Error(`No se pudo leer el stock: ${overviewResult.error.message}`);
  if (variantsResult.error) throw new Error(`No se pudieron leer las opciones de venta: ${variantsResult.error.message}`);

  const availableByProduct = new Map<string, number>();
  for (const row of (overviewResult.data ?? []) as StockOverviewRow[]) availableByProduct.set(row.id, Math.max(0, asNumber(row.available_base)));

  // Si Tiendanube muestra más de una variante para un producto, el stock queda bloqueado
  // hasta definir explícitamente su modelo. Esto evita descontar mal futuras presentaciones.
  const observedCountByProduct = new Map<string, number>();
  if (!observationsResult.error) {
    for (const row of (observationsResult.data ?? []) as ObservationRow[]) {
      if (!row.linked_local_product_id) continue;
      observedCountByProduct.set(row.linked_local_product_id, (observedCountByProduct.get(row.linked_local_product_id) ?? 0) + 1);
    }
  }

  const localVariants = (variantsResult.data ?? []) as unknown as VariantRow[];
  const linkedCountByProduct = new Map<string, number>();
  for (const variant of localVariants) linkedCountByProduct.set(variant.product_id, (linkedCountByProduct.get(variant.product_id) ?? 0) + 1);

  const calculated: CalculatedStock[] = [];
  const skippedDetails: Array<{ variantId: string; reason: string }> = [];

  for (const raw of localVariants) {
    const product = relation(raw.products);
    if (!product?.active || !product.tiendanube_product_id || !raw.tiendanube_variant_id) {
      skippedDetails.push({ variantId: raw.id, reason: "Producto u opción de Tiendanube no vinculada" });
      continue;
    }

    const detectedOptions = observedCountByProduct.get(raw.product_id) ?? linkedCountByProduct.get(raw.product_id) ?? 1;
    if (detectedOptions > 1) {
      // Registrar una sola vez el aviso por producto.
      if (!skippedDetails.some((detail) => detail.variantId === raw.product_id)) skippedDetails.push({ variantId: raw.product_id, reason: `Tiendanube detectó ${detectedOptions} variantes. Stock automático pausado hasta configurar ese producto.` });
      continue;
    }

    const expectedBase = product.base_unit === "g" ? 100 : 1;
    const baseQuantity = asNumber(raw.base_quantity);
    if (baseQuantity <= 0) {
      skippedDetails.push({ variantId: raw.id, reason: "Cantidad de venta inválida" });
      continue;
    }
    // Para el modelo actual fijamos 100 g o 1 unidad. Si aparece otra cantidad, la tratamos como excepción.
    if (baseQuantity !== expectedBase) {
      skippedDetails.push({ variantId: raw.id, reason: `Presentación no simple (${baseQuantity} ${product.base_unit}). Se esperaba ${expectedBase}.` });
      continue;
    }
    if (!availableByProduct.has(raw.product_id)) {
      skippedDetails.push({ variantId: raw.id, reason: "Producto sin stock calculable" });
      continue;
    }

    const stock = Math.max(0, Math.floor((availableByProduct.get(raw.product_id) ?? 0) / expectedBase));
    calculated.push({ localVariantId: raw.id, localProductId: raw.product_id, tnProductId: String(product.tiendanube_product_id), tnVariantId: String(raw.tiendanube_variant_id), stock });
  }

  const grouped = new Map<string, BatchProduct>();
  for (const item of calculated) {
    let product = grouped.get(item.tnProductId);
    if (!product) { product = { id: Number(item.tnProductId), variants: [] }; grouped.set(item.tnProductId, product); }
    product.variants.push({ id: Number(item.tnVariantId), inventory_levels: [{ stock: item.stock }] });
  }
  const batches = buildBatches(Array.from(grouped.values()), 50);
  const headers = { Authorization: `Bearer ${connection.access_token}`, "User-Agent": `Pecan Tigre (${appId})`, Accept: "application/json", "Content-Type": "application/json" };

  let sentVariants = 0;
  let updatedVariants = 0;
  let rejectedVariants = 0;
  const errors: Array<{ batch: number; status: number; detail: string }> = [];
  const rejectedDetails: Array<{ productId: string; variantId: string; reason: string }> = [];
  const acceptedVariantIds = new Set<string>();

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const batchVariantCount = batch.reduce((sum, product) => sum + product.variants.length, 0);
    sentVariants += batchVariantCount;
    const response = await fetch(tiendanubeApiUrl(connection.store_id, "products/stock-price"), { method: "PATCH", headers, body: JSON.stringify(batch), cache: "no-store" });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      errors.push({ batch: index + 1, status: response.status, detail });
      rejectedVariants += batchVariantCount;
      for (const product of batch) for (const variant of product.variants) rejectedDetails.push({ productId: String(product.id), variantId: String(variant.id), reason: `HTTP ${response.status}: ${detail}` });
      continue;
    }

    let responsePayload: TiendanubeBatchResponse;
    try { responsePayload = await response.json(); }
    catch {
      errors.push({ batch: index + 1, status: response.status, detail: "Tiendanube devolvió HTTP 200 pero el cuerpo no era JSON válido" });
      rejectedVariants += batchVariantCount;
      continue;
    }

    const successMap = new Map<string, boolean>();
    if (Array.isArray(responsePayload)) for (const productResult of responsePayload) for (const variantResult of productResult.variants ?? []) successMap.set(String(variantResult.id), variantResult.success === true);

    for (const product of batch) {
      for (const variant of product.variants) {
        const variantId = String(variant.id);
        const success = successMap.get(variantId);
        if (success === true) { updatedVariants += 1; acceptedVariantIds.add(variantId); }
        else { rejectedVariants += 1; rejectedDetails.push({ productId: String(product.id), variantId, reason: success === false ? "Tiendanube respondió success=false" : "Tiendanube no devolvió resultado para esta opción" }); }
      }
    }
  }

  const acceptedCalculated = calculated.filter((item) => acceptedVariantIds.has(item.tnVariantId));
  let cacheUpdated = 0;
  if (acceptedCalculated.length) {
    const { data, error } = await supabase.rpc("update_tiendanube_stock_cache", { p_items: acceptedCalculated.map((item) => ({ id: item.localVariantId, stock: item.stock })) });
    if (!error) cacheUpdated = Number(data ?? 0);
    else console.error("[Tiendanube] No se pudo actualizar tiendanube_stock:", error.message);
  }

  return {
    ok: errors.length === 0 && rejectedVariants === 0,
    products: grouped.size,
    variants: calculated.length,
    sentVariants,
    updatedVariants,
    rejectedVariants,
    batches: batches.length,
    skipped: skippedDetails.length,
    cacheUpdated,
    errors,
    rejectedDetails: rejectedDetails.slice(0, 50),
    skippedDetails: skippedDetails.slice(0, 30),
  };
}
