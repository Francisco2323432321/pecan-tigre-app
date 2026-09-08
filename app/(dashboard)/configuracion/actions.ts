"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateUserRole(formData:FormData){
 const id=String(formData.get("profile_id")??""); const role=String(formData.get("role")??""); if(!id||!["ADMIN","OPERADOR"].includes(role))return {ok:false,message:"Datos inválidos"};
 const supabase=await createClient(); const {error}=await supabase.rpc("set_profile_role_v3",{p_profile_id:id,p_role:role}); if(error)return{ok:false,message:error.message};
 revalidatePath("/configuracion"); return{ok:true,message:"Permiso actualizado"};
}
