import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) return NextResponse.json({ error: "No hay filas para importar." }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_internal_catalog", { p_rows: payload.rows });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? {});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Solicitud inválida." }, { status: 400 });
  }
}
