import { NextRequest, NextResponse } from "next/server";
import { tiendanubeAdmin } from "@/lib/tiendanube";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const storeId = String(payload.store_id ?? "");
  if (!storeId) return NextResponse.json({ error: "Falta store_id." }, { status: 400 });
  const { error } = await tiendanubeAdmin().from("tiendanube_connections").delete().eq("store_id", storeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ received: true });
}
