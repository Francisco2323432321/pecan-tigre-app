"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function changeOrderStatus(formData:FormData){
  const orderId=String(formData.get("order_id")??"");
  const status=String(formData.get("status")??"");
  if(!orderId||!status)return;
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_order_status",{p_order_id:orderId,p_status:status});
  if(error)throw new Error(error.message);
  revalidatePath(`/ventas/${orderId}`);revalidatePath("/ventas");revalidatePath("/pedidos");revalidatePath("/stock");revalidatePath("/");
}
