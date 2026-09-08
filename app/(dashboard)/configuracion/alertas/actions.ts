"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function dismissAlert(formData: FormData) {
  const alertKey=String(formData.get("alert_key")??""); const fingerprint=String(formData.get("fingerprint")??"");
  if(!alertKey||!fingerprint)return;
  const supabase=await createClient(); const {data:user}=await supabase.auth.getUser();
  const {error}=await supabase.from("alert_dismissals").upsert({alert_key:alertKey,fingerprint,dismissed_by:user.user?.id??null},{onConflict:"alert_key,fingerprint"});
  if(error)throw new Error(error.message); revalidatePath("/configuracion/alertas");
}
export async function resolveSystemEvent(formData:FormData){const id=String(formData.get("id")??"");if(!id)return;const supabase=await createClient();const{error}=await supabase.from("system_events").update({resolved:true,resolved_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/configuracion/alertas");}
export async function updateAlertSettings(formData:FormData){const margin=Math.max(0,Math.min(100,Number(formData.get("minimum_margin_percentage")??20)));const supabase=await createClient();const{error}=await supabase.from("app_settings").upsert({key:"alerts",value:{minimum_margin_percentage:margin}},{onConflict:"key"});if(error)throw new Error(error.message);revalidatePath("/configuracion/alertas");}
