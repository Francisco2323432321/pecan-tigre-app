"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const productKind = String(formData.get("product_kind") ?? "INSUMO");
  const inventoryMode = String(formData.get("inventory_mode") ?? "PROPIO");
  const baseUnit = String(formData.get("base_unit") ?? "g");
  const price = Number(formData.get("price") ?? 0);

  if (!name || !["g", "u"].includes(baseUnit)) return;

  const { error } = await supabase.rpc("create_simple_product", {
    p_name: name,
    p_code: code || null,
    p_product_kind: productKind,
    p_inventory_mode: inventoryMode,
    p_base_unit: baseUnit,
    p_sku: sku || null,
    p_price: Number.isFinite(price) ? price : 0,
  });

  if (error) {
    console.error("Error creando producto:", error);
    throw new Error("No se pudo crear el producto. Ejecutá primero supabase/06-unified-products-finance.sql si todavía no lo hiciste.");
  }

  revalidatePath("/productos");
}

export async function applyQuickStock(formData: FormData) {
  const raw = String(formData.get("items_json") ?? "[]");
  const notes = String(formData.get("notes") ?? "Edición rápida de stock").trim();
  let items: Array<{ product_id: string; counted_quantity: number }> = [];
  try { items = JSON.parse(raw); } catch { return; }
  items = items.filter((item) => item.product_id && Number.isFinite(item.counted_quantity) && item.counted_quantity >= 0);
  if (!items.length) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_stock_count", { p_items: items, p_notes: notes || "Edición rápida de stock" });
  if (error) throw new Error(error.message);

  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] edición rápida", error));
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/");
}
