"use server";
import {redirect} from "next/navigation";import {revalidatePath} from "next/cache";import {createClient} from "@/lib/supabase/server";
export async function createManualSale(formData:FormData){const payload=JSON.parse(String(formData.get("payload")??"{}"));const supabase=await createClient();const{data,error}=await supabase.rpc("create_manual_order",{p_payload:payload});if(error)throw new Error(error.message);revalidatePath("/ventas");revalidatePath("/pedidos");revalidatePath("/stock");revalidatePath("/");redirect(`/ventas/${String(data)}`)}
