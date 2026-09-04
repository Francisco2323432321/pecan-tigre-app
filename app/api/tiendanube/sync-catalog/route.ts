import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type TNVariant = {
  id: number;
  sku?: string | null;
  stock?: number | null;
};

type TNProduct = {
  id: number;
  handle?: { es?: string } | string | null;
  variants?: TNVariant[];
};

type TNImage = {
  id: number;
  src?: string | null;
  position?: number | null;
};

type LocalVariant = {
  id: string;
  product_id: string;
  sku: string | null;
};

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();

    const { data: connection, error: connectionError } = await supabase
      .from("tiendanube_connections")
      .select("store_id,access_token")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) throw new Error(connectionError.message);

    if (!connection) {
      return NextResponse.json(
        { error: "Tiendanube no está conectada" },
        { status: 400 }
      );
    }

    const appId = process.env.TIENDANUBE_APP_ID;

    if (!appId) {
      return NextResponse.json(
        { error: "Falta TIENDANUBE_APP_ID" },
        { status: 500 }
      );
    }

    const headers = {
      Authorization: `Bearer ${connection.access_token}`,
      "User-Agent": `Pecan Tigre (${appId})`,
      "Content-Type": "application/json",
    };

    // Variantes locales
    const { data: localVariantsRaw, error: localVariantsError } = await supabase
      .from("product_variants")
      .select("id,product_id,sku");

    if (localVariantsError) {
      throw new Error(localVariantsError.message);
    }

    const localVariants = (localVariantsRaw ?? []) as LocalVariant[];

    const skuMap = new Map<string, LocalVariant>();

    for (const variant of localVariants) {
      const sku = variant.sku?.trim();
      if (sku) skuMap.set(sku, variant);
    }

    // Productos Tiendanube
    const productsResponse = await fetch(
      tiendanubeApiUrl(connection.store_id, "products?per_page=200"),
      {
        headers,
        cache: "no-store",
      }
    );

    if (!productsResponse.ok) {
      const detail = await productsResponse.text();

      return NextResponse.json(
        {
          error: "Tiendanube rechazó la consulta de productos",
          status: productsResponse.status,
          detail,
        },
        { status: 502 }
      );
    }

    const products = (await productsResponse.json()) as TNProduct[];

    let linkedVariants = 0;
    let unmatchedVariants = 0;
    let imagesUpdated = 0;

    const matchedProductIds = new Set<string>();

    const variantUpdates: Array<{
      id: string;
      tiendanube_variant_id: string;
      tiendanube_stock: number | null;
    }> = [];

    const productMap = new Map<
      string,
      {
        localProductId: string;
        tnProductId: number;
        handle?: string;
      }
    >();

    for (const tnProduct of products) {
      for (const tnVariant of tnProduct.variants ?? []) {
        const sku = tnVariant.sku?.trim();

        if (!sku) {
          unmatchedVariants++;
          continue;
        }

        const localVariant = skuMap.get(sku);

        if (!localVariant) {
          unmatchedVariants++;
          continue;
        }

        variantUpdates.push({
          id: localVariant.id,
          tiendanube_variant_id: String(tnVariant.id),
          tiendanube_stock: tnVariant.stock ?? null,
        });

        linkedVariants++;
        matchedProductIds.add(localVariant.product_id);

        let handle: string | undefined;

        if (typeof tnProduct.handle === "string") {
          handle = tnProduct.handle;
        } else if (tnProduct.handle?.es) {
          handle = tnProduct.handle.es;
        }

        productMap.set(localVariant.product_id, {
          localProductId: localVariant.product_id,
          tnProductId: tnProduct.id,
          handle,
        });
      }
    }

    // Actualizar variantes
    const VARIANT_BATCH_SIZE = 20;

    for (let i = 0; i < variantUpdates.length; i += VARIANT_BATCH_SIZE) {
      const batch = variantUpdates.slice(i, i + VARIANT_BATCH_SIZE);

      await Promise.all(
        batch.map(async (update) => {
          const { error } = await supabase
            .from("product_variants")
            .update({
              tiendanube_variant_id: update.tiendanube_variant_id,
              tiendanube_stock: update.tiendanube_stock,
            })
            .eq("id", update.id);

          if (error) {
            console.error(
              "Error actualizando variante",
              update.id,
              error.message
            );
          }
        })
      );
    }

    // Obtener imágenes y actualizar productos
    const productEntries = Array.from(productMap.values());

    const PRODUCT_BATCH_SIZE = 5;

    for (let i = 0; i < productEntries.length; i += PRODUCT_BATCH_SIZE) {
      const batch = productEntries.slice(i, i + PRODUCT_BATCH_SIZE);

      await Promise.all(
        batch.map(async (item) => {
          let imageUrl: string | null = null;

          try {
            const imagesResponse = await fetch(
              tiendanubeApiUrl(
                connection.store_id,
                `products/${item.tnProductId}/images`
              ),
              {
                headers,
                cache: "no-store",
              }
            );

            if (imagesResponse.ok) {
              const images = (await imagesResponse.json()) as TNImage[];

              const mainImage =
                images.find((img) => img.position === 1) ??
                images[0];

              imageUrl = mainImage?.src ?? null;
            }
          } catch (error) {
            console.error(
              "Error obteniendo imágenes",
              item.tnProductId,
              error
            );
          }

          const updateData: Record<string, unknown> = {
            tiendanube_product_id: String(item.tnProductId),
            tiendanube_last_sync_at: new Date().toISOString(),
          };

          if (item.handle) {
            updateData.tiendanube_handle = item.handle;
          }

          if (imageUrl) {
            updateData.image_url = imageUrl;
          }

          const { error } = await supabase
            .from("products")
            .update(updateData)
            .eq("id", item.localProductId);

          if (error) {
            console.error(
              "Error actualizando producto",
              item.localProductId,
              error.message
            );
          } else if (imageUrl) {
            imagesUpdated++;
          }
        })
      );
    }

    return NextResponse.json({
      ok: true,
      tiendanubeProducts: products.length,
      linkedProducts: matchedProductIds.size,
      linkedVariants,
      unmatchedVariants,
      imagesUpdated,
    });
  } catch (error) {
    console.error("sync-catalog error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado sincronizando Tiendanube",
      },
      { status: 500 }
    );
  }
}