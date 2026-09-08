import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { dismissAlert, resolveSystemEvent, updateAlertSettings } from "./actions";

type Alert={key:string;fingerprint:string;severity:"ERROR"|"WARNING"|"INFO";title:string;message:string;href?:string};

export default async function AlertsPage(){
 const supabase=await createClient();
 const [productsRes,variantsRes,recipesRes,itemsRes,settingsRes,dismissalsRes,eventsRes,observationsRes,stockRes]=await Promise.all([
  supabase.from("products").select("id,name,product_kind,inventory_mode,current_cost,image_url,minimum_stock,active,updated_at,metadata").eq("active",true),
  supabase.from("product_variants").select("id,product_id,sku,base_quantity,price,promo_price,active,updated_at,tiendanube_variant_id,tiendanube_stock").eq("active",true),
  supabase.from("recipes").select("id,output_product_id,status,updated_at").eq("status","ACTIVA"),
  supabase.from("recipe_items").select("id,recipe_id,ingredient_product_id,quantity_base"),
  supabase.from("app_settings").select("value").eq("key","alerts").maybeSingle(),
  supabase.from("alert_dismissals").select("alert_key,fingerprint"),
  supabase.from("system_events").select("id,severity,title,message,created_at").eq("resolved",false).order("created_at",{ascending:false}).limit(100),
  supabase.from("tiendanube_variant_observations").select("tiendanube_product_id,linked_local_product_id,tiendanube_variant_id"),
  supabase.from("product_stock_overview").select("id,available_base,minimum_stock,base_unit,inventory_mode"),
 ]);
 const products=productsRes.data??[]; const variants=variantsRes.data??[]; const recipes=recipesRes.data??[]; const items=itemsRes.data??[];
 const threshold=Number((settingsRes.data?.value as {minimum_margin_percentage?:number}|null)?.minimum_margin_percentage??20);
 const alerts:Alert[]=[]; const stockMap=new Map((stockRes.data??[]).map(r=>[r.id,r]));
 const missingPhoto=products.filter(p=>!String(p.image_url??"").trim());
 if(missingPhoto.length)alerts.push({key:"products:missing-photo",fingerprint:missingPhoto.map(p=>`${p.id}:${p.updated_at}`).sort().join("|"),severity:"WARNING",title:"Productos sin foto",message:`Actualmente hay ${missingPhoto.length} productos sin foto: ${missingPhoto.slice(0,6).map(p=>p.name).join(", ")}${missingPhoto.length>6?"…":""}.`,href:"/productos"});
 const skuGroups=new Map<string,typeof variants>(); for(const v of variants){const sku=String(v.sku??"").trim().toUpperCase();if(!sku)continue;const arr=skuGroups.get(sku)??[];arr.push(v);skuGroups.set(sku,arr)}
 for(const[sku,rows]of skuGroups)if(rows.length>1)alerts.push({key:`sku:duplicate:${sku}`,fingerprint:rows.map(r=>`${r.id}:${r.updated_at}`).sort().join("|"),severity:"ERROR",title:`SKU duplicado · ${sku}`,message:`Hay ${rows.length} presentaciones activas usando el mismo SKU.`,href:"/productos"});
 for(const p of products){
  const stock=stockMap.get(p.id);
  const min=Number(p.minimum_stock??0); const available=Number(stock?.available_base??0);
  if(min<=0)alerts.push({key:`stock:min-missing:${p.id}`,fingerprint:`${min}:${p.updated_at}`,severity:"INFO",title:"Stock mínimo sin configurar",message:`${p.name} no tiene un stock mínimo definido.`,href:`/productos/${p.id}`});
  else if(p.inventory_mode!=="DERIVADO" && available<=min)alerts.push({key:`stock:low:${p.id}`,fingerprint:`${available}:${min}`,severity:available<=0?"ERROR":"WARNING",title:available<=0?"Producto sin stock":"Stock bajo",message:`${p.name}: disponible ${available} ${stock?.base_unit??""}; mínimo ${min}.`,href:`/productos/${p.id}`});
  const meta=(p.metadata&&typeof p.metadata==="object"?p.metadata:{}) as {needs_review?:boolean};
  if(meta.needs_review)alerts.push({key:`product:review:${p.id}`,fingerprint:`${p.updated_at}`,severity:"INFO",title:"Producto pendiente de revisión",message:`${p.name} fue importado automáticamente y necesita confirmar tipo, unidad y stock.`,href:`/productos/${p.id}`});
  const pv=variants.find(v=>v.product_id===p.id); if(!pv)continue;
  if(!String(pv.sku??"").trim())alerts.push({key:`sku:missing:${p.id}`,fingerprint:`${pv.id}:${pv.updated_at}`,severity:"ERROR",title:"Producto sin SKU",message:`${p.name} no tiene SKU configurado.`,href:`/productos/${p.id}`});
  else if(String(pv.sku).toUpperCase().startsWith("PT-"))alerts.push({key:`sku:legacy:${p.id}`,fingerprint:String(pv.sku),severity:"INFO",title:"SKU legado",message:`${p.name} todavía usa el SKU antiguo ${pv.sku}. Podés cambiarlo desde la ficha del producto.`,href:`/productos/${p.id}`});
  if(pv.promo_price!=null && Number(pv.promo_price)>0 && Number(pv.promo_price)>=Number(pv.price??0))alerts.push({key:`promo:invalid:${p.id}`,fingerprint:`${pv.price}:${pv.promo_price}`,severity:"WARNING",title:"Precio promocional inválido",message:`${p.name} tiene un precio promocional igual o superior al precio normal.`,href:`/productos/${p.id}`});
  const price=Number(pv.promo_price??pv.price??0), costBase=Number(p.current_cost??0); const base=Number(pv.base_quantity??1); const estCost=costBase*base; const margin=price>0?((price-estCost)/price)*100:0;
  if(price<=0)alerts.push({key:`price:zero:${p.id}`,fingerprint:`${price}:${pv.updated_at}`,severity:"ERROR",title:"Producto sin precio",message:`${p.name} tiene precio $0.`,href:`/productos/${p.id}`});
  else if(estCost>0 && margin<threshold)alerts.push({key:`margin:${p.id}`,fingerprint:`${price}:${estCost}:${threshold}`,severity:price<estCost?"ERROR":"WARNING",title:price<estCost?"Precio por debajo del costo":"Margen bajo",message:`${p.name}: precio ${formatMoney(price)}, costo estimado ${formatMoney(estCost)}, margen ${margin.toFixed(1)}% (mínimo ${threshold}%).`,href:`/productos/${p.id}`});
  if(costBase<=0)alerts.push({key:`cost:missing:${p.id}`,fingerprint:`${costBase}:${p.updated_at}`,severity:"WARNING",title:"Producto sin costo",message:`${p.name} no tiene costo base configurado.`,href:`/productos/${p.id}`});
  if(pv.tiendanube_variant_id && pv.tiendanube_stock!=null){const expected=Math.floor(available/Math.max(base,1));if(Number(pv.tiendanube_stock)!==expected)alerts.push({key:`tn:stock:${p.id}`,fingerprint:`${pv.tiendanube_stock}:${expected}`,severity:"WARNING",title:"Stock pendiente de sincronización",message:`${p.name}: Tiendanube registra ${pv.tiendanube_stock} y la app calcula ${expected} unidades comerciales.`,href:`/productos/${p.id}`});}
  if(["MIX","COMBO","ELABORADO"].includes(p.product_kind)){
   const r=recipes.find(r=>r.output_product_id===p.id); const count=r?items.filter(i=>i.recipe_id===r.id).length:0;
   if(!r||count===0)alerts.push({key:`recipe:missing:${p.id}`,fingerprint:`${r?.id??"none"}:${count}:${p.updated_at}`,severity:"ERROR",title:"Receta sin configurar",message:`${p.name} está marcado como ${p.product_kind.toLowerCase()} pero no tiene ingredientes configurados.`,href:`/productos/${p.id}`});
  }
 }
 const unlinkedObs=(observationsRes.data??[]).filter(o=>!o.linked_local_product_id);
 if(unlinkedObs.length)alerts.push({key:"tn:unlinked",fingerprint:unlinkedObs.map(o=>`${o.tiendanube_product_id}:${o.tiendanube_variant_id}`).sort().join("|"),severity:"WARNING",title:"Opciones de Tiendanube sin vincular",message:`Hay ${unlinkedObs.length} opciones de Tiendanube que todavía no están vinculadas a productos locales.`,href:"/configuracion"});
 const obsByProduct=new Map<string,number>();for(const o of observationsRes.data??[]){if(o.linked_local_product_id)obsByProduct.set(o.linked_local_product_id,(obsByProduct.get(o.linked_local_product_id)??0)+1)}
 for(const[pId,count]of obsByProduct)if(count>1){const p=products.find(x=>x.id===pId);alerts.push({key:`tn:variants:${pId}`,fingerprint:String(count),severity:"INFO",title:"Variantes detectadas en Tiendanube",message:`${p?.name??"Un producto"} tiene ${count} opciones detectadas. La app no aplica lógica de stock automática hasta revisarlo.`,href:`/productos/${pId}`})}
 const dismissed=new Set((dismissalsRes.data??[]).map(d=>`${d.alert_key}::${d.fingerprint}`)); const visible=alerts.filter(a=>!dismissed.has(`${a.key}::${a.fingerprint}`));
 const counts={ERROR:visible.filter(a=>a.severity==="ERROR").length,WARNING:visible.filter(a=>a.severity==="WARNING").length,INFO:visible.filter(a=>a.severity==="INFO").length};
 return <main className="pt-page"><PageHeader eyebrow="Control" title="Errores y alertas" description="Problemas operativos detectados automáticamente. Las alertas ignoradas reaparecen si cambia el dato que las originó." />
  <section className="mb-4 grid grid-cols-3 gap-3"><Metric label="Errores" value={counts.ERROR} tone="red"/><Metric label="Advertencias" value={counts.WARNING} tone="amber"/><Metric label="Información" value={counts.INFO} tone="purple"/></section>
  <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-5 py-4"><h2 className="font-black text-[#3e2833]">Pendientes</h2></div>{visible.length===0?<div className="p-8 text-center text-sm text-[#80616f]">No hay alertas calculadas pendientes.</div>:<div className="divide-y divide-[#f3e8ed]">{visible.map(a=><div key={`${a.key}:${a.fingerprint}`} className="p-4 sm:p-5"><div className="flex gap-3"><span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${a.severity==="ERROR"?"bg-[#cf4b63]":a.severity==="WARNING"?"bg-[#e1a642]":"bg-[#6d5cff]"}`}/><div className="min-w-0 flex-1"><p className="font-black text-[#3e2833]">{a.title}</p><p className="mt-1 text-sm leading-6 text-[#776672]">{a.message}</p><div className="mt-3 flex flex-wrap gap-2">{a.href&&<Link href={a.href} className="pt-button-secondary inline-flex min-h-9 items-center px-3 text-xs">Revisar</Link>}<form action={dismissAlert}><input type="hidden" name="alert_key" value={a.key}/><input type="hidden" name="fingerprint" value={a.fingerprint}/><button className="pt-button-ghost min-h-9 px-3 text-xs">Ignorar esta alerta</button></form></div></div></div></div>)}</div>}</section>
  <aside className="space-y-4"><section className="pt-card p-5"><p className="pt-section-title">Reglas</p><h2 className="mt-1 font-black text-[#3e2833]">Margen mínimo</h2><form action={updateAlertSettings} className="mt-4"><label className="block"><span className="pt-label">Advertir por debajo de</span><div className="relative"><input name="minimum_margin_percentage" type="number" min="0" max="100" step="1" defaultValue={threshold} className="pt-input pr-10"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#8d7480]">%</span></div></label><button className="pt-button-primary mt-3 w-full px-4">Guardar regla</button></form></section>
  <section className="pt-card overflow-hidden"><div className="border-b border-[#f2e0e8] px-5 py-4"><h2 className="font-black text-[#3e2833]">Eventos del sistema</h2></div><div className="divide-y divide-[#f3e8ed]">{(eventsRes.data??[]).slice(0,10).map(e=><div key={e.id} className="p-4"><p className="text-sm font-black text-[#3e2833]">{e.title}</p><p className="mt-1 text-xs leading-5 text-[#80616f]">{e.message}</p><form action={resolveSystemEvent} className="mt-2"><input type="hidden" name="id" value={e.id}/><button className="text-[11px] font-black text-[#6d5cff]">Marcar resuelto</button></form></div>)}{(eventsRes.data??[]).length===0&&<div className="p-4 text-xs text-[#80616f]">Sin eventos abiertos.</div>}</div></section></aside></div>
 </main>;
}
function Metric({label,value,tone}:{label:string;value:number;tone:"red"|"amber"|"purple"}){const c=tone==="red"?"text-[#b4475b] bg-[#fff7f8] border-[#f0cad2]":tone==="amber"?"text-[#9a6b20] bg-[#fffaf1] border-[#f0ddb8]":"text-[#6655d8] bg-[#f7f4ff] border-[#ded8f5]";return <div className={`rounded-2xl border p-4 ${c}`}><p className="text-[10px] font-black uppercase tracking-wide">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>}
