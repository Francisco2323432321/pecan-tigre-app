import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {tiendanubeAdmin} from "@/lib/tiendanube";

export async function POST(request:NextRequest){
 const userClient=await createClient();const{data:{user}}=await userClient.auth.getUser();if(!user)return NextResponse.json({ok:false,error:"Sin sesión"},{status:401});
 const{data:profile}=await userClient.from("profiles").select("role,active").eq("id",user.id).maybeSingle();if(!profile?.active||profile.role!=="ADMIN")return NextResponse.json({ok:false,error:"Solo ADMIN puede cambiar la identidad"},{status:403});
 const form=await request.formData();const kind=String(form.get("kind")??"");const file=form.get("file");if(!["logo","favicon"].includes(kind)||!(file instanceof File))return NextResponse.json({ok:false,error:"Archivo inválido"},{status:400});
 if(file.size>2*1024*1024)return NextResponse.json({ok:false,error:"El archivo supera 2 MB"},{status:400});
 const allowed=["image/png","image/jpeg","image/webp","image/svg+xml","image/x-icon"];if(!allowed.includes(file.type))return NextResponse.json({ok:false,error:"Formato no permitido"},{status:400});
 const ext=(file.name.split(".").pop()||"png").replace(/[^a-z0-9]/gi,"").toLowerCase();const path=`${kind}.${ext}`;const admin=tiendanubeAdmin();
 const{error:uploadError}=await admin.storage.from("brand").upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:true,cacheControl:"60"});if(uploadError)return NextResponse.json({ok:false,error:uploadError.message},{status:500});
 const{data:urlData}=admin.storage.from("brand").getPublicUrl(path);const url=`${urlData.publicUrl}?v=${Date.now()}`;
 const{data:setting}=await admin.from("app_settings").select("value").eq("key","brand_identity").maybeSingle();const old=(setting?.value&&typeof setting.value==="object"?setting.value:{}) as Record<string,unknown>;const value={...old,[`${kind}_url`]:url};const{error:settingError}=await admin.from("app_settings").upsert({key:"brand_identity",value},{onConflict:"key"});if(settingError)return NextResponse.json({ok:false,error:settingError.message},{status:500});
 return NextResponse.json({ok:true,url});
}
