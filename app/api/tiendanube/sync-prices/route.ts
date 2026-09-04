import { NextResponse } from "next/server";
import {
  tiendanubeAdmin,
  tiendanubeApiUrl,
} from "@/lib/tiendanube";

type VariantRow = {
  id: string;
  price: number | string | null;
  promo_price: number | string | null;
  tiendanube_variant_id: string | null;

  products:
    | {
        tiendanube_product_id:
          | string
          | null;
      }
    | Array<{
        tiendanube_product_id:
          | string
          | null;
      }>;
};

type ProductPayload = {
  id: number;

  variants: Array<{
    id: number;
    price: number;
    promotional_price: number | null;
  }>;
};

function numberOrNull(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

export async function POST() {
  try {
    const supabase =
      tiendanubeAdmin();

    const {
      data: connection,
      error: connectionError,
    } = await supabase
      .from(
        "tiendanube_connections"
      )
      .select(
        "store_id,access_token"
      )
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
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tiendanube no está conectada",
        },
        { status: 400 }
      );
    }

    const appId =
      process.env
        .TIENDANUBE_APP_ID;

    if (!appId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta TIENDANUBE_APP_ID",
        },
        { status: 500 }
      );
    }

    const {
      data: variantsRaw,
      error: variantsError,
    } = await supabase
      .from("product_variants")
      .select(
        `
          id,
          price,
          promo_price,
          tiendanube_variant_id,
          products!inner (
            tiendanube_product_id
          )
        `
      )
      .eq("active", true)
      .not(
        "tiendanube_variant_id",
        "is",
        null
      );

    if (variantsError) {
      throw new Error(
        variantsError.message
      );
    }

    const variants =
      (variantsRaw ??
        []) as unknown as VariantRow[];

    const grouped =
      new Map<
        string,
        ProductPayload
      >();

    let skipped = 0;

    for (const variant of variants) {
      const product =
        Array.isArray(
          variant.products
        )
          ? variant.products[0]
          : variant.products;

      const productId =
        product
          ?.tiendanube_product_id;

      const variantId =
        variant
          .tiendanube_variant_id;

      const price =
        numberOrNull(
          variant.price
        );

      if (
        !productId ||
        !variantId ||
        price === null
      ) {
        skipped++;
        continue;
      }

      let productPayload =
        grouped.get(
          productId
        );

      if (!productPayload) {
        productPayload = {
          id: Number(
            productId
          ),
          variants: [],
        };

        grouped.set(
          productId,
          productPayload
        );
      }

      productPayload.variants.push({
        id: Number(
          variantId
        ),

        price,

        promotional_price:
          numberOrNull(
            variant.promo_price
          ),
      });
    }

    /*
     * Crear lotes de máximo
     * 50 variantes.
     */
    const batches:
      ProductPayload[][] = [];

    let current:
      ProductPayload[] = [];

    let count = 0;

    for (
      const product of
      grouped.values()
    ) {
      if (
        count > 0 &&
        count +
          product.variants
            .length >
          50
      ) {
        batches.push(current);

        current = [];
        count = 0;
      }

      if (
        product.variants
          .length > 50
      ) {
        for (
          let i = 0;
          i <
          product.variants
            .length;
          i += 50
        ) {
          batches.push([
            {
              id: product.id,

              variants:
                product.variants.slice(
                  i,
                  i + 50
                ),
            },
          ]);
        }

        continue;
      }

      current.push(product);

      count +=
        product.variants.length;
    }

    if (current.length) {
      batches.push(current);
    }

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

    let updatedVariants = 0;

    const errors: Array<{
      batch: number;
      status: number;
      detail: string;
    }> = [];

    for (
      let i = 0;
      i < batches.length;
      i++
    ) {
      const batch =
        batches[i];

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

      if (!response.ok) {
        errors.push({
          batch: i + 1,

          status:
            response.status,

          detail:
            (
              await response.text()
            ).slice(
              0,
              500
            ),
        });

        continue;
      }

      updatedVariants +=
        batch.reduce(
          (
            total,
            product
          ) =>
            total +
            product
              .variants
              .length,
          0
        );
    }

    return NextResponse.json({
      ok:
        errors.length === 0,

      variants:
        variants.length,

      updatedVariants,

      batches:
        batches.length,

      skipped,

      errors,
    });
  } catch (error) {
    console.error(
      "[Tiendanube] sync-prices",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Error sincronizando precios",
      },
      { status: 500 }
    );
  }
}