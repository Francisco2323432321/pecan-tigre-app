"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function quickPurchase(formData:FormData){
  const supabase=await createClient();
  const {error}=await supabase.rpc("quick_receive_purchase",{
    p_supplier:String(formData.get("supplier")??"").trim(),
    p_product_id:String(formData.get("product_id")??""),
    p_quantity_base:Number(formData.get("quantity_base")??0),
    p_unit_cost:Number(formData.get("unit_cost")??0),
    p_notes:String(formData.get("notes")??"").trim()||null,
  });
  if(error)throw new Error(error.message);
  revalidatePath("/compras");revalidatePath("/stock");revalidatePath("/productos");revalidatePath("/");
}
