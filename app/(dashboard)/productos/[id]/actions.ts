"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

function refresh(id: string) {
  revalidatePath(`/productos/${id}`);
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/");
}

const nullable = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("product_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({
    name: String(formData.get("name") ?? "").trim(),
    code: nullable(formData.get("code")),
    description: nullable(formData.get("description")),
    category: nullable(formData.get("category")),
    minimum_stock: Number(formData.get("minimum_stock") ?? 0),
    current_cost: Number(formData.get("current_cost") ?? 0),
    image_url: nullable(formData.get("image_url")),
    visible: formData.get("visible") === "on",
    published: formData.get("published") === "on",
    active: formData.get("active") === "on",
  }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

export async function updateSaleOption(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  if (!productId || !variantId) return;

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase.from("products").select("base_unit").eq("id", productId).maybeSingle();
  if (productError || !product) throw new Error(productError?.message ?? "Producto inexistente");

  const simpleBaseQuantity = product.base_unit === "g" ? 100 : 1;
  const { error } = await supabase.from("product_variants").update({
    name: product.base_unit === "g" ? "100 g" : "Unidad",
    sku: nullable(formData.get("sku")),
    base_quantity: simpleBaseQuantity,
    price: Number(formData.get("price") ?? 0),
    promo_price: Number(formData.get("promo_price") ?? 0) || null,
    cost: Number(formData.get("cost") ?? 0) || null,
    shipping_weight_g: Number(formData.get("shipping_weight_g") ?? 0) || null,
    active: true,
    visible: true,
  }).eq("id", variantId);
  if (error) throw new Error(error.message);

  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] opción de venta", error));
  refresh(productId);
}

export async function createRecipe(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").insert({
    output_product_id: productId,
    name: `Receta de ${String(formData.get("product_name") ?? "producto")}`,
    output_quantity_base: Number(formData.get("output_quantity_base") ?? 0),
    status: "ACTIVA",
  });
  if (error) throw new Error(error.message);
  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] receta", error));
  refresh(productId);
}

export async function addRecipeItem(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const recipeId = String(formData.get("recipe_id") ?? "");
  const ingredientId = String(formData.get("ingredient_product_id") ?? "");
  if (!productId || !recipeId || !ingredientId || ingredientId === productId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("recipe_items").insert({
    recipe_id: recipeId,
    ingredient_product_id: ingredientId,
    quantity_base: Number(formData.get("quantity_base") ?? 0),
    notes: nullable(formData.get("notes")),
  });
  if (error) throw new Error(error.message);
  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] ingrediente receta", error));
  refresh(productId);
}

export async function removeRecipeItem(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  if (!productId || !itemId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("recipe_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  await syncTiendanubeStock().catch((error) => console.error("[auto-stock] quitar ingrediente", error));
  refresh(productId);
}
