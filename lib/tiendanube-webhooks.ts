import { tiendanubeApiUrl } from "@/lib/tiendanube";

const WEBHOOKS = [
  { event: "order/created", path: "/api/tiendanube/webhooks/orders" },
  { event: "order/cancelled", path: "/api/tiendanube/webhooks/orders" },
  { event: "product/created", path: "/api/tiendanube/webhooks/products" },
  { event: "product/updated", path: "/api/tiendanube/webhooks/products" },
  { event: "product/deleted", path: "/api/tiendanube/webhooks/products" },
] as const;

type ExistingWebhook = { id: number; event: string; url: string };

export async function ensureTiendanubeOrderWebhooks(storeId:string|number,accessToken:string,origin:string){
 const appId=process.env.TIENDANUBE_APP_ID;if(!appId)throw new Error("Falta TIENDANUBE_APP_ID");
 if(!origin.startsWith("https://")||/localhost|127\.0\.0\.1/i.test(origin))return{ok:false,skipped:true,reason:"Los webhooks requieren una URL HTTPS pública."};
 const headers={Authorization:`Bearer ${accessToken}`,"User-Agent":`Pecan Tigre (${appId})`,Accept:"application/json","Content-Type":"application/json"};
 const listResponse=await fetch(tiendanubeApiUrl(storeId,"webhooks"),{headers,cache:"no-store"});if(!listResponse.ok)throw new Error(`No se pudieron listar webhooks: HTTP ${listResponse.status}`);const existing=await listResponse.json() as ExistingWebhook[];
 let created=0;
 for(const hook of WEBHOOKS){const targetUrl=`${origin.replace(/\/$/,"")}${hook.path}`;if(existing.some(x=>x.event===hook.event&&x.url===targetUrl))continue;const response=await fetch(tiendanubeApiUrl(storeId,"webhooks"),{method:"POST",headers,body:JSON.stringify({event:hook.event,url:targetUrl}),cache:"no-store"});if(!response.ok)throw new Error(`No se pudo crear webhook ${hook.event}: HTTP ${response.status} ${(await response.text()).slice(0,250)}`);created++}
 return{ok:true,created};
}
