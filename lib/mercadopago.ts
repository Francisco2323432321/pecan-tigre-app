import { createClient } from "@supabase/supabase-js";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
}

export function mercadopagoAdmin() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function mercadopagoRedirectUri(origin?: string) {
  return process.env.MERCADOPAGO_REDIRECT_URI || `${origin ?? ""}/api/mercadopago/callback`;
}

export function mercadopagoClientId() {
  return required("MERCADOPAGO_CLIENT_ID");
}

export function mercadopagoClientSecret() {
  return required("MERCADOPAGO_CLIENT_SECRET");
}
