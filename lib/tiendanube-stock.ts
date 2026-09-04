import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type StockOverviewRow = {
  id: string;
  available_base: number | string | null;
  active: boolean | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  base_quantity: number | string | null;
  tiendanube_variant_id: string | null;
  active: boolean | null;
  products:
    | { tiendanube_product_id: string | null; active: boolean | null }
    | Array<{ tiendanube_product_id: string | null; active: boolean | null }>;
};

type CalculatedStock = {
  localVariantId: string;
  tnProductId: string;
  tnVariantId: string;
  stock: number;
};

type BatchProduct = {
  id: number;
  variants: Array<{ id: number; stock: number }>;
};

export type StockSyncResult = {
  ok: boolean;
  products: number;
  variants: number;
  updatedVariants: number;
  batches: number;
  skipped: number;
  cacheUpdated: number;
  errors: Array<{ batch: number; status: number; detail: string }>;
  skippedDetails: Array<{ variantId: string; reason: string }>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildBatches(products: BatchProduct[], maxVariants = 50): BatchProduct[][] {
  const batches: BatchProduct[][] = [];
  let current: BatchProduct[] = [];
  let count = 0;

  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
    count = 0;
  };

  for (const product of products) {
    if (product.variants.length > maxVariants) {
      flush();
      for (let i = 0; i < product.variants.length; i += maxVariants) {
        batches.push([{ id: product.id, variants: product.variants.slice(i, i + maxVariants) }]);
      }
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

  const { data: connection, error: connectionError } = await supabase
    .from("tiendanube_connections")
    .select("store_id,access_token")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Tiendanube no está conectada");

  const appId = process.env.TIENDANUBE_APP_ID;
  if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");

  const [{ data: overviewRaw, error: overviewError }, { data: variantsRaw, error: variantsError }] =
    await Promise.all([
      supabase.from("product_stock_overview").select("id,available_base,active").eq("active", true),
      supabase
        .from("product_variants")
        .select(`
          id,
          product_id,
          base_quantity,
          tiendanube_variant_id,
          active,
          products!inner (
            tiendanube_product_id,
            active
          )
        `)
        .eq("active", true)
        .not("tiendanube_variant_id", "is", null),
    ]);

  if (overviewError) throw new Error(`No se pudo leer el stock: ${overviewError.message}`);
  if (variantsError) throw new Error(`No se pudieron leer las variantes: ${variantsError.message}`);

  const availableByProduct = new Map<string, number>();
  for (const row of (overviewRaw ?? []) as StockOverviewRow[]) {
    availableByProduct.set(row.id, Math.max(0, asNumber(row.available_base)));
  }

  const calculated: CalculatedStock[] = [];
  const skippedDetails: Array<{ variantId: string; reason: string }> = [];

  for (const raw of (variantsRaw ?? []) as unknown as VariantRow[]) {
    const product = Array.isArray(raw.products) ? raw.products[0] : raw.products;
    const baseQuantity = asNumber(raw.base_quantity);

    if (!product?.active || !product.tiendanube_product_id) {
      skippedDetails.push({ variantId: raw.id, reason: "Producto no vinculado o inactivo" });
      continue;
    }
    if (!raw.tiendanube_variant_id) {
      skippedDetails.push({ variantId: raw.id, reason: "Variante no vinculada" });
      continue;
    }
    if (baseQuantity <= 0) {
      skippedDetails.push({ variantId: raw.id, reason: "base_quantity inválido" });
      continue;
    }

    if (!availableByProduct.has(raw.product_id)) {
      skippedDetails.push({ variantId: raw.id, reason: "Producto sin stock calculable en product_stock_overview" });
      continue;
    }

    const available = availableByProduct.get(raw.product_id) ?? 0;
    calculated.push({
      localVariantId: raw.id,
      tnProductId: String(product.tiendanube_product_id),
      tnVariantId: String(raw.tiendanube_variant_id),
      stock: Math.max(0, Math.floor(available / baseQuantity)),
    });
  }

  const grouped = new Map<string, BatchProduct>();
  for (const item of calculated) {
    let product = grouped.get(item.tnProductId);
    if (!product) {
      product = { id: Number(item.tnProductId), variants: [] };
      grouped.set(item.tnProductId, product);
    }
    // Tiendanube mantiene `stock` por compatibilidad y, si no se indica ubicación,
    // actualiza la primera ubicación. Es la opción más compatible para esta tienda.
    product.variants.push({ id: Number(item.tnVariantId), stock: item.stock });
  }

  const batches = buildBatches(Array.from(grouped.values()), 50);
  const headers = {
    Authorization: `Bearer ${connection.access_token}`,
    "User-Agent": `Pecan Tigre (${appId})`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let updatedVariants = 0;
  const errors: Array<{ batch: number; status: number; detail: string }> = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const response = await fetch(
      tiendanubeApiUrl(connection.store_id, "products/stock-price"),
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(batch),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      errors.push({
        batch: i + 1,
        status: response.status,
        detail: (await response.text()).slice(0, 600),
      });
      continue;
    }

    updatedVariants += batch.reduce((sum, product) => sum + product.variants.length, 0);
  }

  let cacheUpdated = 0;
  if (errors.length === 0 && calculated.length > 0) {
    const { data, error } = await supabase.rpc("update_tiendanube_stock_cache", {
      p_items: calculated.map((item) => ({ id: item.localVariantId, stock: item.stock })),
    });
    if (!error) cacheUpdated = Number(data ?? 0);
    else console.error("[Tiendanube] No se pudo actualizar tiendanube_stock:", error.message);
  }

  return {
    ok: errors.length === 0,
    products: grouped.size,
    variants: calculated.length,
    updatedVariants,
    batches: batches.length,
    skipped: skippedDetails.length,
    cacheUpdated,
    errors,
    skippedDetails: skippedDetails.slice(0, 30),
  };
}
