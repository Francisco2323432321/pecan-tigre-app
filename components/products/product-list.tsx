"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { formatMoney, formatQuantity } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  product_kind: string;
  inventory_mode: string;
  base_unit: string;
  on_hand: number | string | null;
  reserved: number | string | null;
  available_base: number | string | null;
  minimum_stock: number | string | null;
  active: boolean;
  image_url: string | null;
  category: string | null;
  visible: boolean;
  published: boolean;
  tiendanube_handle: string | null;
  sale_sku: string | null;
  sale_price: number | string | null;
  linked_variant_count: number;
  observed_variant_count: number;
};

const filterOptions = [
  ["TODOS", "Todos"],
  ["INSUMO", "Materias primas"],
  ["MIX", "Mixes"],
  ["ELABORADO", "Elaborados"],
  ["COMBO", "Combos"],
] as const;

export default function ProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterOptions)[number][0]>("TODOS");

  const filtered = useMemo(() => products.filter((product) => {
    const text = query.trim().toLowerCase();
    if (text && !`${product.name} ${product.code ?? ""} ${product.category ?? ""} ${product.sale_sku ?? ""}`.toLowerCase().includes(text)) return false;
    return filter === "TODOS" || product.product_kind === filter;
  }), [products, query, filter]);

  return <section>
    <div className="pt-toolbar mb-4 p-3 sm:p-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b818c]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="pt-input bg-white pl-10" placeholder="Buscar producto, SKU o categoría…" />
        </div>
        <div className="pt-scrollbar-none flex gap-1.5 overflow-x-auto lg:max-w-[58%]">
          {filterOptions.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`pt-segment shrink-0 ${filter === key ? "pt-segment-active" : "bg-[#fff7fa]"}`}>{label}</button>)}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-[#967b87]">
        <span>{filtered.length} de {products.length} productos</span>
        {query && <button onClick={() => setQuery("")} className="font-extrabold text-[#aa416e] hover:underline">Limpiar búsqueda</button>}
      </div>
    </div>

    {filtered.length === 0 ? <div className="pt-card p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f6] text-[#b84a78]"><Icon name="search" className="h-6 w-6" /></div><p className="mt-3 text-sm font-black text-[#46313b]">No encontramos productos</p><p className="mt-1 text-xs text-[#8e7480]">Probá con otro nombre, SKU o filtro.</p></div> : <div className="pt-product-grid">
      {filtered.map((product) => {
        const critical = product.inventory_mode !== "DERIVADO" && Number(product.minimum_stock) > 0 && Number(product.available_base) <= Number(product.minimum_stock);
        const hasMultipleTnOptions = product.observed_variant_count > 1 || product.linked_variant_count > 1;
        const unit = product.base_unit === "g" ? "g" : "u";
        const available = Number(product.available_base ?? 0);
        const salePrice = Number(product.sale_price ?? 0);
        return <Link href={`/productos/${product.id}`} key={product.id} className="group relative overflow-hidden rounded-[24px] border border-[#ecd6e0] bg-white shadow-[0_7px_22px_rgba(82,42,60,.045)] transition duration-200 hover:-translate-y-1 hover:border-[#dfaac1] hover:shadow-[0_18px_42px_rgba(82,42,60,.10)] active:translate-y-0 active:scale-[.995]">
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fff2f7] via-[#fffafd] to-[#fff5f9]">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]" loading="lazy" /> : <div className="flex h-full items-center justify-center"><div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#f2dce6] bg-white text-[#c35a86] shadow-[0_8px_20px_rgba(90,43,63,.06)]"><Icon name="package" className="h-8 w-8" /></div></div>}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#3f2934]/12 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-20px)] flex-wrap gap-1.5">
              <span className="pt-chip border border-white/70 bg-white/90 text-[#954063] shadow-sm backdrop-blur">{kindLabel(product.product_kind)}</span>
              {critical && <span className="pt-chip border border-[#f2c9d0] bg-[#fff2f3]/95 text-[#aa4558] shadow-sm">Stock bajo</span>}
              {hasMultipleTnOptions && <span className="pt-chip border border-[#eadca7] bg-[#fff9df]/95 text-[#85651f] shadow-sm">Variantes TN</span>}
            </div>
            <span className="absolute bottom-2.5 right-2.5 flex h-9 w-9 translate-y-1 items-center justify-center rounded-[13px] bg-white/92 text-[#a7406b] opacity-0 shadow-md backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">
              <Icon name="arrow" className="h-4 w-4" />
            </span>
          </div>

          <div className="p-3.5 sm:p-4">
            <div className="min-h-[58px]">
              <p className="line-clamp-2 text-[14px] font-black leading-5 tracking-[-.018em] text-[#392730] sm:text-[15px]">{product.name}</p>
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.06em] text-[#9a7d89]">{product.sale_sku || product.code || "Sin SKU"}</p>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2 border-t border-[#f4e3ea] pt-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.11em] text-[#967986]">Disponible</p>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <p className={`truncate text-[17px] font-black tracking-[-.03em] ${critical ? "text-[#ad4559]" : "text-[#a63d6a]"}`}>{formatQuantity(available)} {unit}</p>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-[#9c818d]">{product.base_unit === "g" ? `${Math.floor(available / 100)} packs de 100 g` : "venta por unidad"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-black uppercase tracking-[.11em] text-[#967986]">Precio</p>
                <p className="mt-0.5 text-[15px] font-black tracking-[-.02em] text-[#392730]">{salePrice > 0 ? formatMoney(salePrice) : "—"}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#aa8e9a]">{product.base_unit === "g" ? "por 100 g" : "por unidad"}</p>
              </div>
            </div>
          </div>
        </Link>;
      })}
    </div>}
  </section>;
}

function kindLabel(value: string) {
  return ({ INSUMO: "Materia prima", MIX: "Mix", ELABORADO: "Elaborado", COMBO: "Combo" } as Record<string, string>)[value] ?? value;
}
