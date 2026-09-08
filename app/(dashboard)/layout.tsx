import { redirect } from "next/navigation";
import AppNavigation from "@/components/app-navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");
  const supabase=await createClient();
  const {data:brand}=await supabase.from("app_settings").select("value").eq("key","brand_identity").maybeSingle();
  const value=(brand?.value&&typeof brand.value==="object"?brand.value:{}) as {logo_url?:string};
  return <div className="min-h-dvh w-full bg-transparent md:flex"><AppNavigation name={profile.full_name || "Usuario"} role={profile.role} logoUrl={value.logo_url||"/brand/logo.svg"}/><div className="min-w-0 flex-1 pt-[62px] md:pt-0"><div className="min-h-dvh w-full pb-[82px] md:pb-0">{children}</div></div></div>;
}
