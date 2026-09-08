import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";
import { SyncCatalogButton } from "@/components/tiendanube/sync-catalog-button";
import { SyncProductsButton } from "@/components/tiendanube/sync-products-button";
import { SyncPricesButton } from "@/components/tiendanube/sync-prices-button";
import { SyncStockButton } from "@/components/tiendanube/sync-stock-button";
import { SyncAutomationButton } from "@/components/tiendanube/sync-automation-button";
import UserRoleManager from "@/components/user-role-manager";
import BrandSettings from "@/components/brand-settings";

type TiendanubeConnection={store_id:string;connected_at:string};
type MercadoPagoStatus={account_user_id:string;connected_at:string;expires_at:string|null};

export default async function ConfiguracionPage(){
 const supabase=await createClient();const profile=await getCurrentProfile();const isAdmin=profile?.role==="ADMIN";
 const [productsResult,ordersResult,eventsResult,tiendanubeResult,observationsResult,mpResult,profilesResult,brandResult]=await Promise.all([
  supabase.from("products").select("id",{count:"exact",head:true}),
  supabase.from("orders").select("id",{count:"exact",head:true}),
  supabase.from("system_events").select("id",{count:"exact",head:true}).eq("resolved",false),
  supabase.rpc("get_tiendanube_connection_status").maybeSingle(),
  supabase.from("tiendanube_variant_observations").select("tiendanube_variant_id,linked_local_product_id"),
  isAdmin?supabase.rpc("get_mercadopago_connection_status").maybeSingle():Promise.resolve({data:null,error:null}),
  isAdmin?supabase.from("profiles").select("id,full_name,role,active").order("created_at"):Promise.resolve({data:[],error:null}),
  supabase.from("app_settings").select("value").eq("key","brand_identity").maybeSingle(),
 ]);
 const tn=tiendanubeResult.data as TiendanubeConnection|null;const mp=mpResult.data as MercadoPagoStatus|null;const observed=observationsResult.error?[]:(observationsResult.data??[]);const byProduct=new Map<string,number>();let unlinked=0;for(const r of observed){if(!r.linked_local_product_id){unlinked++;continue}byProduct.set(r.linked_local_product_id,(byProduct.get(r.linked_local_product_id)??0)+1)}const multi=[...byProduct.values()].filter(c=>c>1).length;const brand=(brandResult.data?.value&&typeof brandResult.data.value==="object"?brandResult.data.value:{}) as {logo_url?:string;favicon_url?:string};
 return <main className="pt-page"><PageHeader eyebrow="Administración" title="Configuración" description="Integraciones, identidad, usuarios, permisos y control del sistema." />
  <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Productos" value={String(productsResult.count??0)} detail="catálogo central"/><Metric label="Pedidos" value={String(ordersResult.count??0)} detail="historial cargado"/><Metric label="Tiendanube" value={tn?"Conectada":"Pendiente"} detail={tn?`Tienda ${tn.store_id}`:"requiere vinculación"} ok={Boolean(tn)}/><Metric label="Alertas" value={String(eventsResult.count??0)} detail="eventos abiertos" danger={(eventsResult.count??0)>0}/></section>
  <div className="mb-4 flex flex-wrap gap-2"><Link href="/configuracion/alertas" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="alert" className="h-4 w-4"/>Errores y alertas</Link>{isAdmin&&<Link href="/finanzas" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="finance" className="h-4 w-4"/>Finanzas</Link>}</div>
  <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
   <div className="space-y-4">
    <section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Integración</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Tiendanube</h2></div><div className="p-5">{tn?<div className="space-y-4"><div className="flex items-start gap-3 rounded-2xl border border-[#cfe8db] bg-[#f5fbf8] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f5eb] text-[#36785b]"><Icon name="check" className="h-5 w-5"/></span><div><p className="font-black text-[#315e4a]">Tiendanube vinculada</p><p className="mt-1 text-xs leading-5 text-[#5d7d6e]">La operación diaria es automática. Los controles manuales quedan como diagnóstico.</p></div></div><SyncAutomationButton/><details className="rounded-2xl border border-[#eee0e7] bg-[#fffafd] p-4"><summary className="cursor-pointer text-sm font-black text-[#5b4651]">Opciones avanzadas / Diagnóstico</summary><div className="mt-4 space-y-4"><Advanced title="Forzar catálogo" text="Tiendanube → App. Actualiza vínculos, imágenes y detecta variantes nuevas."><SyncCatalogButton/></Advanced><Advanced title="Reenviar productos" text="App → Tiendanube. Uso excepcional."><SyncProductsButton/></Advanced><Advanced title="Reenviar precios" text="Opcional; podés seguir usando CSV si preferís."><SyncPricesButton/></Advanced><Advanced title="Reenviar stock" text="App → Tiendanube. Respaldo manual de la automatización."><SyncStockButton/></Advanced></div></details>{(multi>0||unlinked>0)&&<div className="rounded-2xl border border-[#efd2ae] bg-[#fffaf2] p-4 text-sm text-[#89653d]">Se detectaron {multi} productos con múltiples opciones y {unlinked} opciones sin vínculo. Revisalos en Errores y alertas.</div>}</div>:<div className="rounded-2xl border border-[#e8d9ef] bg-[#faf7ff] p-5"><p className="font-black text-[#44364c]">Conectá la tienda una sola vez.</p><p className="mt-1 text-sm leading-6 text-[#75687e]">Después la app mantiene webhooks, catálogo y stock en segundo plano.</p><Link href="/api/tiendanube/connect" className="pt-button-primary mt-4 inline-flex px-5 text-sm">Vincular Tiendanube</Link></div>}</div></section>
    {isAdmin&&<section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Usuarios</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Usuarios y permisos</h2><p className="mt-1 text-xs text-[#80616f]">Solo existen ADMIN y OPERADOR. No se puede quitar el último ADMIN.</p></div><UserRoleManager users={(profilesResult.data??[]) as never[]} currentUserId={profile?.id}/></section>}
   </div>
   <aside className="space-y-4">
    {isAdmin&&<section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Identidad</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Logo y favicon</h2></div><div className="p-5"><BrandSettings initial={brand}/></div></section>}
    {isAdmin&&<section className="pt-card p-5"><p className="pt-section-title">Finanzas</p><h2 className="mt-1 font-black text-[#3e2833]">Mercado Pago</h2><div className="mt-3"><Status label="Acceso" detail="Solo ADMIN" ok/><Status label="Mercado Pago" detail={mp?`Cuenta ${mp.account_user_id} conectada`:"OAuth disponible; saldo real todavía no conciliado"} ok={Boolean(mp)}/></div></section>}
    <section className="pt-card p-5"><p className="pt-section-title">Sistema</p><div className="mt-3 space-y-3"><Status label="Supabase" detail="Base de datos conectada" ok/><Status label="Autenticación" detail={profile?"Sesión iniciada":"Sin sesión"} ok={Boolean(profile)}/><Status label="Alertas" detail={`${eventsResult.count??0} eventos abiertos`} ok={(eventsResult.count??0)===0}/></div></section>
   </aside>
  </section>
 </main>;
}
function Advanced({title,text,children}:{title:string;text:string;children:ReactNode}){return <div className="border-t border-[#f0e3e9] pt-4 first:border-0 first:pt-0"><p className="text-sm font-black text-[#3e2833]">{title}</p><p className="mb-2 mt-1 text-xs leading-5 text-[#80616f]">{text}</p>{children}</div>}
function Status({label,detail,ok=false}:{label:string;detail:string;ok?:boolean}){return <div className="mt-2 flex items-start gap-3 rounded-2xl border border-[#f0e1e8] bg-[#fffafd] p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${ok?"bg-[#e3f5eb] text-[#36785b]":"bg-[#f3edf0] text-[#8f7480]"}`}>{ok?"✓":"•"}</div><div><p className="text-sm font-black text-[#3e2833]">{label}</p><p className="mt-0.5 text-xs text-[#80616f]">{detail}</p></div></div>}
function Metric({label,value,detail,ok,danger}:{label:string;value:string;detail:string;ok?:boolean;danger?:boolean}){return <div className={`rounded-2xl border p-4 ${danger?"border-[#efc3cc] bg-[#fff8f9]":ok?"border-[#d3e9dd] bg-[#f8fcfa]":"border-[#efd8e2] bg-white"}`}><p className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#917380]">{label}</p><p className={`mt-1 text-xl font-black ${danger?"text-[#aa4558]":ok?"text-[#36785b]":"text-[#3e2833]"}`}>{value}</p><p className="mt-0.5 text-[11px] text-[#987b88]">{detail}</p></div>}
