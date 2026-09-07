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
    | {
        tiendanube_product_id: string | null;
        active: boolean | null;
      }
    | Array<{
        tiendanube_product_id: string | null;
        active: boolean | null;
      }>;
};

type CalculatedStock = {
  localVariantId: string;
  tnProductId: string;
  tnVariantId: string;
  stock: number;
};

type BatchVariant = {
  id: number;
  inventory_levels: Array<{
    stock: number;
  }>;
};

type BatchProduct = {
  id: number;
  variants: BatchVariant[];
};

type TiendanubeBatchResponse = Array<{
  id: number;
  variants?: Array<{
    id: number;
    success?: boolean;
  }>;
}>;

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

  errors: Array<{
    batch: number;
    status: number;
    detail: string;
  }>;

  rejectedDetails: Array<{
    productId: string;
    variantId: string;
    reason: string;
  }>;

  skippedDetails: Array<{
    variantId: string;
    reason: string;
  }>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function buildBatches(
  products: BatchProduct[],
  maxVariants = 50
): BatchProduct[][] {
  const batches: BatchProduct[][] = [];

  let current: BatchProduct[] = [];
  let count = 0;

  const flush = () => {
    if (current.length > 0) {
      batches.push(current);
    }

    current = [];
    count = 0;
  };

  for (const product of products) {
    /*
     * Caso poco probable:
     * un producto con más de 50 variantes.
     */
    if (product.variants.length > maxVariants) {
      flush();

      for (
        let i = 0;
        i < product.variants.length;
        i += maxVariants
      ) {
        batches.push([
          {
            id: product.id,
            variants: product.variants.slice(
              i,
              i + maxVariants
            ),
          },
        ]);
      }

      continue;
    }

    if (
      count > 0 &&
      count + product.variants.length > maxVariants
    ) {
      flush();
    }

    current.push(product);

    count += product.variants.length;
  }

  flush();

  return batches;
}

export async function syncTiendanubeStock(): Promise<StockSyncResult> {
  const supabase = tiendanubeAdmin();

  /*
   * 1. CONEXION TIENDANUBE
   */
  const {
    data: connection,
    error: connectionError,
  } = await supabase
    .from("tiendanube_connections")
    .select("store_id,access_token")
    .order("connected_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    throw new Error(
      connectionError.message
    );
  }

  if (!connection) {
    throw new Error(
      "Tiendanube no esta conectada"
    );
  }

  const appId =
    process.env.TIENDANUBE_APP_ID;

  if (!appId) {
    throw new Error(
      "Falta TIENDANUBE_APP_ID"
    );
  }

  /*
   * 2. LEER STOCK Y VARIANTES
   */
  const [
    {
      data: overviewRaw,
      error: overviewError,
    },
    {
      data: variantsRaw,
      error: variantsError,
    },
  ] = await Promise.all([
    supabase
      .from("product_stock_overview")
      .select(
        "id,available_base,active"
      )
      .eq("active", true),

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
      .not(
        "tiendanube_variant_id",
        "is",
        null
      ),
  ]);

  if (overviewError) {
    throw new Error(
      `No se pudo leer el stock: ${overviewError.message}`
    );
  }

  if (variantsError) {
    throw new Error(
      `No se pudieron leer las variantes: ${variantsError.message}`
    );
  }

  /*
   * 3. MAPA DE STOCK BASE DISPONIBLE
   */
  const availableByProduct =
    new Map<string, number>();

  for (
    const row of
    (overviewRaw ?? []) as StockOverviewRow[]
  ) {
    availableByProduct.set(
      row.id,
      Math.max(
        0,
        asNumber(
          row.available_base
        )
      )
    );
  }

  /*
   * 4. CALCULAR STOCK POR PRESENTACION
   */
  const calculated: CalculatedStock[] =
    [];

  const skippedDetails: Array<{
    variantId: string;
    reason: string;
  }> = [];

  for (
    const raw of
    (variantsRaw ?? []) as unknown as VariantRow[]
  ) {
    const product =
      Array.isArray(
        raw.products
      )
        ? raw.products[0]
        : raw.products;

    const baseQuantity =
      asNumber(
        raw.base_quantity
      );

    if (
      !product?.active ||
      !product.tiendanube_product_id
    ) {
      skippedDetails.push({
        variantId: raw.id,
        reason:
          "Producto no vinculado o inactivo",
      });

      continue;
    }

    if (
      !raw.tiendanube_variant_id
    ) {
      skippedDetails.push({
        variantId: raw.id,
        reason:
          "Variante no vinculada",
      });

      continue;
    }

    if (
      baseQuantity <= 0
    ) {
      skippedDetails.push({
        variantId: raw.id,
        reason:
          "base_quantity invalido",
      });

      continue;
    }

    if (
      !availableByProduct.has(
        raw.product_id
      )
    ) {
      skippedDetails.push({
        variantId: raw.id,
        reason:
          "Producto sin stock calculable en product_stock_overview",
      });

      continue;
    }

    const available =
      availableByProduct.get(
        raw.product_id
      ) ?? 0;

    const stock =
      Math.max(
        0,
        Math.floor(
          available /
            baseQuantity
        )
      );

    calculated.push({
      localVariantId:
        raw.id,

      tnProductId:
        String(
          product.tiendanube_product_id
        ),

      tnVariantId:
        String(
          raw.tiendanube_variant_id
        ),

      stock,
    });
  }

  /*
   * 5. AGRUPAR PARA TIENDANUBE
   */
  const grouped =
    new Map<
      string,
      BatchProduct
    >();

  for (
    const item of calculated
  ) {
    let product =
      grouped.get(
        item.tnProductId
      );

    if (!product) {
      product = {
        id: Number(
          item.tnProductId
        ),
        variants: [],
      };

      grouped.set(
        item.tnProductId,
        product
      );
    }

    /*
     * Formato moderno de Tiendanube.
     *
     * No especificamos location_id:
     * Tiendanube usa la primera ubicacion
     * activa para esa variante.
     */
    product.variants.push({
      id: Number(
        item.tnVariantId
      ),

      inventory_levels: [
        {
          stock:
            item.stock,
        },
      ],
    });
  }

  const batches =
    buildBatches(
      Array.from(
        grouped.values()
      ),
      50
    );

  /*
   * 6. HEADERS
   */
  const headers = {
    Authorization:
      `Bearer ${connection.access_token}`,

    "User-Agent":
      `Pecan Tigre (${appId})`,

    Accept:
      "application/json",

    "Content-Type":
      "application/json",
  };

  /*
   * 7. ENVIAR Y VALIDAR RESPUESTA REAL
   */
  let sentVariants = 0;
  let updatedVariants = 0;
  let rejectedVariants = 0;

  const errors: Array<{
    batch: number;
    status: number;
    detail: string;
  }> = [];

  const rejectedDetails: Array<{
    productId: string;
    variantId: string;
    reason: string;
  }> = [];

  /*
   * Variantes que Tiendanube confirmo.
   */
  const acceptedVariantIds =
    new Set<string>();

  for (
    let i = 0;
    i < batches.length;
    i++
  ) {
    const batch =
      batches[i];

    const batchVariantCount =
      batch.reduce(
        (
          sum,
          product
        ) =>
          sum +
          product.variants.length,
        0
      );

    sentVariants +=
      batchVariantCount;

    const response =
      await fetch(
        tiendanubeApiUrl(
          connection.store_id,
          "products/stock-price"
        ),
        {
          method: "PATCH",
          headers,

          body:
            JSON.stringify(
              batch
            ),

          cache:
            "no-store",
        }
      );

    /*
     * Error HTTP completo del lote.
     */
    if (!response.ok) {
      const detail =
        (
          await response.text()
        ).slice(
          0,
          1000
        );

      errors.push({
        batch:
          i + 1,

        status:
          response.status,

        detail,
      });

      rejectedVariants +=
        batchVariantCount;

      for (
        const product of batch
      ) {
        for (
          const variant of
          product.variants
        ) {
          rejectedDetails.push({
            productId:
              String(
                product.id
              ),

            variantId:
              String(
                variant.id
              ),

            reason:
              `HTTP ${response.status}: ${detail}`,
          });
        }
      }

      continue;
    }

    /*
     * Tiendanube puede responder HTTP 200
     * pero necesitamos verificar success
     * variante por variante.
     */
    let responsePayload:
      TiendanubeBatchResponse;

    try {
      responsePayload =
        await response.json();
    } catch {
      errors.push({
        batch:
          i + 1,

        status:
          response.status,

        detail:
          "Tiendanube devolvio HTTP 200 pero el cuerpo no era JSON valido",
      });

      rejectedVariants +=
        batchVariantCount;

      continue;
    }

    /*
     * Crear mapa de respuesta:
     * tnVariantId -> success
     */
    const successMap =
      new Map<
        string,
        boolean
      >();

    if (
      Array.isArray(
        responsePayload
      )
    ) {
      for (
        const productResult of
        responsePayload
      ) {
        for (
          const variantResult of
          productResult.variants ??
          []
        ) {
          successMap.set(
            String(
              variantResult.id
            ),
            variantResult.success ===
              true
          );
        }
      }
    }

    /*
     * Comparar cada variante enviada
     * contra la respuesta.
     */
    for (
      const product of batch
    ) {
      for (
        const variant of
        product.variants
      ) {
        const variantId =
          String(
            variant.id
          );

        const success =
          successMap.get(
            variantId
          );

        if (
          success === true
        ) {
          updatedVariants++;

          acceptedVariantIds.add(
            variantId
          );
        } else {
          rejectedVariants++;

          rejectedDetails.push({
            productId:
              String(
                product.id
              ),

            variantId,

            reason:
              success === false
                ? "Tiendanube respondio success=false"
                : "Tiendanube no devolvio resultado para esta variante",
          });
        }
      }
    }
  }

  /*
   * 8. ACTUALIZAR CACHE SOLO DE LAS
   * VARIANTES CONFIRMADAS
   */
  const acceptedCalculated =
    calculated.filter(
      (item) =>
        acceptedVariantIds.has(
          item.tnVariantId
        )
    );

  let cacheUpdated = 0;

  if (
    acceptedCalculated.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      "update_tiendanube_stock_cache",
      {
        p_items:
          acceptedCalculated.map(
            (item) => ({
              id:
                item.localVariantId,

              stock:
                item.stock,
            })
          ),
      }
    );

    if (!error) {
      cacheUpdated =
        Number(
          data ?? 0
        );
    } else {
      console.error(
        "[Tiendanube] No se pudo actualizar tiendanube_stock:",
        error.message
      );
    }
  }

  /*
   * 9. RESULTADO
   */
  return {
    ok:
      errors.length === 0 &&
      rejectedVariants === 0,

    products:
      grouped.size,

    variants:
      calculated.length,

    sentVariants,

    updatedVariants,

    rejectedVariants,

    batches:
      batches.length,

    skipped:
      skippedDetails.length,

    cacheUpdated,

    errors,

    rejectedDetails:
      rejectedDetails.slice(
        0,
        50
      ),

    skippedDetails:
      skippedDetails.slice(
        0,
        30
      ),
  };
}