import { NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";

type ProductRow = {
  name: string;
  description: string | null;
  active: boolean;
  visible: boolean;
  published: boolean;
  tiendanube_product_id: string | null;
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
    if (!connection) return NextResponse.json({ ok: false, error: "Tiendanube no está conectada" }, { status: 400 });

    const appId = process.env.TIENDANUBE_APP_ID;
    if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");

    const { data, error } = await supabase
      .from("products")
      .select("name,description,active,visible,published,tiendanube_product_id")
      .not("tiendanube_product_id", "is", null);
    if (error) throw new Error(error.message);

    const headers = {
      Authorization: `Bearer ${connection.access_token}`,
      "User-Agent": `Pecan Tigre (${appId})`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    let updated = 0;
    const errors: Array<{ productId: string; status: number; detail: string }> = [];

    for (const product of (data ?? []) as ProductRow[]) {
      if (!product.tiendanube_product_id) continue;
      const response = await fetch(
        tiendanubeApiUrl(connection.store_id, `products/${product.tiendanube_product_id}`),
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            name: { es: product.name },
            description: { es: product.description ?? "" },
            published: Boolean(product.active && product.visible && product.published),
          }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        errors.push({
          productId: product.tiendanube_product_id,
          status: response.status,
          detail: (await response.text()).slice(0, 500),
        });
      } else updated++;
    }

    return NextResponse.json({ ok: errors.length === 0, total: data?.length ?? 0, updated, errors }, { status: errors.length ? 502 : 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error sincronizando productos" },
      { status: 500 },
    );
  }
}
