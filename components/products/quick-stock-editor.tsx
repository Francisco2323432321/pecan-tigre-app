"use client";

import { useMemo, useState } from "react";
import { applyQuickStock } from "@/app/(dashboard)/productos/actions";
import { formatQuantity } from "@/lib/format";
import { Icon } from "@/components/ui/icons";

type Item = {
  id: string;
  name: string;
  code: string | null;
  base_unit: string;
  on_hand: number;
  available_base: number;
  inventory_mode: string;
  image_url: string | null;
};

export default function QuickStockEditor({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () => items.filter((item) => `${item.name} ${item.code ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  );

  const changed = items.filter((item) => {
    const value = values[item.id];
    return value !== undefined && value !== "" && Number(value) !== item.on_hand;
  });

  function setExact(id: string, value: number) {
    setValues((previous) => ({ ...previous, [id]: String(Math.max(0, Math.round(value))) }));
  }

  function clearChanged() {
    setValues({});
  }

  async function submit(formData: FormData) {
    setSaving(true);
    try {
      formData.set("items_json", JSON.stringify(changed.map((item) => ({
        product_id: item.id,
        counted_quantity: Number(values[item.id]),
      }))));
      await applyQuickStock(formData);
      setValues({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="pt-card overflow-hidden">
        <div className="border-b border-[#f0dce5] bg-white/70 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9f8490]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="pt-input pl-10" placeholder="Buscar producto…" />
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="rounded-full bg-[#fff1f7] px-3 py-2 text-[11px] font-black text-[#a53f6c]">{visible.length} productos</span>
              {changed.length > 0 && <button type="button" onClick={clearChanged} className="pt-button-ghost min-h-9 rounded-xl px-3 text-xs">Descartar</button>}
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 p-3 sm:p-4 lg:grid-cols-2">
          {visible.map((item) => {
            const raw = values[item.id];
            const counted = raw === undefined || raw === "" ? null : Number(raw);
            const difference = counted === null ? null : counted - item.on_hand;
            const changedItem = difference !== null && difference !== 0;
            const unit = item.base_unit === "g" ? "g" : "u";
            const step = item.base_unit === "g" ? 100 : 1;
            return (
              <div key={item.id} className={`rounded-[19px] border p-3.5 transition ${changedItem ? "border-[#dfa9c0] bg-[#fff7fa] shadow-[0_8px_20px_rgba(85,42,61,.055)]" : "border-[#efdae4] bg-white hover:border-[#e7c3d2]"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] border border-[#f0dce5] bg-[#fff3f8]">
                    {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#bf527e]"><Icon name="package" className="h-5 w-5" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-black tracking-[-.012em] text-[#3d2932]">{item.name}</p>
                      {changedItem && <span className="h-2 w-2 shrink-0 rounded-full bg-[#c94f80]" title="Modificado" />}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-[#9c818d]">{item.code || "Sin código"} · disponible {formatQuantity(item.available_base)} {unit}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${item.base_unit === "g" ? "bg-[#fff0f6] text-[#a53f6c]" : "bg-[#f0f3ff] text-[#526aa6]"}`}>
                    {item.base_unit === "g" ? "100 G" : "UNIDAD"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <button type="button" onClick={() => setExact(item.id, (counted ?? item.on_hand) - step)} className="pt-button-secondary flex h-11 min-h-0 w-11 items-center justify-center rounded-[13px] text-lg" aria-label={`Restar ${step} a ${item.name}`}>−</button>
                  <label className="relative">
                    <span className="sr-only">Stock físico real de {item.name}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="pt-input h-11 min-h-11 text-center text-[16px] font-black tracking-[-.02em]"
                      value={raw ?? ""}
                      onChange={(event) => setValues((previous) => ({ ...previous, [item.id]: event.target.value }))}
                      placeholder={String(item.on_hand)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-[#a88d98]">{unit}</span>
                  </label>
                  <button type="button" onClick={() => setExact(item.id, (counted ?? item.on_hand) + step)} className="pt-button-secondary flex h-11 min-h-0 w-11 items-center justify-center rounded-[13px] text-lg" aria-label={`Sumar ${step} a ${item.name}`}>+</button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[10px] font-semibold text-[#987d89]">Sistema: <strong className="text-[#624a55]">{formatQuantity(item.on_hand)} {unit}</strong></p>
                  <p className={`text-[10px] font-black ${difference === null || difference === 0 ? "text-[#9a808b]" : difference > 0 ? "text-[#34795d]" : "text-[#ad465a]"}`}>
                    {difference === null ? "Sin cambios" : difference === 0 ? "Sin cambios" : `${difference > 0 ? "+" : ""}${formatQuantity(difference)} ${unit}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="pt-card h-fit overflow-hidden xl:sticky xl:top-6">
        <div className="bg-gradient-to-br from-[#4b2d3a] to-[#6a354d] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">Cambios pendientes</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-4xl font-black tracking-[-0.05em]">{changed.length}</p>
            <span className="mb-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black">{changed.length === 1 ? "producto" : "productos"}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/65">Revisá y aplicá todos los ajustes de una vez.</p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <input type="hidden" name="items_json" />
          <label className="block">
            <span className="pt-label">Nota del ajuste</span>
            <input name="notes" className="pt-input" defaultValue="Edición rápida de stock" />
          </label>
          <button disabled={changed.length === 0 || saving} className="pt-button-primary flex w-full items-center gap-2 px-4">
            <Icon name={saving ? "refresh" : "check"} className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Guardando…" : "Aplicar y sincronizar"}
          </button>
        </form>
        <div className="border-t border-[#f0dce5] bg-[#fffafd] px-4 py-3">
          <p className="text-[10px] font-semibold leading-4 text-[#917681]">Cada corrección genera un movimiento de inventario y luego intenta actualizar Tiendanube automáticamente.</p>
        </div>
      </aside>
    </div>
  );
}
