"use server";
import {redirect} from "next/navigation";import {revalidatePath} from "next/cache";import {createClient} from "@/lib/supabase/server";
export async function createPurchase(formData:FormData){const payload=JSON.parse(String(formData.get("payload")??"{}"));const supabase=await createClient();const{data,error}=await supabase.rpc("receive_purchase",{p_payload:payload});if(error)throw new Error(error.message);revalidatePath("/compras");revalidatePath("/stock");revalidatePath("/productos");revalidatePath("/");redirect(`/compras?created=${String(data??"")}`)}
