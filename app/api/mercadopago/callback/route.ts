import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mercadopagoAdmin, mercadopagoClientId, mercadopagoClientSecret, mercadopagoRedirectUri } from "@/lib/mercadopago";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  public_key?: string;
  expires_in?: number;
  user_id?: number | string;
  error?: string;
  message?: string;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("mp_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/finanzas?mp=state_error", request.url));
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userId).maybeSingle();
  if (!profile?.active || profile.role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));

  try {
    const redirectUri = mercadopagoRedirectUri(url.origin);
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: mercadopagoClientId(),
        client_secret: mercadopagoClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });

    const token = await response.json() as TokenResponse;
    if (!response.ok || !token.access_token || !token.user_id) throw new Error(token.message || token.error || `OAuth HTTP ${response.status}`);

    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    const admin = mercadopagoAdmin();
    const { error } = await admin.from("mercadopago_connections").upsert({
      account_user_id: String(token.user_id),
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      token_type: token.token_type ?? null,
      scope: token.scope ?? null,
      public_key: token.public_key ?? null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_user_id" });
    if (error) throw new Error(error.message);

    const result = NextResponse.redirect(new URL("/finanzas?mp=connected", request.url));
    result.cookies.delete("mp_oauth_state");
    return result;
  } catch (error) {
    console.error("[Mercado Pago] callback", error);
    const result = NextResponse.redirect(new URL("/finanzas?mp=error", request.url));
    result.cookies.delete("mp_oauth_state");
    return result;
  }
}
