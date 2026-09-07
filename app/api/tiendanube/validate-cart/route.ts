import { NextRequest, NextResponse } from "next/server";
import { tiendanubeAdmin } from "@/lib/tiendanube";

type CartItemInput = {
  variant_id: number | string;
  quantity: number;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string | null;
  base_quantity: number | string | null;
  tiendanube_variant_id: string | null;
};

type StockOverviewRow = {
  id: string;
  name: string | null;
  available_base: number | string | null;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      items?: CartItemInput[];
    };

    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({
        valid: true,
        problems: [],
      });
    }

    const supabase = tiendanubeAdmin();

    const variantIds = items
      .map((item) => String(item.variant_id))
      .filter(Boolean);

    const [{ data: variantsRaw, error: variantsError }, { data: stockRaw, error: stockError }] =
      await Promise.all([
        supabase
          .from("product_variants")
          .select(`
            id,
            product_id,
            name,
            base_quantity,
            tiendanube_variant_id
          `)
          .in("tiendanube_variant_id", variantIds),

        supabase
          .from("product_stock_overview")
          .select(`
            id,
            name,
            available_base
          `)
          .eq("active", true),
      ]);

    if (variantsError) {
      throw new Error(
        `No se pudieron leer las variantes: ${variantsError.message}`
      );
    }

    if (stockError) {
      throw new Error(
        `No se pudo leer el stock: ${stockError.message}`
      );
    }

    const variants = (variantsRaw ?? []) as VariantRow[];
    const stockRows = (stockRaw ?? []) as StockOverviewRow[];

    const variantByTnId = new Map<string, VariantRow>();

    for (const variant of variants) {
      if (variant.tiendanube_variant_id) {
        variantByTnId.set(
          String(variant.tiendanube_variant_id),
          variant
        );
      }
    }

    const availableByProduct = new Map<
      string,
      {
        name: string;
        available: number;
      }
    >();

    for (const stock of stockRows) {
      availableByProduct.set(stock.id, {
        name: stock.name ?? "Producto",
        available: Math.max(
          0,
          asNumber(stock.available_base)
        ),
      });
    }

    const requestedByProduct = new Map<string, number>();
    const unknownVariants: string[] = [];

    for (const item of items) {
      const quantity = Math.max(
        0,
        Math.floor(asNumber(item.quantity))
      );

      if (quantity <= 0) {
        continue;
      }

      const variant = variantByTnId.get(
        String(item.variant_id)
      );

      if (!variant) {
        unknownVariants.push(
          String(item.variant_id)
        );
        continue;
      }

      const baseQuantity = asNumber(
        variant.base_quantity
      );

      if (baseQuantity <= 0) {
        continue;
      }

      const requested =
        baseQuantity * quantity;

      requestedByProduct.set(
        variant.product_id,
        (requestedByProduct.get(
          variant.product_id
        ) ?? 0) + requested
      );
    }

    const problems: Array<{
      product_id: string;
      product_name: string;
      requested_base: number;
      available_base: number;
      shortage_base: number;
    }> = [];

    for (const [
      productId,
      requested,
    ] of requestedByProduct.entries()) {
      const stock =
        availableByProduct.get(productId);

      const available =
        stock?.available ?? 0;

      if (requested > available) {
        problems.push({
          product_id: productId,
          product_name:
            stock?.name ?? "Producto",
          requested_base: requested,
          available_base: available,
          shortage_base:
            requested - available,
        });
      }
    }

    const valid =
      problems.length === 0 &&
      unknownVariants.length === 0;

    return NextResponse.json({
      valid,
      problems,
      unknownVariants,
    });
  } catch (error) {
    console.error(
      "[Tiendanube] validate-cart",
      error
    );

    return NextResponse.json(
      {
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : "Error validando carrito",
      },
      {
        status: 500,
      }
    );
  }
}