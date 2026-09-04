import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, tiendanubeAdmin } from "@/lib/tiendanube";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Falta el código de autorización de Tiendanube." }, { status: 400 });

  try {
    const { accessToken, storeId, scope } = await exchangeAuthorizationCode(code);
    const { error } = await tiendanubeAdmin().from("tiendanube_connections").upsert({
      store_id: String(storeId), access_token: accessToken, scope, connected_at: new Date().toISOString(),
    }, { onConflict: "store_id" });
    if (error) throw error;
    return NextResponse.redirect(new URL("/configuracion?tiendanube=connected", request.url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo conectar Tiendanube." }, { status: 500 });
  }
}
