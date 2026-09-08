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
  const requestedSku = String(formData.get("sku") ?? "").trim();
  const productKind = String(formData.get("product_kind") ?? "INSUMO");
  const inventoryMode = String(formData.get("inventory_mode") ?? "PROPIO");
  const baseUnit = String(formData.get("base_unit") ?? "g");
  const price = Number(formData.get("price") ?? 0);
  if (!name || !["g", "u"].includes(baseUnit)) return { ok: false, message: "Nombre o unidad inválidos." };

  const { data, error } = await supabase.rpc("create_product_v3", {
    p_name: name,
    p_code: code || null,
    p_product_kind: productKind,
    p_inventory_mode: inventoryMode,
    p_base_unit: baseUnit,
    p_sku: requestedSku || null,
    p_price: Number.isFinite(price) ? price : 0,
  });

  if (error) {
    console.error("Error creando producto:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath("/productos");
  return { ok: true, productId: String(data) };
}

export type QuickStockChange = { product_id: string; mode: "DELTA" | "SET"; value: number };

export async function applyQuickStockChanges(items: QuickStockChange[], notes: string) {
  const clean = (items ?? []).filter((item) =>
    item?.product_id && ["DELTA", "SET"].includes(item.mode) && Number.isFinite(Number(item.value)) && (item.mode === "DELTA" ? Number(item.value) !== 0 : Number(item.value) >= 0),
  );
  if (!clean.length) return { ok: false, message: "No hay cambios para aplicar." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_stock_changes_v3", {
    p_items: clean,
    p_notes: notes?.trim() || "Stock rápido",
  });
  if (error) return { ok: false, message: error.message };

  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] edición rápida", error));
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/");
  return { ok: true, message: "Stock actualizado correctamente" };
}
