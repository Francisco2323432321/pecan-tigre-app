"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { applyQuickStockChanges, type QuickStockChange } from "@/app/(dashboard)/productos/actions";
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

type Mode = "DELTA" | "SET";

export default function QuickStockEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("Stock rápido");

  const visible = useMemo(
    () => items.filter((item) => `${item.name} ${item.code ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  );

  const changes = useMemo<QuickStockChange[]>(() => {
    const result: QuickStockChange[] = [];

    for (const item of items) {
      const mode = modes[item.id] ?? "DELTA";
      const raw = values[item.id];

      if (mode === "DELTA") {
        const value = Number(raw ?? 0);
        if (Number.isFinite(value) && value !== 0) {
          result.push({ product_id: item.id, mode: "DELTA", value });
        }
        continue;
      }

      if (raw === undefined || raw.trim() === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0 && value !== item.on_hand) {
        result.push({ product_id: item.id, mode: "SET", value });
      }
    }

    return result;
  }, [items, modes, values]);

  function setMode(id: string, mode: Mode) {
    setModes((prev) => ({ ...prev, [id]: mode }));
    setValues((prev) => ({ ...prev, [id]: mode === "DELTA" ? "0" : "" }));
  }

  function bump(id: string, step: number) {
    const current = Number(values[id] ?? 0) || 0;
    setValues((prev) => ({ ...prev, [id]: String(current + step) }));
  }

  async function submit() {
    if (!changes.length || saving) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const result = await applyQuickStockChanges(changes, notes);
      if (!result.ok) {
        setError(result.message || "No se pudo actualizar el stock.");
        return;
      }
      const reset: Record<string, string> = {};
      for (const item of items) reset[item.id] = (modes[item.id] ?? "DELTA") === "DELTA" ? "0" : "";
      setValues(reset);
      setSuccess(true);
      router.refresh();
      window.setTimeout(() => setSuccess(false), 2200);
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="pt-input !pl-11" placeholder="Buscar producto…" />
            </div>
            <span className="rounded-full bg-[#fff1f7] px-3 py-2 text-[11px] font-black text-[#a53f6c]">{visible.length} productos</span>
          </div>
        </div>

        <div className="grid gap-2.5 p-3 sm:p-4 lg:grid-cols-2">
          {visible.map((item) => {
            const mode = modes[item.id] ?? "DELTA";
            const unit = item.base_unit === "g" ? "g" : "u";
            const step = item.base_unit === "g" ? 100 : 1;
            const raw = values[item.id] ?? (mode === "DELTA" ? "0" : "");
            const numeric = raw === "" ? null : Number(raw);
            const resulting = mode === "DELTA" ? item.on_hand + (numeric ?? 0) : numeric;
            const changed = mode === "DELTA" ? Number(raw || 0) !== 0 : numeric !== null && numeric !== item.on_hand;
            return (
              <div key={item.id} className={`rounded-[19px] border p-3.5 transition ${changed ? "border-[#dfa9c0] bg-[#fff7fa]" : "border-[#efdae4] bg-white"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] border border-[#f0dce5] bg-[#fff3f8]">
                    {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#bf527e]"><Icon name="package" className="h-5 w-5" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-[#3d2932]">{item.name}</p>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-[#9c818d]">{item.code || "Sin código"} · disponible {formatQuantity(item.available_base)} {unit}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 rounded-[13px] bg-[#f7f2f6] p-1 text-[10px] font-black">
                  <button type="button" onClick={() => setMode(item.id, "DELTA")} className={`rounded-[10px] px-2 py-2 ${mode === "DELTA" ? "bg-white text-[#a83f6d] shadow-sm" : "text-[#8d7480]"}`}>Sumar / restar</button>
                  <button type="button" onClick={() => setMode(item.id, "SET")} className={`rounded-[10px] px-2 py-2 ${mode === "SET" ? "bg-white text-[#5f4cff] shadow-sm" : "text-[#8d7480]"}`}>Establecer stock</button>
                </div>

                {mode === "DELTA" ? (
                  <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <button type="button" onClick={() => bump(item.id, -step)} className="pt-button-secondary flex h-11 min-h-0 w-11 items-center justify-center rounded-[13px] text-lg">−</button>
                    <label className="relative">
                      <span className="sr-only">Cantidad a sumar o restar de {item.name}</span>
                      <input type="number" step="1" className="pt-input h-11 min-h-11 text-center text-[16px] font-black" value={raw} onChange={(e) => setValues((p) => ({ ...p, [item.id]: e.target.value }))} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#a88d98]">{unit}</span>
                    </label>
                    <button type="button" onClick={() => bump(item.id, step)} className="pt-button-secondary flex h-11 min-h-0 w-11 items-center justify-center rounded-[13px] text-lg">+</button>
                  </div>
                ) : (
                  <label className="relative mt-3 block">
                    <span className="sr-only">Establecer stock de {item.name}</span>
                    <input type="number" min="0" step="1" className="pt-input h-11 min-h-11 text-center text-[16px] font-black" value={raw} onChange={(e) => setValues((p) => ({ ...p, [item.id]: e.target.value }))} placeholder="Ingresá el peso contado" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#a88d98]">{unit}</span>
                  </label>
                )}

                <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[10px] font-semibold text-[#987d89]">Actualmente en stock: <strong className="text-[#624a55]">{formatQuantity(item.on_hand)} {unit}</strong></p>
                  <p className={`text-[10px] font-black ${changed ? "text-[#34795d]" : "text-[#9a808b]"}`}>
                    {changed && resulting !== null ? `Quedará: ${formatQuantity(Math.max(0, resulting))} ${unit}` : "Sin cambios"}
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
          <p className="mt-2 text-4xl font-black tracking-[-0.05em]">{changes.length}</p>
          <p className="mt-1 text-xs leading-5 text-white/65">Los campos de ajuste vuelven a cero después de guardar.</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block"><span className="pt-label">Nota del movimiento</span><input className="pt-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button type="button" onClick={submit} disabled={changes.length === 0 || saving} className="pt-button-primary flex w-full items-center justify-center gap-2 px-4">
            <Icon name={saving ? "refresh" : "check"} className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Guardando…" : "Aplicar cambios"}
          </button>
          {success && <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#cde9da] bg-[#f1fbf6] px-3 py-3 text-sm font-black text-[#2c815d]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#36a873] text-white animate-[pt-pop_.25s_ease-out]">✓</span> Stock actualizado correctamente</div>}
          {error && <div className="rounded-2xl border border-[#efc3cc] bg-[#fff8f9] px-3 py-3 text-xs font-bold text-[#a54558]">{error}</div>}
        </div>
      </aside>
    </div>
  );
}
