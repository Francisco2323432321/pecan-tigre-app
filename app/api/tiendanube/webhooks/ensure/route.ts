import { NextRequest, NextResponse } from "next/server";
import { tiendanubeAdmin } from "@/lib/tiendanube";
import { ensureTiendanubeOrderWebhooks } from "@/lib/tiendanube-webhooks";

export async function POST(request: NextRequest) {
  try {
    const supabase = tiendanubeAdmin();
    const { data: connection, error } = await supabase
      .from("tiendanube_connections")
      .select("store_id,access_token")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!connection) return NextResponse.json({ ok: false, error: "Tiendanube no está conectada" }, { status: 400 });

    const result = await ensureTiendanubeOrderWebhooks(connection.store_id, connection.access_token, request.nextUrl.origin);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudieron configurar los webhooks" }, { status: 500 });
  }
}
