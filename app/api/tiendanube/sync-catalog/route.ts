import { NextResponse } from "next/server";
import {
  tiendanubeAdmin,
  tiendanubeApiUrl,
} from "@/lib/tiendanube";

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
  id: string;
  tiendanube_product_id: string;
  tiendanube_handle: string | null;
  image_url: string | null;
};

function normalizeSku(value?: string | null) {
  return value?.trim() ?? "";
}

function getHandle(product: TNProduct) {
  if (typeof product.handle === "string") {
    return product.handle;
  }

  if (product.handle?.es) {
    return product.handle.es;
  }

  return null;
}

function chooseMainImage(
  images?: TNImage[] | null
): string | null {
  if (!images?.length) {
    return null;
  }

  const valid = images.filter(
    (image) =>
      typeof image.src === "string" &&
      image.src.trim().length > 0
  );

  if (!valid.length) {
    return null;
  }

  const main =
    valid.find(
      (image) => Number(image.position) === 1
    ) ??
    [...valid].sort(
      (a, b) =>
        Number(a.position ?? 9999) -
        Number(b.position ?? 9999)
    )[0];

  return main?.src?.trim() ?? null;
}

function extractImages(payload: unknown): TNImage[] {
  if (Array.isArray(payload)) {
    return payload as TNImage[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray(
      (payload as { data?: unknown }).data
    )
  ) {
    return (
      payload as {
        data: TNImage[];
      }
    ).data;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "images" in payload &&
    Array.isArray(
      (payload as { images?: unknown }).images
    )
  ) {
    return (
      payload as {
        images: TNImage[];
      }
    ).images;
  }

  return [];
}

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();

    /*
     * CONEXIÓN
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
      throw new Error(connectionError.message);
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

    const appId =
      process.env.TIENDANUBE_APP_ID;

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
      Authorization:
        `Bearer ${connection.access_token}`,
      "User-Agent":
        `Pecan Tigre (${appId})`,
      Accept: "application/json",
    };

    /*
     * VARIANTES LOCALES
     *
     * UNA sola consulta a Supabase.
     */
    const {
      data: localVariantsRaw,
      error: localVariantsError,
    } = await supabase
      .from("product_variants")
      .select("id,product_id,sku");

    if (localVariantsError) {
      throw new Error(
        localVariantsError.message
      );
    }

    const localVariants =
      (localVariantsRaw ?? []) as LocalVariant[];

    const skuMap =
      new Map<string, LocalVariant>();

    for (const variant of localVariants) {
      const sku =
        normalizeSku(variant.sku);

      if (sku) {
        skuMap.set(sku, variant);
      }
    }

    /*
     * PRODUCTOS TIENDANUBE
     */
    const productsResponse = await fetch(
      tiendanubeApiUrl(
        connection.store_id,
        "products?per_page=200"
      ),
      {
        headers,
        cache: "no-store",
      }
    );

    if (!productsResponse.ok) {
      const detail =
        await productsResponse.text();

      return NextResponse.json(
        {
          ok: false,
          error:
            "Tiendanube rechazó la consulta de productos",
          status:
            productsResponse.status,
          detail,
        },
        { status: 502 }
      );
    }

    const payload: unknown =
      await productsResponse.json();

    if (!Array.isArray(payload)) {
      throw new Error(
        "Formato inesperado de productos Tiendanube"
      );
    }

    const tnProducts =
      payload as TNProduct[];

    /*
     * PREPARAR DATOS
     */
    const variantsToUpdate: Array<{
      id: string;
      tiendanube_variant_id: string;
      tiendanube_stock: number | null;
    }> = [];

    const productLinks =
      new Map<
        string,
        {
          localProductId: string;
          tnProduct: TNProduct;
        }
      >();

    let linkedVariants = 0;
    let unmatchedVariants = 0;

    for (const tnProduct of tnProducts) {
      for (
        const tnVariant of
        tnProduct.variants ?? []
      ) {
        const sku =
          normalizeSku(tnVariant.sku);

        if (!sku) {
          unmatchedVariants++;
          continue;
        }

        const localVariant =
          skuMap.get(sku);

        if (!localVariant) {
          unmatchedVariants++;
          continue;
        }

        variantsToUpdate.push({
          id: localVariant.id,

          tiendanube_variant_id:
            String(tnVariant.id),

          tiendanube_stock:
            typeof tnVariant.stock ===
            "number"
              ? tnVariant.stock
              : null,
        });

        linkedVariants++;

        productLinks.set(
          localVariant.product_id,
          {
            localProductId:
              localVariant.product_id,

            tnProduct,
          }
        );
      }
    }

    /*
     * IMÁGENES
     *
     * Primero usamos las imágenes que ya vinieron
     * con GET /products.
     *
     * Sólo consultamos el endpoint individual si
     * realmente faltan.
     */
    const productsToUpdate: ProductLink[] =
      [];

    let imagesFound = 0;
    let productsWithoutImages = 0;
    let imageFetchErrors = 0;

    const imageErrors: Array<{
      productId: string;
      status?: number;
      detail: string;
    }> = [];

    for (
      const {
        localProductId,
        tnProduct,
      } of productLinks.values()
    ) {
      let imageUrl =
        chooseMainImage(
          tnProduct.images
        );

      /*
       * Sólo hacemos request extra
       * si /products no trajo imagen.
       */
      if (!imageUrl) {
        try {
          const imageResponse =
            await fetch(
              tiendanubeApiUrl(
                connection.store_id,
                `products/${tnProduct.id}/images`
              ),
              {
                headers,
                cache: "no-store",
              }
            );

          if (imageResponse.ok) {
            const imagePayload: unknown =
              await imageResponse.json();

            const images =
              extractImages(
                imagePayload
              );

            imageUrl =
              chooseMainImage(images);
          } else {
            imageFetchErrors++;

            const detail =
              (
                await imageResponse.text()
              ).slice(0, 300);

            imageErrors.push({
              productId:
                String(tnProduct.id),

              status:
                imageResponse.status,

              detail:
                detail ||
                "Sin detalle",
            });
          }
        } catch (error) {
          imageFetchErrors++;

          imageErrors.push({
            productId:
              String(tnProduct.id),

            detail:
              error instanceof Error
                ? error.message
                : "Error desconocido",
          });
        }
      }

      if (imageUrl) {
        imagesFound++;
      } else {
        productsWithoutImages++;
      }

      productsToUpdate.push({
        id: localProductId,

        tiendanube_product_id:
          String(tnProduct.id),

        tiendanube_handle:
          getHandle(tnProduct),

        image_url:
          imageUrl,
      });
    }

    /*
     * IMPORTANTE
     *
     * UNA SOLA llamada a Supabase
     * para actualizar:
     *
     * - 105 variantes
     * - 27 productos
     * - imágenes
     * - IDs Tiendanube
     * - stock de referencia
     */
    const {
      data: bulkResult,
      error: bulkError,
    } = await supabase.rpc(
      "sync_tiendanube_catalog_bulk",
      {
        p_variants:
          variantsToUpdate,

        p_products:
          productsToUpdate,
      }
    );

    if (bulkError) {
      throw new Error(
        `Error guardando catálogo en Supabase: ${bulkError.message}`
      );
    }

    const result =
      bulkResult as {
        variants_updated?: number;
        products_updated?: number;
      } | null;

    return NextResponse.json({
      ok: true,

      tiendanubeProducts:
        tnProducts.length,

      linkedProducts:
        productLinks.size,

      linkedVariants,

      unmatchedVariants,

      imagesFound,

      imagesUpdated:
        result?.products_updated ?? 0,

      productsWithoutImages,

      imageFetchErrors,

      variantUpdateErrors: 0,

      productUpdateErrors: 0,

      variantsUpdated:
        result?.variants_updated ?? 0,

      productsUpdated:
        result?.products_updated ?? 0,

      imageErrors:
        imageErrors.slice(0, 10),
    });
  } catch (error) {
    console.error(
      "[Tiendanube] sync-catalog",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Error inesperado sincronizando catálogo",
      },
      {
        status: 500,
      }
    );
  }
}