import { NextRequest, NextResponse } from "next/server";
import { tiendanubeAdmin, tiendanubeApiUrl } from "@/lib/tiendanube";
import { syncTiendanubeStock } from "@/lib/tiendanube-stock";

type WebhookPayload = { store_id?: number | string; event?: string; id?: number | string };
type TNOrderItem = { variant_id?: number | string; sku?: string | null; quantity?: number; price?: string | number; name?: string };
type TNOrder = {
  id: number | string;
  number?: number | string;
  contact_email?: string | null;
  contact_phone?: string | null;
  customer?: { name?: string | null } | null;
  products?: TNOrderItem[];
  note?: string | null;
  owner_note?: string | null;
  discount?: string | number | null;
  currency?: string | null;
  gateway?: string | null;
  gateway_name?: string | null;
  payment_status?: string | null;
  shipping?: string | null;
  shipping_option?: string | null;
  shipping_cost_customer?: string | number | null;
  shipping_cost_owner?: string | number | null;
  shipping_address?: {
    name?: string | null;
    address?: string | null;
    number?: string | null;
    floor?: string | null;
    locality?: string | null;
    city?: string | null;
    province?: string | null;
    zipcode?: string | null;
  } | null;
};

type LocalVariant = { id: string; product_id: string; tiendanube_variant_id: string | null; sku: string | null };

async function verifyHmac(rawBody: string, received: string | null) {
  const secret = process.env.TIENDANUBE_CLIENT_SECRET;
  if (!secret || !received) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return expected.toLowerCase() === received.trim().toLowerCase();
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function addressText(address: TNOrder["shipping_address"]) {
  if (!address) return null;
  const street = [address.address, address.number].filter(Boolean).join(" ");
  const area = [address.floor, address.locality, address.city, address.province, address.zipcode].filter(Boolean).join(", ");
  return [street, area].filter(Boolean).join(" · ") || null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-linkedstore-hmac-sha256");
  if (!(await verifyHmac(rawBody, hmac))) {
    return NextResponse.json({ ok: false, error: "Firma de webhook inválida" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const storeId = String(payload.store_id ?? "");
  const orderId = String(payload.id ?? "");
  const event = String(payload.event ?? "");
  if (!storeId || !orderId || !event.startsWith("order/")) {
    return NextResponse.json({ ok: false, error: "Webhook incompleto" }, { status: 400 });
  }

  const supabase = tiendanubeAdmin();
  const { data: connection } = await supabase
    .from("tiendanube_connections")
    .select("store_id,access_token")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!connection) return NextResponse.json({ ok: false, error: "Tienda no conectada" }, { status: 404 });

  const { data: previous } = await supabase
    .from("tiendanube_order_links")
    .select("local_order_id,status")
    .eq("store_id", storeId)
    .eq("tiendanube_order_id", orderId)
    .maybeSingle();

  try {
    if (event === "order/cancelled") {
      if (previous?.local_order_id) {
        const { error } = await supabase.rpc("set_order_status", { p_order_id: previous.local_order_id, p_status: "CANCELADO" });
        if (error) throw new Error(error.message);
      }
      await supabase.from("tiendanube_order_links").upsert({
        store_id: storeId,
        tiendanube_order_id: orderId,
        local_order_id: previous?.local_order_id ?? null,
        status: "CANCELLED",
        last_event: event,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id,tiendanube_order_id" });
      await syncTiendanubeStock().catch((error) => console.error("[Tiendanube webhook] sync stock:", error));
      return NextResponse.json({ ok: true, event, cancelled: true });
    }

    if (event !== "order/created") return NextResponse.json({ ok: true, ignored: true });
    if (previous?.local_order_id && previous.status === "PROCESSED") return NextResponse.json({ ok: true, duplicate: true });

    await supabase.from("tiendanube_order_links").upsert({
      store_id: storeId,
      tiendanube_order_id: orderId,
      local_order_id: previous?.local_order_id ?? null,
      status: "PROCESSING",
      last_event: event,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,tiendanube_order_id" });

    const appId = process.env.TIENDANUBE_APP_ID;
    if (!appId) throw new Error("Falta TIENDANUBE_APP_ID");
    const orderResponse = await fetch(tiendanubeApiUrl(storeId, `orders/${orderId}`), {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "User-Agent": `Pecan Tigre (${appId})`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!orderResponse.ok) throw new Error(`No se pudo leer el pedido de Tiendanube: HTTP ${orderResponse.status}`);
    const order = (await orderResponse.json()) as TNOrder;

    const remoteVariantIds = Array.from(new Set((order.products ?? []).map((item) => String(item.variant_id ?? "")).filter(Boolean)));
    if (!remoteVariantIds.length) throw new Error("El pedido no tiene variantes vinculables");

    const { data: localRaw, error: localError } = await supabase
      .from("product_variants")
      .select("id,product_id,tiendanube_variant_id,sku")
      .in("tiendanube_variant_id", remoteVariantIds);
    if (localError) throw new Error(localError.message);

    const byRemoteId = new Map<string, LocalVariant>();
    for (const variant of (localRaw ?? []) as LocalVariant[]) {
      if (variant.tiendanube_variant_id) byRemoteId.set(String(variant.tiendanube_variant_id), variant);
    }

    const grossTotal = (order.products ?? []).reduce((sum, item) => sum + money(item.price) * Math.max(0, Number(item.quantity ?? 0)), 0);
    const orderDiscount = Math.max(0, money(order.discount));
    const items = [] as Array<{ product_id: string; variant_id: string; quantity: number; unit_price: number; discount: number }>;
    const missing: string[] = [];

    for (const item of order.products ?? []) {
      const local = byRemoteId.get(String(item.variant_id ?? ""));
      if (!local) {
        missing.push(item.sku || String(item.variant_id ?? "sin-id"));
        continue;
      }
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const lineGross = money(item.price) * quantity;
      const proportionalDiscount = grossTotal > 0 ? orderDiscount * (lineGross / grossTotal) : 0;
      items.push({
        product_id: local.product_id,
        variant_id: local.id,
        quantity,
        unit_price: money(item.price),
        discount: Math.round(proportionalDiscount * 100) / 100,
      });
    }

    if (missing.length) throw new Error(`Variantes sin vincular: ${missing.join(", ")}`);
    if (!items.length) throw new Error("No se pudo construir el pedido local");

    const customerName = order.customer?.name || order.shipping_address?.name || "Cliente Tiendanube";
    const payloadForRpc = {
      customer_id: null,
      customer_name: customerName,
      customer_email: order.contact_email ?? null,
      customer_phone: order.contact_phone ?? null,
      shipping_address: addressText(order.shipping_address),
      channel: "TIENDANUBE",
      shipping_method: order.shipping_option || order.shipping || null,
      shipping_charge: money(order.shipping_cost_customer),
      shipping_cost_actual: money(order.shipping_cost_owner),
      payment_method: order.gateway_name || order.gateway || null,
      payment_status: order.payment_status === "paid" ? "PAGADO" : "PENDIENTE",
      status: "CONFIRMADO",
      notes: [`Tiendanube #${order.number ?? order.id}`, order.note, order.owner_note].filter(Boolean).join(" · ") || null,
      items,
    };

    const { data: localOrderId, error: createError } = await supabase.rpc("create_manual_order", { p_payload: payloadForRpc });
    if (createError) throw new Error(createError.message);

    await supabase.from("tiendanube_order_links").upsert({
      store_id: storeId,
      tiendanube_order_id: orderId,
      local_order_id: String(localOrderId),
      status: "PROCESSED",
      last_event: event,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,tiendanube_order_id" });

    await syncTiendanubeStock().catch((error) => console.error("[Tiendanube webhook] sync stock:", error));
    return NextResponse.json({ ok: true, localOrderId: String(localOrderId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando pedido";
    await supabase.from("tiendanube_order_links").upsert({
      store_id: storeId,
      tiendanube_order_id: orderId,
      local_order_id: previous?.local_order_id ?? null,
      status: "ERROR",
      last_event: event,
      last_error: message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id,tiendanube_order_id" });
    console.error("[Tiendanube webhook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
