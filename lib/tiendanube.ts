import { createClient } from "@supabase/supabase-js";

const apiVersion = "2025-03";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
}

export function tiendanubeAdmin() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function exchangeAuthorizationCode(code: string) {
  const response = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: required("TIENDANUBE_APP_ID"),
      client_secret: required("TIENDANUBE_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
    }),
  });
  const data = await response.json() as { access_token?: string; user_id?: number; scope?: string; error?: string };
  if (!response.ok || !data.access_token || !data.user_id) {
    throw new Error(data.error || "Tiendanube no devolvió un token válido");
  }
  return { accessToken: data.access_token, storeId: data.user_id, scope: data.scope ?? "" };
}

export const tiendanubeApiUrl = (storeId: number | string, path: string) =>
  `https://api.tiendanube.com/${apiVersion}/${storeId}/${path.replace(/^\//, "")}`;
