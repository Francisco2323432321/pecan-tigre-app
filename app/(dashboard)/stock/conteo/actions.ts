"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function applyStockCount(formData: FormData) {
  const raw = String(formData.get("items_json") ?? "[]");
  const notes = String(formData.get("notes") ?? "").trim();
  let items: Array<{ product_id: string; counted_quantity: number }> = [];
  try { items = JSON.parse(raw); } catch { return; }
  if (!items.length) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_stock_count", { p_items: items, p_notes: notes || null });
  if (error) throw new Error(error.message);
  revalidatePath("/stock");
  revalidatePath("/stock/conteo");
  revalidatePath("/");
  redirect("/stock");
}
