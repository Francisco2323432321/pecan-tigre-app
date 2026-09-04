import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import ProductList from "@/components/products/product-list";
import NewProductButton from "./new-product-button";
import { Icon } from "@/components/ui/icons";

export default async function ProductosPage(){
  const supabase=await createClient();const profile=await getCurrentProfile();
  const {data,error}=await supabase.from("product_stock_overview").select("id,name,code,description,product_kind,inventory_mode,base_unit,on_hand,reserved,available_base,minimum_stock,active,image_url,category,visible,published,tiendanube_handle").order("name");
  const list=data??[];const own=list.filter(p=>p.inventory_mode==="PROPIO").length;const produced=list.filter(p=>p.inventory_mode==="PRODUCIDO").length;const derived=list.filter(p=>p.inventory_mode==="DERIVADO").length;
  const actions=<><Link href="/productos/importar" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="upload" className="h-4 w-4"/>CSV Tiendanube</Link><Link href="/productos/carga-masiva" className="pt-button-secondary inline-flex items-center gap-2 px-4 text-sm"><Icon name="plus" className="h-4 w-4"/>Carga masiva</Link>{profile?.role==="ADMIN"&&<NewProductButton/>}</>;
  return <main className="pt-page"><PageHeader eyebrow="Catálogo e inventario" title="Productos" description="Productos padre, variantes, imágenes, costos y forma de consumir inventario." actions={actions}/><section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Mini label="Productos" value={String(list.length)}/><Mini label="Stock propio" value={String(own)}/><Mini label="Producidos" value={String(produced)}/><Mini label="Derivados" value={String(derived)}/></section>{error?<div className="rounded-2xl border border-[#efc4ce] bg-[#fff7f8] p-4 text-sm font-semibold text-[#a94658]">No se pudo cargar el catálogo: {error.message}</div>:<ProductList products={list}/>}</main>
}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-[#efd8e2] bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[#8f7180]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#3e2833]">{value}</p></div>}
