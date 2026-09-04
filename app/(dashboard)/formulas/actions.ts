"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveOrCreateFormula(formData: FormData) {
  const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  const intent = String(formData.get("intent") ?? "draft");
  const supabase = await createClient();
  if (intent === "draft") {
    const { error } = await supabase.rpc("save_formula_draft", { p_payload: payload });
    if (error) throw new Error(error.message);
    const route = payload.type === "COMBO" ? "/combos" : payload.type === "MIX" ? "/mixes" : "/recetas";
    revalidatePath(route);
    return;
  }
  const { data, error } = await supabase.rpc("create_formula_product", { p_payload: payload });
  if (error) throw new Error(error.message);
  revalidatePath("/productos");
  revalidatePath("/stock");
  redirect(`/productos/${String(data)}`);
}
