"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { formatQuantity } from "@/lib/format";
import StockAdjustmentButton from "./stock-adjustment-button";

type StockItem = {
  id: string;
  name: string;
  code: string | null;
  product_kind: string;
  inventory_mode: string;
  base_unit: string;
  on_hand: number | string | null;
  reserved: number | string | null;
  available_base: number | string | null;
  minimum_stock: number | string | null;
  active: boolean;
};

const filters = [
  ["TODOS", "Todos"],
  ["CRITICO", "Crítico"],
  ["RESERVADO", "Reservado"],
  ["INSUMO", "Materia prima"],
  ["DERIVADO", "Derivados"],
] as const;

export default function StockList({ items }: { items: StockItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("TODOS");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return items.filter((item) => {
      if (q && !`${item.name} ${item.code ?? ""}`.toLocaleLowerCase("es").includes(q)) return false;
      if (filter === "CRITICO") return item.inventory_mode !== "DERIVADO" && Number(item.minimum_stock) > 0 && Number(item.available_base) <= Number(item.minimum_stock);
      if (filter === "RESERVADO") return Number(item.reserved) > 0;
      if (filter === "INSUMO") return item.product_kind === "INSUMO";
      if (filter === "DERIVADO") return item.inventory_mode === "DERIVADO";
      return true;
    });
  }, [items, query, filter]);

  return <section className="pt-card overflow-hidden">
    <div className="border-b border-[#f2e0e8] p-3 sm:p-4">
      <div className="relative"><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a58a96]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="pt-input pl-9" placeholder="Buscar producto o código…" /></div>
      <div className="pt-scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-0.5">{filters.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === key ? "bg-[#d65f91] text-white" : "bg-[#fff1f7] text-[#895f72]"}`}>{label}</button>)}</div>
    </div>

    {filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#80616f]">No hay productos que coincidan con el filtro.</div> : <div className="divide-y divide-[#f5e7ed]">{filtered.map((item) => <StockRow key={item.id} item={item} />)}</div>}
  </section>;
}

function StockRow({ item }: { item: StockItem }) {
  const critical = item.inventory_mode !== "DERIVADO" && Number(item.minimum_stock) > 0 && Number(item.available_base) <= Number(item.minimum_stock);
  const derived = item.inventory_mode === "DERIVADO";
  return <div className="p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <Link href={`/productos/${item.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-[#3e2833]">{item.name}</p>{critical && <span className="rounded-full bg-[#fbecef] px-2 py-0.5 text-[10px] font-extrabold text-[#aa4558]">CRÍTICO</span>}{derived && <span className="rounded-full bg-[#f4edf8] px-2 py-0.5 text-[10px] font-extrabold text-[#725696]">RECETA</span>}</div>
        <p className="mt-0.5 text-xs text-[#987b88]">{item.code || "Sin código"} · {kindLabel(item.product_kind)}</p>
      </Link>
      {!derived && <StockAdjustmentButton productId={item.id} productName={item.name} unit={item.base_unit} current={Number(item.on_hand ?? 0)} />}
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2">
      <Value label="Físico" value={derived ? "—" : `${formatQuantity(item.on_hand)} ${item.base_unit}`} />
      <Value label="Reservado" value={derived ? "—" : `${formatQuantity(item.reserved)} ${item.base_unit}`} />
      <Value label="Disponible" value={`${formatQuantity(item.available_base)} ${item.base_unit}`} strong critical={critical} />
    </div>
  </div>;
}

function Value({ label, value, strong, critical }: { label: string; value: string; strong?: boolean; critical?: boolean }) {
  return <div className="rounded-xl bg-[#fffafd] px-2.5 py-2.5 sm:px-3"><p className="text-[9px] font-bold uppercase tracking-wide text-[#a18692]">{label}</p><p className={`mt-0.5 truncate text-sm font-extrabold ${critical ? "text-[#aa4558]" : strong ? "text-[#ad416f]" : "text-[#4a303b]"}`}>{value}</p></div>;
}

function kindLabel(kind: string) {
  return ({ INSUMO: "Materia prima", MIX: "Mix", ELABORADO: "Elaborado", COMBO: "Combo" } as Record<string, string>)[kind] ?? kind;
}
