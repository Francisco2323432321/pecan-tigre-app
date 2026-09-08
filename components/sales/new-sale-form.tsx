"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createManualSale } from "@/app/(dashboard)/ventas/nueva/actions";
import { formatMoney, formatQuantity } from "@/lib/format";
import ProductImage from "@/components/ui/product-image";
import { Icon } from "@/components/ui/icons";

type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null };
type RecipeItem = { ingredient_product_id: string; ingredient_name: string; ingredient_unit: string; quantity_base: number };
type Product = {
  id: string;
  name: string;
  base_unit: string;
  current_cost: number;
  image_url: string | null;
  available_base: number;
  product_kind: string;
  inventory_mode: string;
  variant: { id: string; name: string; sku: string | null; base_quantity: number; price: number; promo_price: number | null };
  recipe: { output_quantity_base: number; items: RecipeItem[] } | null;
};
type Line = { id: number; product_id: string; quantity: string; unit_price: string; discount: string };

export default function NewSaleForm({ customers, products }: { customers: Customer[]; products: Product[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [channel, setChannel] = useState("MANUAL");
  const [shippingMethod, setShippingMethod] = useState("");
  const [shippingCharge, setShippingCharge] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("PENDIENTE");
  const [status, setStatus] = useState("CONFIRMADO");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ id: 1, product_id: "", quantity: "1", unit_price: "", discount: "" }]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerNameFinal = selectedCustomer?.name || customerName;
  const customerEmailFinal = selectedCustomer?.email || email || null;
  const customerPhoneFinal = selectedCustomer?.phone || phone || null;
  const addressFinal = selectedCustomer?.address || address || null;

  const preparedLines = useMemo(() => lines.flatMap((line) => {
    const product = products.find((p) => p.id === line.product_id);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) return [];
    const price = Number(line.unit_price || product.variant.promo_price || product.variant.price || 0);
    const discount = Number(line.discount || 0);
    return [{ line, product, quantity, price, discount }];
  }), [lines, products]);

  const calc = useMemo(() => {
    let subtotal = 0;
    let cost = 0;
    for (const item of preparedLines) {
      subtotal += Math.max(0, item.price * item.quantity - item.discount);
      cost += item.product.current_cost * item.product.variant.base_quantity * item.quantity;
    }
    const shipCharge = Number(shippingCharge || 0);
    const shipCost = Number(shippingCost || 0);
    const total = subtotal + shipCharge;
    const totalCost = cost + shipCost;
    const profit = total - totalCost;
    const margin = total > 0 ? (profit / total) * 100 : 0;
    return { subtotal, total, totalCost, profit, margin };
  }, [preparedLines, shippingCharge, shippingCost]);

  const preparation = useMemo(() => {
    const totals = new Map<string, { name: string; quantity: number; unit: string }>();
    for (const item of preparedLines) {
      const baseTotal = item.product.variant.base_quantity * item.quantity;
      if (item.product.inventory_mode === "DERIVADO" && item.product.recipe?.items.length) {
        const factor = baseTotal / item.product.recipe.output_quantity_base;
        for (const ingredient of item.product.recipe.items) {
          const current = totals.get(ingredient.ingredient_product_id) ?? { name: ingredient.ingredient_name, quantity: 0, unit: ingredient.ingredient_unit };
          current.quantity += ingredient.quantity_base * factor;
          totals.set(ingredient.ingredient_product_id, current);
        }
      } else {
        const current = totals.get(item.product.id) ?? { name: item.product.name, quantity: 0, unit: item.product.base_unit };
        current.quantity += baseTotal;
        totals.set(item.product.id, current);
      }
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [preparedLines]);

  function patch(id: number, partial: Partial<Line>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...partial } : line));
  }

  function chooseProduct(id: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    patch(id, { product_id: productId, unit_price: product ? String(product.variant.promo_price ?? product.variant.price ?? 0) : "" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !customerNameFinal || preparedLines.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        customer_id: customerId || null,
        customer_name: customerNameFinal,
        customer_email: customerEmailFinal,
        customer_phone: customerPhoneFinal,
        shipping_address: addressFinal,
        channel,
        shipping_method: shippingMethod || null,
        shipping_charge: Number(shippingCharge || 0),
        shipping_cost_actual: Number(shippingCost || 0),
        payment_method: paymentMethod || null,
        payment_status: paymentStatus,
        status,
        notes: notes || null,
        idempotency_key: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        items: preparedLines.map(({ line, product, quantity, price, discount }) => ({
          product_id: product.id,
          variant_id: product.variant.id,
          quantity,
          unit_price: price,
          discount,
        })),
      };
      const result = await createManualSale(payload);
      if (!result.ok || !result.id) {
        setError(result.message || "No se pudo crear la venta.");
        return;
      }
      setSuccess(true);
      window.setTimeout(() => router.push(`/ventas/${result.id}`), 450);
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_.7fr]">
    <div className="min-w-0 space-y-4">
      <section className="pt-card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-bold text-[#3e2833]">Cliente</h2><span className="text-[10px] font-bold uppercase text-[#a83f6d]">Venta manual</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Cliente guardado"><select className="pt-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Nuevo / sin guardar</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          {!customerId && <Field label="Nombre"><input className="pt-input" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>}
          {!customerId && <><Field label="Teléfono"><input className="pt-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field><Field label="Email"><input type="email" className="pt-input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><div className="sm:col-span-2"><Field label="Dirección"><input className="pt-input" value={address} onChange={(e) => setAddress(e.target.value)} /></Field></div></>}
        </div>
      </section>

      <section className="pt-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f2e0e8] p-4 sm:px-5"><div><h2 className="font-bold text-[#3e2833]">Productos</h2><p className="mt-0.5 text-xs text-[#896b78]">La presentación se toma automáticamente del producto.</p></div><button type="button" onClick={() => setLines((v) => [...v, { id: Date.now(), product_id: "", quantity: "1", unit_price: "", discount: "" }])} className="pt-button-secondary inline-flex items-center gap-1 px-3 text-xs"><Icon name="plus" className="h-4 w-4" />Producto</button></div>
        <div className="space-y-3 p-4 sm:p-5">{lines.map((line, index) => {
          const product = products.find((p) => p.id === line.product_id);
          const quantity = Number(line.quantity || 0);
          const available = product ? Math.floor(product.available_base / product.variant.base_quantity) : 0;
          return <div key={line.id} className="rounded-2xl border border-[#f0dce5] bg-[#fffafd] p-3">
            <div className="flex gap-3"><ProductImage src={product?.image_url} alt={product?.name || "Producto"} size="sm" /><div className="min-w-0 flex-1"><Field label={`Producto ${index + 1}`}><select className="pt-input" value={line.product_id} onChange={(e) => chooseProduct(line.id, e.target.value)} required><option value="">Elegir…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>{product && <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-[#fff0f6] px-2.5 py-1 font-black text-[#a83f6d]">{product.base_unit === "g" ? "100 g" : "Unidad"}</span><span className="font-bold text-[#80616f]">{product.variant.sku || "Sin SKU"}</span></div>}</div></div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Cantidad"><input className="pt-input" inputMode="numeric" type="number" min="1" step="1" value={line.quantity} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patch(line.id, { quantity: e.target.value })} onBlur={() => { if (!line.quantity || Number(line.quantity) < 1) patch(line.id, { quantity: "1" }); }} /></Field>
              <Field label="Precio unitario"><input className="pt-input" type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => patch(line.id, { unit_price: e.target.value })} /></Field>
              <Field label="Descuento línea"><input className="pt-input" type="number" min="0" step="0.01" value={line.discount} onChange={(e) => patch(line.id, { discount: e.target.value })} /></Field>
              <div className="flex items-end justify-between gap-2"><div className="pb-2"><p className="text-[9px] font-bold uppercase text-[#9a7a88]">Disponible</p><p className="text-sm font-extrabold text-[#4d2938]">{product ? `${available} un.` : "—"}</p></div>{lines.length > 1 && <button type="button" onClick={() => setLines((v) => v.filter((x) => x.id !== line.id))} className="h-10 rounded-xl bg-[#fff0f2] px-3 text-xs font-bold text-[#aa4558]">Quitar</button>}</div>
            </div>
            {product?.recipe && product.recipe.items.length > 0 && quantity > 0 && <div className="mt-3 rounded-xl border border-[#eee1f2] bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wide text-[#8b6f95]">Composición para {formatQuantity(product.variant.base_quantity * quantity)} {product.base_unit}</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{product.recipe.items.map((ri) => { const factor = (product.variant.base_quantity * quantity) / product.recipe!.output_quantity_base; return <div key={ri.ingredient_product_id} className="flex justify-between gap-3 text-xs"><span className="text-[#66566f]">{ri.ingredient_name}</span><strong className="text-[#3e2833]">{formatQuantity(ri.quantity_base * factor)} {ri.ingredient_unit}</strong></div>; })}</div></div>}
            {product && ["MIX", "COMBO", "ELABORADO"].includes(product.product_kind) && (!product.recipe || product.recipe.items.length === 0) && <div className="mt-3 rounded-xl border border-[#efd2ae] bg-[#fffaf2] p-3 text-xs font-bold text-[#8a6336]">⚠ Receta sin configurar. No se puede previsualizar su composición.</div>}
          </div>;
        })}</div>
      </section>

      <section className="pt-card overflow-hidden">
        <div className="border-b border-[#f2e0e8] px-4 py-4 sm:px-5"><p className="pt-section-title">Previsualización interna</p><h2 className="mt-1 font-black text-[#3e2833]">Resumen del pedido</h2><p className="mt-0.5 text-xs text-[#896b78]">Es para control interno; no es el remito del cliente.</p></div>
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <div><p className="text-[10px] font-black uppercase tracking-wide text-[#9a7a88]">Cliente</p><p className="mt-1 font-black text-[#3e2833]">{customerNameFinal || "Sin cliente"}</p><p className="mt-1 text-xs leading-5 text-[#80616f]">{customerPhoneFinal || "Sin teléfono"}{addressFinal ? ` · ${addressFinal}` : ""}</p><div className="mt-4 space-y-2">{preparedLines.map((item) => <div key={item.line.id} className="flex justify-between gap-3 rounded-xl bg-[#fffafd] px-3 py-2 text-xs"><span><strong>{item.quantity}×</strong> {item.product.name} <span className="text-[#9a7a88]">({item.product.base_unit === "g" ? `${formatQuantity(item.product.variant.base_quantity * item.quantity)} g` : `${formatQuantity(item.product.variant.base_quantity * item.quantity)} u`})</span></span><strong>{formatMoney(Math.max(0, item.price * item.quantity - item.discount))}</strong></div>)}</div></div>
          <div><p className="text-[10px] font-black uppercase tracking-wide text-[#9a7a88]">Total necesario para preparar</p><div className="mt-2 space-y-2">{preparation.length ? preparation.map((item) => <div key={`${item.name}-${item.unit}`} className="flex justify-between gap-3 rounded-xl bg-[#f7f3fb] px-3 py-2 text-xs"><span className="font-bold text-[#5d4e66]">{item.name}</span><strong className="text-[#3e2833]">{formatQuantity(item.quantity)} {item.unit === "g" ? "g" : "u"}</strong></div>) : <p className="text-xs text-[#8b7580]">Agregá productos para ver la preparación.</p>}</div></div>
        </div>
      </section>
    </div>

    <aside className="min-w-0 space-y-4">
      <section className="pt-card p-4 sm:p-5"><h2 className="font-bold text-[#3e2833]">Pedido y pago</h2><div className="mt-4 space-y-3"><Field label="Canal"><select className="pt-input" value={channel} onChange={(e) => setChannel(e.target.value)}><option>MANUAL</option><option>WHATSAPP</option><option>INSTAGRAM</option><option>LOCAL</option></select></Field><Field label="Estado"><select className="pt-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="NUEVO">Pendiente</option><option value="CONFIRMADO">Confirmado (reserva stock)</option></select></Field><Field label="Medio de pago"><input className="pt-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Transferencia, efectivo…" /></Field><Field label="Estado de pago"><select className="pt-input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="PENDIENTE">Pendiente</option><option value="PAGADO">Pagado</option></select></Field><Field label="Forma de entrega"><input className="pt-input" value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Envío cobrado"><input className="pt-input" type="number" min="0" value={shippingCharge} onChange={(e) => setShippingCharge(e.target.value)} /></Field><Field label="Costo real envío"><input className="pt-input" type="number" min="0" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} /></Field></div><Field label="Observaciones"><textarea className="pt-input min-h-20 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div></section>
      <section className="pt-card p-4 sm:p-5"><h2 className="font-bold text-[#3e2833]">Resumen</h2><div className="mt-4 space-y-2 text-sm"><Row k="Subtotal" v={formatMoney(calc.subtotal)} /><Row k="Envío cliente" v={formatMoney(Number(shippingCharge || 0))} /><Row k="Total" v={formatMoney(calc.total)} strong /><div className="my-3 border-t border-[#f0dce5]" /><Row k="Costo estimado" v={formatMoney(calc.totalCost)} /><Row k="Ganancia" v={formatMoney(calc.profit)} /><Row k="Margen" v={`${calc.margin.toFixed(1)}%`} /></div><button type="submit" disabled={!customerNameFinal || preparedLines.length === 0 || saving || success} className="pt-button-primary mt-5 flex w-full items-center justify-center gap-2 px-4">{success ? <><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">✓</span> Venta creada</> : saving ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Creando…</> : "Crear venta"}</button>{error && <div className="mt-3 rounded-xl border border-[#efc3cc] bg-[#fff8f9] p-3 text-xs font-bold text-[#a54558]">{error}</div>}<button type="button" onClick={() => router.back()} className="pt-button-secondary mt-2 flex w-full items-center justify-center px-4 text-sm">Cancelar</button></section>
    </aside>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="pt-label">{label}</span>{children}</label>; }
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="text-[#8d6878]">{k}</span><strong className={strong ? "text-lg text-[#a83f6d]" : "text-[#4d2938]"}>{v}</strong></div>; }
