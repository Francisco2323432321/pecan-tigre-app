import { tiendanubeApiUrl } from "@/lib/tiendanube";

const ORDER_EVENTS = ["order/created", "order/cancelled"] as const;

type ExistingWebhook = { id: number; event: string; url: string };

export async function ensureTiendanubeOrderWebhooks(
  storeId: string | number,
  accessToken: string,
  origin: string,
) {
  const appId = process.env.TIENDANUBE_APP_ID;
  if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");
  if (!origin.startsWith("https://") || /localhost|127\.0\.0\.1/i.test(origin)) {
    return { ok: false, skipped: true, reason: "Los webhooks requieren una URL HTTPS pública." };
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": `Pecan Tigre (${appId})`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const targetUrl = `${origin.replace(/\/$/, "")}/api/tiendanube/webhooks/orders`;

  const listResponse = await fetch(tiendanubeApiUrl(storeId, "webhooks"), { headers, cache: "no-store" });
  if (!listResponse.ok) throw new Error(`No se pudieron listar webhooks: HTTP ${listResponse.status}`);
  const existing = (await listResponse.json()) as ExistingWebhook[];

  let created = 0;
  for (const event of ORDER_EVENTS) {
    const alreadyExists = existing.some((hook) => hook.event === event && hook.url === targetUrl);
    if (alreadyExists) continue;
    const response = await fetch(tiendanubeApiUrl(storeId, "webhooks"), {
      method: "POST",
      headers,
      body: JSON.stringify({ event, url: targetUrl }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`No se pudo crear webhook ${event}: HTTP ${response.status} ${(await response.text()).slice(0, 250)}`);
    created++;
  }

  return { ok: true, created, targetUrl };
}
