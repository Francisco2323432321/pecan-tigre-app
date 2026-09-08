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

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const text = query.trim().toLowerCase();
        if (
          text &&
          !`${product.name} ${product.code ?? ""} ${product.category ?? ""} ${product.sale_sku ?? ""}`
            .toLowerCase()
            .includes(text)
        ) {
          return false;
        }
        return filter === "TODOS" || product.product_kind === filter;
      }),
    [products, query, filter],
  );

  return (
    <section>
      <div className="pt-toolbar mb-5 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b8eaa]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pt-input bg-white !pl-11"
              placeholder="Buscar producto, SKU o categoría…"
            />
          </div>

          <div className="pt-scrollbar-none flex gap-1.5 overflow-x-auto lg:max-w-[58%]">
            {filterOptions.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`pt-segment shrink-0 ${filter === key ? "pt-segment-active" : "bg-white/70"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-[#8a7e94]">
          <span>
            {filtered.length} de {products.length} productos
          </span>
          {query && (
            <button onClick={() => setQuery("")} className="font-extrabold text-[#7b56dc] hover:underline">
              Limpiar búsqueda
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pt-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4efff] text-[#6d5cff]">
            <Icon name="search" className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-black text-[#35283f]">No encontramos productos</p>
          <p className="mt-1 text-xs text-[#877c92]">Probá con otro nombre, SKU o filtro.</p>
        </div>
      ) : (
        <div className="pt-product-grid">
          {filtered.map((product) => {
            const critical =
              product.inventory_mode !== "DERIVADO" &&
              Number(product.minimum_stock) > 0 &&
              Number(product.available_base) <= Number(product.minimum_stock);
            const hasMultipleTnOptions = product.observed_variant_count > 1 || product.linked_variant_count > 1;
            const unit = product.base_unit === "g" ? "g" : "u";
            const available = Number(product.available_base ?? 0);
            const salePrice = Number(product.sale_price ?? 0);
            const stockRatio =
              Number(product.minimum_stock ?? 0) > 0
                ? Math.min(100, Math.round((available / Number(product.minimum_stock)) * 100))
                : 100;

            return (
              <Link
                href={`/productos/${product.id}`}
                key={product.id}
                className="group pt-card-interactive relative overflow-hidden rounded-[26px] border border-[#e9dfeb] bg-[linear-gradient(180deg,rgba(255,255,255,.98),rgba(250,247,253,.94))] shadow-[0_12px_30px_rgba(38,23,46,.05)]"
              >
                <div className="relative aspect-[1.02] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(95,76,255,.14),transparent_42%),linear-gradient(180deg,#fbf8ff_0%,#f7f0f5_100%)]">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[24px] border border-white/80 bg-white text-[#6d5cff] shadow-[0_16px_32px_rgba(95,76,255,.12)]">
                        <Icon name="package" className="h-8 w-8" />
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3">
                    <span className="pt-chip border border-white/80 bg-white/88 text-[#624d72] shadow-sm backdrop-blur">
                      {kindLabel(product.product_kind)}
                    </span>
                    {critical && (
                      <span className="pt-chip border border-[#ffd5dd] bg-[#fff3f6] text-[#c34e64] shadow-sm">
                        Stock bajo
                      </span>
                    )}
                    {hasMultipleTnOptions && (
                      <span className="pt-chip border border-[#e4dbff] bg-[#f5f1ff] text-[#6d5cff] shadow-sm">
                        Variantes TN
                      </span>
                    )}
                  </div>

                  <span className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-1 items-center justify-center rounded-[15px] bg-white/92 text-[#6d5cff] opacity-0 shadow-[0_10px_22px_rgba(95,76,255,.12)] backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">
                    <Icon name="arrow" className="h-4 w-4" />
                  </span>
                </div>

                <div className="p-4">
                  <div className="min-h-[62px]">
                    <p className="line-clamp-2 text-[15px] font-black leading-5 tracking-[-0.02em] text-[#2f2438]">
                      {product.name}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#95879a]">
                      <span>{product.sale_sku || product.code || "Sin SKU"}</span>
                      {product.category && (
                        <>
                          <span>•</span>
                          <span className="truncate">{product.category}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[18px] bg-[#fbf8fd] p-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8d7f96]">Disponible</p>
                        <p className={`mt-1 text-[22px] font-black tracking-[-0.05em] ${critical ? "text-[#c34e64]" : "text-[#2f2438]"}`}>
                          {formatQuantity(available)} {unit}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8b7f95]">
                          {product.base_unit === "g" ? `${Math.floor(available / 100)} packs de 100 g` : "venta por unidad"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8d7f96]">Precio</p>
                        <p className="mt-1 text-[17px] font-black tracking-[-0.03em] text-[#2f2438]">
                          {salePrice > 0 ? formatMoney(salePrice) : "—"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8b7f95]">
                          {product.base_unit === "g" ? "por 100 g" : "por unidad"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[#8b7f95]">
                        <span>Salud de stock</span>
                        <span>{Math.max(0, stockRatio)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${critical ? "bg-[#ef8395]" : "bg-[linear-gradient(90deg,#6d5cff_0%,#ca4d87_100%)]"}`}
                          style={{ width: `${Math.max(8, Math.min(100, stockRatio))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function kindLabel(value: string) {
  return ({ INSUMO: "Materia prima", MIX: "Mix", ELABORADO: "Elaborado", COMBO: "Combo" } as Record<string, string>)[value] ?? value;
}
