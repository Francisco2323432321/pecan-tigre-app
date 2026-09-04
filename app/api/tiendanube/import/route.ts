import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(request:Request){
  try{const body=await request.json();if(!Array.isArray(body.products))return NextResponse.json({error:"Payload inválido"},{status:400});const supabase=await createClient();const {data,error}=await supabase.rpc("import_tiendanube_catalog",{p_products:body.products});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json(data??{});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error inesperado"},{status:500})}
}
