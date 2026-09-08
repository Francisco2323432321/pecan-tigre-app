import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata():Promise<Metadata>{
  let icon="/brand/favicon.svg";
  try{const supabase=await createClient();const{data}=await supabase.from("app_settings").select("value").eq("key","brand_identity").maybeSingle();const value=(data?.value&&typeof data.value==="object"?data.value:{}) as {favicon_url?:string};if(value.favicon_url)icon=value.favicon_url;}catch{}
  return {title:"Pecán Tigre Gestión",description:"Inventario, compras, ventas y operación de Pecán Tigre",applicationName:"Pecán Tigre Gestión",icons:{icon}};
}
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#fff8fb"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" data-scroll-behavior="smooth"><body>{children}</body></html>}
