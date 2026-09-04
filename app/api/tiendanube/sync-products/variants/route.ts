import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type VariantRow = {
  sku: string | null;
  shipping_weight_g: number | string | null;
  height_cm: number | string | null;
  width_cm: number | string | null;
  depth_cm: number | string | null;
  barcode: string | null;
  tiendanube_variant_id: string | null;
  products:
    | { tiendanube_product_id: string | null }
    | Array<{ tiendanube_product_id: string | null }>;
};

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    if (!connection) return NextResponse.json({ ok: false, error: "Tiendanube no está conectada" }, { status: 400 });

    const appId = process.env.TIENDANUBE_APP_ID;
    if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");

    const { data, error } = await supabase
      .from("product_variants")
      .select(`
        sku, shipping_weight_g, height_cm, width_cm, depth_cm, barcode,
        tiendanube_variant_id,
        products!inner (tiendanube_product_id)
      `)
      .not("tiendanube_variant_id", "is", null);
    if (error) throw new Error(error.message);

    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const raw of (data ?? []) as unknown as VariantRow[]) {
      const product = Array.isArray(raw.products) ? raw.products[0] : raw.products;
      if (!product?.tiendanube_product_id || !raw.tiendanube_variant_id) continue;

      const weightG = optionalNumber(raw.shipping_weight_g);
      const current = grouped.get(product.tiendanube_product_id) ?? [];
      current.push({
        id: Number(raw.tiendanube_variant_id),
        sku: raw.sku?.trim() || null,
        weight: weightG === null ? null : weightG / 1000,
        height: optionalNumber(raw.height_cm),
        width: optionalNumber(raw.width_cm),
        depth: optionalNumber(raw.depth_cm),
        barcode: raw.barcode?.trim() || null,
      });
      grouped.set(product.tiendanube_product_id, current);
    }

    const headers = {
      Authorization: `Bearer ${connection.access_token}`,
      "User-Agent": `Pecan Tigre (${appId})`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    let productsUpdated = 0;
    let variantsUpdated = 0;
    const errors: Array<{ productId: string; status: number; detail: string }> = [];

    for (const [productId, variants] of grouped) {
      const response = await fetch(tiendanubeApiUrl(connection.store_id, `products/${productId}/variants`), {
        method: "PATCH",
        headers,
        body: JSON.stringify(variants),
        cache: "no-store",
      });
      if (!response.ok) {
        errors.push({ productId, status: response.status, detail: (await response.text()).slice(0, 500) });
      } else {
        productsUpdated++;
        variantsUpdated += variants.length;
      }
    }

    return NextResponse.json(
      { ok: errors.length === 0, products: grouped.size, productsUpdated, variantsUpdated, errors },
      { status: errors.length ? 502 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error sincronizando características" },
      { status: 500 },
    );
  }
}
