import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mercadopagoClientId, mercadopagoRedirectUri } from "@/lib/mercadopago";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userId).maybeSingle();
  if (!profile?.active || profile.role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));

  try {
    const state = crypto.randomUUID();
    const redirectUri = mercadopagoRedirectUri(new URL(request.url).origin);
    const authorization = new URL("https://auth.mercadopago.com/authorization");
    authorization.searchParams.set("client_id", mercadopagoClientId());
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("platform_id", "mp");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("redirect_uri", redirectUri);

    const response = NextResponse.redirect(authorization);
    response.cookies.set("mp_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("[Mercado Pago] connect", error);
    return NextResponse.redirect(new URL("/finanzas?mp=config", request.url));
  }
}
