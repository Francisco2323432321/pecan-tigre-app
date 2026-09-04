"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
const n=(v:FormDataEntryValue|null)=>String(v??"").trim()||null;
export async function createSupplier(formData:FormData){const supabase=await createClient();const name=String(formData.get("name")??"").trim();if(!name)return;const{error}=await supabase.from("suppliers").insert({name,contact_name:n(formData.get("contact_name")),phone:n(formData.get("phone")),email:n(formData.get("email")),address:n(formData.get("address")),tax_id:n(formData.get("tax_id")),notes:n(formData.get("notes"))});if(error)throw new Error(error.message);revalidatePath("/proveedores");revalidatePath("/compras/nueva")}
