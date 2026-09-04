"use server";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function adjustStock(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  const reason = String(formData.get("reason") ?? "AJUSTE_MANUAL");
  const note = String(formData.get("note") ?? "").trim();
  if (!productId || !Number.isFinite(delta) || delta === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note || null });
  if (error) throw new Error(error.message);
  await syncTiendanubeStock().catch((e)=>console.error("[auto-stock] ajuste",e));
  revalidatePath("/stock");
  revalidatePath(`/productos/${productId}`);
  revalidatePath("/");
}
