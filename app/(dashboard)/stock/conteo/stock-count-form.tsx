"use client";

import { useMemo, useState } from "react";
import { applyStockCount } from "./actions";
import { formatQuantity } from "@/lib/format";
import { Icon } from "@/components/ui/icons";

type Item = { id: string; name: string; code: string | null; base_unit: string; on_hand: number; inventory_mode: string };

export default function StockCountForm({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const visible = useMemo(() => items.filter((i) => `${i.name} ${i.code ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const changed = items.filter((i) => values[i.id] !== undefined && values[i.id] !== "" && Number(values[i.id]) !== i.on_hand);

  async function submit(formData: FormData) {
    formData.set("items_json", JSON.stringify(changed.map((i) => ({ product_id: i.id, counted_quantity: Number(values[i.id]) }))));
    await applyStockCount(formData);
    setValues({});
  }

  return <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
    <section className="pt-card overflow-hidden">
      <div className="border-b border-[#f2e0e8] p-3 sm:p-4"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a58a96]"/><input value={query} onChange={(e) => setQuery(e.target.value)} className="pt-input pl-9" placeholder="Buscar producto…" /></div></div>
      <div className="divide-y divide-[#f5e7ed]">{visible.map((item) => {
        const raw = values[item.id];
        const counted = raw === undefined || raw === "" ? null : Number(raw);
        const diff = counted === null ? null : counted - item.on_hand;
        return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_110px] sm:items-center">
          <div><p className="font-bold text-[#3e2833]">{item.name}</p><p className="mt-0.5 text-xs text-[#987b88]">Sistema: {formatQuantity(item.on_hand)} {item.base_unit}</p></div>
          <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#947482]">Conteo real</span><input type="number" min="0" step="0.001" className="pt-input" value={raw ?? ""} onChange={(e) => setValues((v) => ({ ...v, [item.id]: e.target.value }))} placeholder={String(item.on_hand)} /></label>
          <div className="sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-[#947482]">Diferencia</p><p className={`mt-1 text-sm font-extrabold ${diff === null || diff === 0 ? "text-[#836573]" : diff > 0 ? "text-[#36785b]" : "text-[#aa4558]"}`}>{diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQuantity(diff)} ${item.base_unit}`}</p></div>
        </div>;
      })}</div>
    </section>

    <aside className="pt-card h-fit p-4 xl:sticky xl:top-6">
      <p className="text-xs font-bold uppercase tracking-wide text-[#b54776]">Resumen</p><p className="mt-2 text-3xl font-extrabold text-[#3e2833]">{changed.length}</p><p className="text-sm text-[#80616f]">productos con diferencia</p>
      <form action={submit} className="mt-5 space-y-3"><input type="hidden" name="items_json" /><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#80616f]">Nota del conteo</span><textarea name="notes" className="pt-input min-h-20 resize-none" placeholder="Ej. Conteo semanal jueves" /></label><button disabled={changed.length === 0} className="pt-button-primary w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50">Aplicar correcciones</button></form>
      <p className="mt-3 text-xs leading-5 text-[#947482]">Solo se modifican los productos donde el conteo real sea distinto al sistema.</p>
    </aside>
  </div>;
}
