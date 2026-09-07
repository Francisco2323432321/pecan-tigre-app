import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import PageHeader from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";

type MercadoPagoStatus = {
  account_user_id: string;
  connected_at: string;
  expires_at: string | null;
};

function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  const { mp } = await searchParams;
  const profile = await getCurrentProfile();

  if (profile?.role !== "ADMIN") {
    return (
      <main className="pt-page">
        <div className="mx-auto mt-12 max-w-lg rounded-[28px] border border-[#ece3ef] bg-white/85 p-8 text-center shadow-[0_18px_44px_rgba(38,23,46,.06)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f4efff] text-[#6d5cff]">
            <Icon name="finance" className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#2f2438]">Finanzas protegidas</h1>
          <p className="mt-2 text-sm leading-6 text-[#766b81]">
            Esta sección está disponible únicamente para administradores.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const [stockResult, purchasesResult, paidOrdersResult, mpResult] = await Promise.all([
    supabase
      .from("product_stock_overview")
      .select("id,name,base_unit,available_base,minimum_stock,current_cost,inventory_mode,active")
      .eq("active", true)
      .order("name"),
    supabase.from("purchases").select("id,total,status,created_at").order("created_at", { ascending: false }).limit(120),
    supabase
      .from("orders")
      .select("id,total,status,payment_status,created_at")
      .eq("payment_status", "PAGADO")
      .order("created_at", { ascending: false })
      .limit(240),
    supabase.rpc("get_mercadopago_connection_status").maybeSingle(),
  ]);

  const products = stockResult.data ?? [];
  const paidOrders = (paidOrdersResult.data ?? []).filter((order) => order.status !== "CANCELADO");
  const purchases = purchasesResult.data ?? [];

  const replenishment = products
    .filter((product) => product.inventory_mode !== "DERIVADO" && Number(product.minimum_stock ?? 0) > Number(product.available_base ?? 0))
    .map((product) => {
      const shortage = Math.max(0, Number(product.minimum_stock ?? 0) - Number(product.available_base ?? 0));
      return { ...product, shortage, estimated: shortage * Number(product.current_cost ?? 0) };
    })
    .sort((a, b) => b.estimated - a.estimated);

  const estimatedRestock = replenishment.reduce((sum, product) => sum + product.estimated, 0);
  const paidSales = paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const receivedPurchases = purchases
    .filter((purchase) => purchase.status === "RECIBIDA")
    .reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0);

  const monthSales = Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (7 - index));
    const key = date.toISOString().slice(0, 10);
    const total = paidOrders
      .filter((order) => (order.created_at ?? "").slice(0, 10) === key)
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    return { key, label: shortDateLabel(date.toISOString()), total };
  });

  const monthExpenses = Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (7 - index));
    const key = date.toISOString().slice(0, 10);
    const total = purchases
      .filter((purchase) => purchase.status === "RECIBIDA" && (purchase.created_at ?? "").slice(0, 10) === key)
      .reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0);
    return { key, label: shortDateLabel(date.toISOString()), total };
  });

  const maxFlow = Math.max(
    ...monthSales.map((item) => item.total),
    ...monthExpenses.map((item) => item.total),
    1,
  );

  const grossCashProjection = paidSales - receivedPurchases - estimatedRestock;
  const mpConnection = mpResult.error ? null : (mpResult.data as MercadoPagoStatus | null);
  const mpConfigured = Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET);

  return (
    <main className="pt-page">
      <PageHeader
        eyebrow="Control privado"
        title="Finanzas"
        description="Caja, reposición necesaria y base para integrar Mercado Pago con una vista clara para decidir cuánto comprar y cuánto podés mover."
      />

      {mp && <MpNotice state={mp} />}

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ventas pagadas" value={formatMoney(paidSales)} detail="Historial pagado" icon="sales" />
        <Metric label="Compras recibidas" value={formatMoney(receivedPurchases)} detail="Mercadería ingresada" icon="purchases" />
        <Metric label="Reposición estimada" value={formatMoney(estimatedRestock)} detail={`${replenishment.length} productos bajo mínimo`} icon="alert" danger={replenishment.length > 0} />
        <Metric label="Proyección bruta" value={formatMoney(grossCashProjection)} detail="Ventas - compras - reposición" icon="finance" tone={grossCashProjection >= 0 ? "good" : "danger"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="pt-chart-shell overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#efe7f2] px-5 py-4">
            <div>
              <p className="pt-section-title">Flujo</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Ventas vs compras recientes</h2>
            </div>
            <span className="rounded-full bg-[#f5f1ff] px-3 py-1 text-[11px] font-bold text-[#6d5cff]">últimos 8 días</span>
          </div>

          <div className="p-5">
            <div className="grid h-[280px] grid-cols-8 items-end gap-3">
              {monthSales.map((sale, index) => {
                const expense = monthExpenses[index];
                const saleHeight = `${Math.max(8, Math.round((sale.total / maxFlow) * 100))}%`;
                const expenseHeight = `${Math.max(8, Math.round((expense.total / maxFlow) * 100))}%`;
                return (
                  <div key={sale.key} className="flex h-full flex-col justify-end gap-2">
                    <div className="flex flex-1 items-end justify-center gap-1 rounded-[18px] bg-[#f8f5fb] p-2">
                      <div className="w-full max-w-[14px] rounded-full bg-[linear-gradient(180deg,#7a6cff_0%,#5f4cff_100%)]" style={{ height: saleHeight }} />
                      <div className="w-full max-w-[14px] rounded-full bg-[linear-gradient(180deg,#ffb27a_0%,#ca4d87_100%)]" style={{ height: expenseHeight }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-black text-[#72657c]">{sale.label}</p>
                      <p className="text-[10px] text-[#968aa0]">{formatMoney(sale.total)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-[#6d6177]">
              <span className="flex items-center gap-2"><span className="pt-dot" style={{ background: "#5f4cff" }} /> Ventas pagadas</span>
              <span className="flex items-center gap-2"><span className="pt-dot" style={{ background: "#ca4d87" }} /> Compras recibidas</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="pt-chart-shell overflow-hidden">
            <div className="border-b border-[#efe7f2] px-5 py-4">
              <p className="pt-section-title">Mercado Pago</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Cuenta financiera</h2>
              <p className="mt-1 text-sm leading-6 text-[#766b81]">Primer paso seguro para vincular la cuenta y luego poder leer datos financieros reales.</p>
            </div>

            <div className="p-5">
              {mpConnection ? (
                <div className="rounded-[20px] border border-[#dcefe4] bg-[#f5fbf8] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#e7f7ee] text-[#25966b]">
                      <Icon name="check" className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-black text-[#2e6c52]">Mercado Pago conectado</p>
                      <p className="mt-1 text-xs leading-5 text-[#597c6a]">
                        Cuenta {mpConnection.account_user_id} · conectada {formatDateTime(mpConnection.connected_at)}
                      </p>
                      {mpConnection.expires_at && (
                        <p className="text-xs text-[#597c6a]">Token vigente hasta {formatDateTime(mpConnection.expires_at)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[20px] border border-[#efe7f2] bg-[#fbf8fd] p-4">
                  <p className="font-black text-[#2f2438]">Todavía no está vinculada</p>
                  <p className="mt-1 text-sm leading-6 text-[#766b81]">
                    Cuando completes las credenciales en Cloudflare, este botón inicia OAuth y vuelve a Finanzas sin exponer claves en el navegador.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {mpConfigured ? (
                  <Link href="/api/mercadopago/connect" className="pt-button-primary inline-flex items-center gap-2 px-4">
                    <Icon name="finance" className="h-4 w-4" />
                    {mpConnection ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
                  </Link>
                ) : (
                  <span className="pt-button-secondary inline-flex cursor-default items-center px-4 opacity-70">
                    Faltan credenciales de Mercado Pago
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-[18px] bg-[#f8f5fb] p-4 text-xs leading-5 text-[#766b81]">
                Esta etapa deja lista la autenticación. La próxima puede sumar lectura de saldos, conciliación y control de caja con datos reales.
              </div>
            </div>
          </div>

          <div className="pt-chart-shell overflow-hidden">
            <div className="border-b border-[#efe7f2] px-5 py-4">
              <p className="pt-section-title">Reposición</p>
              <h2 className="mt-1 text-lg font-black text-[#2c2237]">Qué conviene comprar primero</h2>
              <p className="mt-1 text-sm text-[#766b81]">Estimación basada en stock mínimo y costo actual.</p>
            </div>

            <div className="p-5">
              {replenishment.length === 0 ? (
                <p className="text-sm text-[#75697f]">No hay productos por debajo de su stock mínimo.</p>
              ) : (
                <div className="space-y-3">
                  {replenishment.slice(0, 8).map((product) => {
                    const width = estimatedRestock > 0 ? Math.max(10, Math.round((product.estimated / estimatedRestock) * 100)) : 10;
                    return (
                      <Link key={product.id} href={`/productos/${product.id}`} className="block rounded-[18px] bg-[#fbf8fd] p-3.5 transition hover:bg-white hover:shadow-[0_10px_24px_rgba(38,23,46,.05)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#2f2438]">{product.name}</p>
                            <p className="mt-1 text-[11px] text-[#8f8299]">
                              Faltan {formatQuantity(product.shortage)} {product.base_unit === "g" ? "g" : "u"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-[#ca4d87]">{product.estimated > 0 ? formatMoney(product.estimated) : "Sin costo"}</p>
                            <p className="text-[10px] text-[#8f8299]">estimado</p>
                          </div>
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-[linear-gradient(90deg,#6d5cff_0%,#ca4d87_100%)]" style={{ width: `${width}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Future title="Caja real" text="Mercado Pago + efectivo + otras cuentas para ver el saldo verdadero del negocio." />
        <Future title="Disponible para gastar" text="Caja menos compras comprometidas y necesidades próximas de reposición." />
        <Future title="Proyección" text="Ventas futuras, costos y alertas para anticiparte en vez de reaccionar tarde." />
      </section>
    </main>
  );
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

  return (
    <div
      className={`mb-4 rounded-[20px] border px-4 py-3 text-sm font-bold ${
        value[1] === "ok"
          ? "border-[#d6ece0] bg-[#f5fbf8] text-[#2f7356]"
          : "border-[#f0d2d9] bg-[#fff7f9] text-[#b14359]"
      }`}
    >
      {value[0]}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  danger,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  danger?: boolean;
  tone?: "good" | "danger";
}) {
  const accent = tone === "good" ? "text-[#25966b] bg-[#eefaf4]" : tone === "danger" ? "text-[#cf4b63] bg-[#fff1f4]" : danger ? "text-[#cf4b63] bg-[#fff1f4]" : "text-[#6d5cff] bg-[#f4efff]";

  return (
    <div className="pt-kpi-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8c8097]">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-[15px] ${accent}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className={`pt-kpi-value mt-4 ${tone === "good" ? "text-[#25966b]" : tone === "danger" || danger ? "text-[#c04961]" : "text-[#2f2438]"}`}>
        {value}
      </p>
      <p className="mt-2 text-[12px] text-[#8a7d95]">{detail}</p>
    </div>
  );
}

function Future({ title, text }: { title: string; text: string }) {
  return (
    <div className="pt-card p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#f4efff] text-[#6d5cff]">
        <Icon name="finance" className="h-5 w-5" />
      </div>
      <p className="mt-4 text-base font-black text-[#2f2438]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#766b81]">{text}</p>
    </div>
  );
}
