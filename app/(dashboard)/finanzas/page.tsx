import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";

type MercadoPagoStatus = { account_user_id: string; connected_at: string; expires_at: string | null };

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  const { mp } = await searchParams;
  const profile = await getCurrentProfile();

  if (profile?.role !== "ADMIN") {
    return <main className="pt-page"><div className="mx-auto mt-12 max-w-lg rounded-[24px] border border-[#efd8e2] bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f6] text-[#ad416f]"><Icon name="finance" className="h-6 w-6" /></div><h1 className="mt-4 text-xl font-black text-[#3e2833]">Finanzas protegidas</h1><p className="mt-2 text-sm leading-6 text-[#80616f]">Esta sección está disponible únicamente para administradores.</p></div></main>;
  }

  const supabase = await createClient();
  const [stockResult, purchasesResult, paidOrdersResult, mpResult] = await Promise.all([
    supabase.from("product_stock_overview").select("id,name,base_unit,available_base,minimum_stock,current_cost,inventory_mode,active").eq("active", true).order("name"),
    supabase.from("purchases").select("id,total,status,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id,total,status,payment_status,created_at").eq("payment_status", "PAGADO").order("created_at", { ascending: false }).limit(200),
    supabase.rpc("get_mercadopago_connection_status").maybeSingle(),
  ]);

  const products = stockResult.data ?? [];
  const replenishment = products
    .filter((product) => product.inventory_mode !== "DERIVADO" && Number(product.minimum_stock ?? 0) > Number(product.available_base ?? 0))
    .map((product) => {
      const shortage = Math.max(0, Number(product.minimum_stock ?? 0) - Number(product.available_base ?? 0));
      return { ...product, shortage, estimated: shortage * Number(product.current_cost ?? 0) };
    })
    .sort((a, b) => b.estimated - a.estimated);

  const estimatedRestock = replenishment.reduce((sum, product) => sum + product.estimated, 0);
  const paidSales = (paidOrdersResult.data ?? []).filter((order) => order.status !== "CANCELADO").reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const receivedPurchases = (purchasesResult.data ?? []).filter((purchase) => purchase.status === "RECIBIDA").reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0);
  const mpConnection = mpResult.error ? null : (mpResult.data as MercadoPagoStatus | null);
  const mpConfigured = Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET);

  return <main className="pt-page">
    <PageHeader eyebrow="Control privado" title="Finanzas" description="Caja, obligaciones próximas y conexión con Mercado Pago. Solo visible para ADMIN." />

    {mp && <MpNotice state={mp} />}

    <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Ventas pagadas" value={formatMoney(paidSales)} detail="historial cargado" />
      <Metric label="Compras recibidas" value={formatMoney(receivedPurchases)} detail="historial cargado" />
      <Metric label="Reposición estimada" value={formatMoney(estimatedRestock)} detail={`${replenishment.length} productos bajo mínimo`} danger={replenishment.length > 0} />
      <Metric label="Caja disponible" value="Pendiente" detail="se completa con cuentas conectadas" muted />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <div className="pt-card overflow-hidden">
        <div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Mercado Pago</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Cuenta financiera</h2><p className="mt-1 text-sm leading-6 text-[#80616f]">Primer paso: autorizar la cuenta de forma segura. Los tokens quedan únicamente del lado servidor.</p></div>
        <div className="p-5">
          {mpConnection ? <div className="rounded-2xl border border-[#cfe8db] bg-[#f5fbf8] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f5eb] text-[#36785b]"><Icon name="check" className="h-5 w-5" /></span><div><p className="font-black text-[#315e4a]">Mercado Pago conectado</p><p className="mt-1 text-xs leading-5 text-[#5d7d6e]">Cuenta {mpConnection.account_user_id} · conectada {formatDateTime(mpConnection.connected_at)}</p>{mpConnection.expires_at && <p className="text-xs text-[#5d7d6e]">Token vigente hasta {formatDateTime(mpConnection.expires_at)}</p>}</div></div></div> : <div className="rounded-2xl border border-[#f0dce6] bg-[#fffafd] p-4"><p className="font-black text-[#3e2833]">Todavía no está vinculada</p><p className="mt-1 text-sm leading-6 text-[#80616f]">Después de configurar las credenciales en Cloudflare, este botón inicia OAuth y vuelve a Finanzas sin exponer claves en el navegador.</p></div>}

          <div className="mt-4 flex flex-wrap gap-2">
            {mpConfigured ? <Link href="/api/mercadopago/connect" className="pt-button-primary inline-flex items-center gap-2 px-4"><Icon name="finance" className="h-4 w-4" />{mpConnection ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}</Link> : <span className="pt-button-secondary inline-flex cursor-default items-center px-4 opacity-70">Faltan credenciales de Mercado Pago</span>}
          </div>

          <div className="mt-4 rounded-xl bg-[#fff5f9] p-3 text-xs leading-5 text-[#80616f]">
            Esta versión <strong>no inventa un saldo</strong>: deja lista la conexión OAuth. La lectura y conciliación de “Dinero en cuenta” se agrega en la siguiente etapa usando los reportes financieros de Mercado Pago.
          </div>
        </div>
      </div>

      <div className="pt-card overflow-hidden">
        <div className="border-b border-[#f2e0e8] px-5 py-4"><p className="pt-section-title">Comprar pronto</p><h2 className="mt-1 text-lg font-black text-[#3e2833]">Necesidad de reposición</h2><p className="mt-1 text-sm text-[#80616f]">Estimación con stock mínimo y costo actual cargado.</p></div>
        {replenishment.length === 0 ? <div className="p-6 text-sm text-[#80616f]">No hay productos por debajo de su stock mínimo.</div> : <div className="divide-y divide-[#f5e7ed]">{replenishment.slice(0, 10).map((product) => <Link key={product.id} href={`/productos/${product.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#fffafd]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#3e2833]">{product.name}</p><p className="mt-0.5 text-xs text-[#987b88]">Faltan {formatQuantity(product.shortage)} {product.base_unit === "g" ? "g" : "u"} para llegar al mínimo</p></div><div className="shrink-0 text-right"><p className="text-xs font-black text-[#ad416f]">{product.estimated > 0 ? formatMoney(product.estimated) : "Sin costo"}</p><p className="text-[9px] uppercase tracking-wide text-[#9a7a88]">estimado</p></div></Link>)}</div>}
      </div>
    </section>

    <section className="mt-4 rounded-[20px] border border-[#ecdce4] bg-gradient-to-br from-white to-[#fff5f9] p-5"><p className="pt-section-title">Próxima etapa</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Future title="Caja real" text="Mercado Pago + efectivo + otras cuentas." /><Future title="Disponible para gastar" text="Caja menos compras comprometidas y reservas." /><Future title="Proyección" text="Reposición, ventas y costos esperados." /></div></section>
  </main>;
}

function MpNotice({ state }: { state: string }) {
  const map: Record<string, [string, string]> = {
    connected: ["Mercado Pago conectado correctamente.", "ok"],
    error: ["Mercado Pago devolvió un error al conectar. Revisá configuración y logs.", "error"],
    state_error: ["La validación de seguridad OAuth falló. Volvé a iniciar la conexión.", "error"],
    config: ["Faltan variables de Mercado Pago en el servidor.", "error"],
  };
  const value = map[state];
  if (!value) return null;
  return <div className={`mb-4 rounded-2xl border p-3 text-sm font-bold ${value[1] === "ok" ? "border-[#cfe8db] bg-[#f5fbf8] text-[#36785b]" : "border-[#efc4ce] bg-[#fff7f8] text-[#a94658]"}`}>{value[0]}</div>;
}

function Metric({ label, value, detail, danger, muted }: { label: string; value: string; detail: string; danger?: boolean; muted?: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? "border-[#efc3cc] bg-[#fff8f9]" : "border-[#efd8e2] bg-white"}`}><p className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#917380]">{label}</p><p className={`mt-1.5 text-xl font-black sm:text-2xl ${danger ? "text-[#aa4558]" : muted ? "text-[#927681]" : "text-[#3e2833]"}`}>{value}</p><p className="mt-0.5 text-[11px] text-[#987b88]">{detail}</p></div>; }
function Future({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-[#f0dce6] bg-white/90 p-4"><p className="text-sm font-black text-[#3e2833]">{title}</p><p className="mt-1 text-xs leading-5 text-[#80616f]">{text}</p></div>; }
