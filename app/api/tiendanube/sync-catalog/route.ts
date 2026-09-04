import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type TNImage = {
  id?: number;
  src?: string;
};

type TNVariant = {
  id: number;
  product_id?: number;
  sku?: string | null;
  stock?: number | null;
};

type TNProduct = {
  id: number;
  handle?: {
    es?: string;
  } | string | null;
  images?: TNImage[];
  variants?: TNVariant[];
};

type LocalVariant = {
  id: string;
  product_id: string;
  sku: string | null;
};

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();

    // 1. Obtener conexión Tiendanube
    const { data: connection, error: connectionError } = await supabase
      .from("tiendanube_connections")
      .select("store_id,access_token")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }

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

    // 2. Traer todas las variantes locales una sola vez
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

      if (sku) {
        skuMap.set(sku, variant);
      }
    }

    // 3. Traer productos Tiendanube
    const response = await fetch(
      tiendanubeApiUrl(connection.store_id, "products?per_page=200"),
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "User-Agent": `Pecan Tigre (${appId})`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        {
          error: "Tiendanube rechazó la consulta de productos",
          status: response.status,
          detail: text,
        },
        { status: 502 }
      );
    }

    const products = (await response.json()) as TNProduct[];

    let linkedVariants = 0;
    let unmatchedVariants = 0;
    let imagesUpdated = 0;

    const matchedProductIds = new Set<string>();

    // Guardamos actualizaciones para productos padre
    const productUpdates = new Map<
      string,
      {
        tiendanube_product_id: string;
        tiendanube_last_sync_at: string;
        tiendanube_handle?: string;
        image_url?: string;
      }
    >();

    // 4. Preparar updates de variantes
    const variantUpdates: Array<{
      id: string;
      tiendanube_variant_id: string;
      tiendanube_stock: number | null;
    }> = [];

    for (const tnProduct of products) {
      const imageUrl = tnProduct.images?.[0]?.src ?? null;

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

        const productUpdate: {
          tiendanube_product_id: string;
          tiendanube_last_sync_at: string;
          tiendanube_handle?: string;
          image_url?: string;
        } = {
          tiendanube_product_id: String(tnProduct.id),
          tiendanube_last_sync_at: new Date().toISOString(),
        };

        if (typeof tnProduct.handle === "string") {
          productUpdate.tiendanube_handle = tnProduct.handle;
        } else if (tnProduct.handle?.es) {
          productUpdate.tiendanube_handle = tnProduct.handle.es;
        }

        if (imageUrl) {
          productUpdate.image_url = imageUrl;
        }

        productUpdates.set(localVariant.product_id, productUpdate);
      }
    }

    // 5. Actualizar variantes en paralelo, pero en lotes pequeños
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

    // 6. Actualizar cada producto padre una sola vez
    const productEntries = Array.from(productUpdates.entries());
    const PRODUCT_BATCH_SIZE = 10;

    for (let i = 0; i < productEntries.length; i += PRODUCT_BATCH_SIZE) {
      const batch = productEntries.slice(i, i + PRODUCT_BATCH_SIZE);

      await Promise.all(
        batch.map(async ([productId, update]) => {
          const { error } = await supabase
            .from("products")
            .update(update)
            .eq("id", productId);

          if (error) {
            console.error(
              "Error actualizando producto",
              productId,
              error.message
            );
          } else if (update.image_url) {
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