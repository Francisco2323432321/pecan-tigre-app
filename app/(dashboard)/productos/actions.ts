"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const productKind = String(formData.get("product_kind") ?? "INSUMO");
  const inventoryMode = String(formData.get("inventory_mode") ?? "PROPIO");
  const baseUnit = String(formData.get("base_unit") ?? "g");

  if (!name) return;

  const { error } = await supabase.rpc("create_product", {
    p_name: name,
    p_code: code || null,
    p_product_kind: productKind,
    p_inventory_mode: inventoryMode,
    p_base_unit: baseUnit,
  });

  if (error) {
    console.error("Error creando producto:", error);
    throw new Error("No se pudo crear el producto.");
  }

  revalidatePath("/productos");
}
