import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type TNImage = {
  id?: number | string;
  src?: string | null;
  position?: number | null;
};

type TNVariant = {
  id: number | string;
  sku?: string | null;
  stock?: number | null;
};

type TNProduct = {
  id: number | string;
  handle?: { es?: string } | string | null;
  images?: TNImage[] | null;
  variants?: TNVariant[] | null;
};

type LocalVariant = {
  id: string;
  product_id: string;
  sku: string | null;
};

type ProductLink = {
  localProductId: string;
  tnProductId: string;
  handle?: string;
  images?: TNImage[];
};

function normalizeSku(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function chooseMainImage(images: TNImage[] | null | undefined) {
  if (!images || images.length === 0) return null;

  const validImages = images.filter(
    (image) =>
      typeof image?.src === "string" &&
      image.src.trim().length > 0
  );

  if (validImages.length === 0) return null;

  const main =
    validImages.find((image) => Number(image.position) === 1) ??
    [...validImages].sort(
      (a, b) =>
        Number(a.position ?? 9999) -
        Number(b.position ?? 9999)
    )[0];

  return main?.src?.trim() || null;
}

function extractImages(payload: unknown): TNImage[] {
  // Forma normal: [...]
  if (Array.isArray(payload)) {
    return payload as TNImage[];
  }

  // Fallback por si la API responde { data: [...] }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: TNImage[] }).data;
  }

  // Otro fallback posible: { images: [...] }
  if (
    payload &&
    typeof payload === "object" &&
    "images" in payload &&
    Array.isArray((payload as { images?: unknown }).images)
  ) {
    return (payload as { images: TNImage[] }).images;
  }

  return [];
}

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();

    /*
     * 1. CONEXIÓN TIENDANUBE
     */
    const { data: connection, error: connectionError } =
      await supabase
        .from("tiendanube_connections")
        .select("store_id,access_token")
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (connectionError) {
      throw new Error(
        `Error leyendo conexión Tiendanube: ${connectionError.message}`
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tiendanube no está conectada",
        },
        { status: 400 }
      );
    }

    const appId = process.env.TIENDANUBE_APP_ID;

    if (!appId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta TIENDANUBE_APP_ID",
        },
        { status: 500 }
      );
    }

    const headers = {
      Authorization: `Bearer ${connection.access_token}`,
      "User-Agent": `Pecan Tigre (${appId})`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    /*
     * 2. LEER TODAS LAS VARIANTES LOCALES UNA SOLA VEZ
     */
    const {
      data: localVariantsRaw,
      error: localVariantsError,
    } = await supabase
      .from("product_variants")
      .select("id,product_id,sku");

    if (localVariantsError) {
      throw new Error(
        `Error leyendo variantes locales: ${localVariantsError.message}`
      );
    }

    const localVariants =
      (localVariantsRaw ?? []) as LocalVariant[];

    const skuMap = new Map<string, LocalVariant>();

    for (const variant of localVariants) {
      const sku = normalizeSku(variant.sku);

      if (sku) {
        skuMap.set(sku, variant);
      }
    }

    /*
     * 3. LEER PRODUCTOS DE TIENDANUBE
     */
    const productsResponse = await fetch(
      tiendanubeApiUrl(
        connection.store_id,
        "products?per_page=200"
      ),
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    if (!productsResponse.ok) {
      const detail = await productsResponse.text();

      return NextResponse.json(
        {
          ok: false,
          error:
            "Tiendanube rechazó la consulta de productos",
          status: productsResponse.status,
          detail,
        },
        { status: 502 }
      );
    }

    const productPayload: unknown =
      await productsResponse.json();

    if (!Array.isArray(productPayload)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La API de Tiendanube devolvió productos en un formato inesperado",
        },
        { status: 502 }
      );
    }

    const tnProducts = productPayload as TNProduct[];

    /*
     * 4. VINCULAR PRODUCTOS Y VARIANTES POR SKU
     */
    const variantUpdates: Array<{
      id: string;
      tiendanube_variant_id: string;
      tiendanube_stock: number | null;
    }> = [];

    const productLinks = new Map<string, ProductLink>();

    let linkedVariants = 0;
    let unmatchedVariants = 0;

    const unmatchedSkus: string[] = [];

    for (const tnProduct of tnProducts) {
      const tnProductId = String(tnProduct.id);

      for (const tnVariant of tnProduct.variants ?? []) {
        const sku = normalizeSku(tnVariant.sku);

        if (!sku) {
          unmatchedVariants++;
          continue;
        }

        const localVariant = skuMap.get(sku);

        if (!localVariant) {
          unmatchedVariants++;
          unmatchedSkus.push(sku);
          continue;
        }

        variantUpdates.push({
          id: localVariant.id,
          tiendanube_variant_id: String(tnVariant.id),
          tiendanube_stock:
            typeof tnVariant.stock === "number"
              ? tnVariant.stock
              : null,
        });

        linkedVariants++;

        let handle: string | undefined;

        if (typeof tnProduct.handle === "string") {
          handle = tnProduct.handle;
        } else if (tnProduct.handle?.es) {
          handle = tnProduct.handle.es;
        }

        productLinks.set(localVariant.product_id, {
          localProductId: localVariant.product_id,
          tnProductId,
          handle,
          images: Array.isArray(tnProduct.images)
            ? tnProduct.images
            : [],
        });
      }
    }

    /*
     * 5. ACTUALIZAR IDs DE VARIANTES
     */
    let variantUpdateErrors = 0;

    const VARIANT_BATCH_SIZE = 25;

    for (
      let i = 0;
      i < variantUpdates.length;
      i += VARIANT_BATCH_SIZE
    ) {
      const batch = variantUpdates.slice(
        i,
        i + VARIANT_BATCH_SIZE
      );

      await Promise.all(
        batch.map(async (update) => {
          const { error } = await supabase
            .from("product_variants")
            .update({
              tiendanube_variant_id:
                update.tiendanube_variant_id,
              tiendanube_stock:
                update.tiendanube_stock,
            })
            .eq("id", update.id);

          if (error) {
            variantUpdateErrors++;

            console.error(
              "[Tiendanube] Error actualizando variante",
              update.id,
              error.message
            );
          }
        })
      );
    }

    /*
     * 6. OBTENER IMAGEN PRINCIPAL DE CADA PRODUCTO
     *
     * Primero usamos images incluidas en /products.
     * Si no existen, consultamos /products/{id}/images.
     */
    let imagesFound = 0;
    let imagesUpdated = 0;
    let productsWithoutImages = 0;
    let imageFetchErrors = 0;
    let productUpdateErrors = 0;

    const imageErrors: Array<{
      productId: string;
      status?: number;
      detail: string;
    }> = [];

    const productEntries = Array.from(
      productLinks.values()
    );

    const PRODUCT_BATCH_SIZE = 5;

    for (
      let i = 0;
      i < productEntries.length;
      i += PRODUCT_BATCH_SIZE
    ) {
      const batch = productEntries.slice(
        i,
        i + PRODUCT_BATCH_SIZE
      );

      await Promise.all(
        batch.map(async (item) => {
          let imageUrl =
            chooseMainImage(item.images) ?? null;

          /*
           * Si /products ya trajo imágenes,
           * no hacemos otra request.
           */
          if (!imageUrl) {
            try {
              const imagesResponse = await fetch(
                tiendanubeApiUrl(
                  connection.store_id,
                  `products/${item.tnProductId}/images`
                ),
                {
                  method: "GET",
                  headers,
                  cache: "no-store",
                }
              );

              if (imagesResponse.ok) {
                const imagePayload: unknown =
                  await imagesResponse.json();

                const images =
                  extractImages(imagePayload);

                imageUrl =
                  chooseMainImage(images);
              } else {
                imageFetchErrors++;

                const detail = (
                  await imagesResponse.text()
                ).slice(0, 300);

                imageErrors.push({
                  productId: item.tnProductId,
                  status: imagesResponse.status,
                  detail:
                    detail ||
                    "Tiendanube no devolvió detalle",
                });

                console.error(
                  "[Tiendanube] Error leyendo imágenes",
                  item.tnProductId,
                  imagesResponse.status,
                  detail
                );
              }
            } catch (error) {
              imageFetchErrors++;

              const detail =
                error instanceof Error
                  ? error.message
                  : "Error desconocido";

              imageErrors.push({
                productId: item.tnProductId,
                detail,
              });

              console.error(
                "[Tiendanube] Excepción leyendo imágenes",
                item.tnProductId,
                error
              );
            }
          }

          if (imageUrl) {
            imagesFound++;
          } else {
            productsWithoutImages++;
          }

          /*
           * 7. ACTUALIZAR PRODUCTO LOCAL
           */
          const updateData: Record<string, unknown> = {
            tiendanube_product_id:
              item.tnProductId,
            tiendanube_last_sync_at:
              new Date().toISOString(),
          };

          if (item.handle) {
            updateData.tiendanube_handle =
              item.handle;
          }

          /*
           * Solamente modificamos image_url si
           * realmente encontramos una imagen.
           *
           * Así nunca borramos una foto existente
           * por un fallo temporal de la API.
           */
          if (imageUrl) {
            updateData.image_url = imageUrl;
          }

          const { error: updateError } =
            await supabase
              .from("products")
              .update(updateData)
              .eq("id", item.localProductId);

          if (updateError) {
            productUpdateErrors++;

            console.error(
              "[Tiendanube] Error actualizando producto",
              item.localProductId,
              updateError.message
            );

            return;
          }

          if (imageUrl) {
            imagesUpdated++;
          }
        })
      );
    }

    /*
     * 8. RESULTADO
     */
    return NextResponse.json({
      ok: true,

      tiendanubeProducts: tnProducts.length,

      linkedProducts: productLinks.size,

      linkedVariants,

      unmatchedVariants,

      unmatchedSkus: unmatchedSkus.slice(0, 20),

      imagesFound,

      imagesUpdated,

      productsWithoutImages,

      imageFetchErrors,

      variantUpdateErrors,

      productUpdateErrors,

      imageErrors: imageErrors.slice(0, 10),
    });
  } catch (error) {
    console.error(
      "[Tiendanube] sync-catalog error",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado sincronizando Tiendanube",
      },
      { status: 500 }
    );
  }
}