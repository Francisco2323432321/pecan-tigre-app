import { NextResponse } from "next/server";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

export async function POST() {
  try {
    const result = await syncTiendanubeStock();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error inesperado sincronizando stock" },
      { status: 500 },
    );
  }
}
