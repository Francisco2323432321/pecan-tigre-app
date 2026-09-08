"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

export async function createManualSale(payload: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_manual_order", { p_payload: payload });
    if (error) return { ok: false, message: error.message };
    const id = String(data ?? "");
    if (!id) return { ok: false, message: "La venta no devolvió un identificador." };
    await syncTiendanubeStock().catch((error) => console.error("[auto-stock] venta", error));
    revalidatePath("/ventas");
    revalidatePath("/pedidos");
    revalidatePath("/productos");
    revalidatePath("/stock");
    revalidatePath("/");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear la venta." };
  }
}
