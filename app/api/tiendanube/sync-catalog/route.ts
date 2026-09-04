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

export async function POST() {
  try {
    const supabase = tiendanubeAdmin();

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
    let linkedProducts = 0;
    let unmatchedVariants = 0;
    let imagesUpdated = 0;

    const matchedProductIds = new Set<string>();

    for (const tnProduct of products) {
      const imageUrl = tnProduct.images?.[0]?.src ?? null;

      for (const tnVariant of tnProduct.variants ?? []) {
        const sku = tnVariant.sku?.trim();

        if (!sku) {
          unmatchedVariants++;
          continue;
        }

        const { data: localVariant, error: variantError } = await supabase
          .from("product_variants")
          .select("id,product_id,sku")
          .eq("sku", sku)
          .maybeSingle();

        if (variantError) {
          console.error("Error buscando SKU", sku, variantError);
          continue;
        }

        if (!localVariant) {
          unmatchedVariants++;
          continue;
        }

        const { error: updateVariantError } = await supabase
          .from("product_variants")
          .update({
            tiendanube_variant_id: String(tnVariant.id),
            tiendanube_stock: tnVariant.stock ?? null,
          })
          .eq("id", localVariant.id);

        if (updateVariantError) {
          console.error(
            "Error actualizando variante",
            sku,
            updateVariantError
          );
          continue;
        }

        linkedVariants++;
        matchedProductIds.add(localVariant.product_id);

        const productUpdate: Record<string, unknown> = {
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

        const { error: updateProductError } = await supabase
          .from("products")
          .update(productUpdate)
          .eq("id", localVariant.product_id);

        if (updateProductError) {
          console.error(
            "Error actualizando producto",
            localVariant.product_id,
            updateProductError
          );
        } else if (imageUrl) {
          imagesUpdated++;
        }
      }
    }

    linkedProducts = matchedProductIds.size;

    return NextResponse.json({
      ok: true,
      tiendanubeProducts: products.length,
      linkedProducts,
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