"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";

const HEADER = "nombre;codigo;tipo;inventario;unidad;costo;stock_minimo;sku;variante;cantidad_base;precio";

type Row = {
  name: string;
  code: string | null;
  product_kind: "INSUMO" | "MIX" | "ELABORADO" | "COMBO";
  inventory_mode: "PROPIO" | "DERIVADO" | "PRODUCIDO";
  base_unit: "g" | "ml" | "u";
  current_cost: number;
  minimum_stock: number;
  sku: string | null;
  variant_name: string;
  base_quantity: number;
  price: number;
};

function splitLine(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ";" && !quoted) { out.push(current.trim()); current = ""; }
    else current += ch;
  }
  out.push(current.trim());
  return out;
}

function n(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const num = Number(normalized || 0);
  return Number.isFinite(num) ? num : NaN;
}

function parse(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [] as Row[], errors: [] as string[] };
  const first = splitLine(lines[0]).map((v) => v.toLowerCase());
  const hasHeader = first.includes("nombre") && first.includes("codigo");
  const columns = hasHeader ? first : HEADER.split(";");
  const start = hasHeader ? 1 : 0;
  const rows: Row[] = [];
  const errors: string[] = [];
  const allowedKinds = ["INSUMO", "MIX", "ELABORADO", "COMBO"];
  const allowedModes = ["PROPIO", "DERIVADO", "PRODUCIDO"];
  const allowedUnits = ["g", "ml", "u"];

  for (let i = start; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    const rec = Object.fromEntries(columns.map((c, idx) => [c, vals[idx] ?? ""]));
    const name = String(rec.nombre ?? "").trim();
    const kind = String(rec.tipo || "INSUMO").trim().toUpperCase();
    const mode = String(rec.inventario || "PROPIO").trim().toUpperCase();
    const unit = String(rec.unidad || "g").trim().toLowerCase();
    const cost = n(String(rec.costo ?? "0"));
    const min = n(String(rec.stock_minimo ?? "0"));
    const baseQty = n(String(rec.cantidad_base ?? "1"));
    const price = n(String(rec.precio ?? "0"));
    if (!name) { errors.push(`Fila ${i + 1}: falta nombre.`); continue; }
    if (!allowedKinds.includes(kind)) { errors.push(`Fila ${i + 1}: tipo inválido (${kind}).`); continue; }
    if (!allowedModes.includes(mode)) { errors.push(`Fila ${i + 1}: inventario inválido (${mode}).`); continue; }
    if (!allowedUnits.includes(unit)) { errors.push(`Fila ${i + 1}: unidad inválida (${unit}).`); continue; }
    if (![cost, min, baseQty, price].every(Number.isFinite) || baseQty <= 0 || cost < 0 || min < 0 || price < 0) { errors.push(`Fila ${i + 1}: revisá los valores numéricos.`); continue; }
    rows.push({
      name,
      code: String(rec.codigo ?? "").trim() || null,
      product_kind: kind as Row["product_kind"],
      inventory_mode: mode as Row["inventory_mode"],
      base_unit: unit as Row["base_unit"],
      current_cost: cost,
      minimum_stock: min,
      sku: String(rec.sku ?? "").trim() || null,
      variant_name: String(rec.variante ?? "").trim() || "Presentación base",
      base_quantity: baseQty,
      price,
    });
  }
  return { rows, errors };
}

export default function InternalBulkImportClient() {
  const [text, setText] = useState(HEADER + "\n");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const preview = useMemo(() => parse(text), [text]);
  const duplicatedSku = useMemo(() => {
    const seen = new Set<string>(); const dup = new Set<string>();
    for (const row of preview.rows) if (row.sku) { if (seen.has(row.sku)) dup.add(row.sku); seen.add(row.sku); }
    return [...dup];
  }, [preview.rows]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setText(await file.text());
  }

  async function confirm() {
    if (!preview.rows.length || preview.errors.length || duplicatedSku.length) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/catalog/import-internal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: preview.rows }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo importar.");
      setMessage(`Listo: ${body.products_created ?? 0} productos creados, ${body.products_updated ?? 0} actualizados y ${body.variants_upserted ?? 0} variantes procesadas.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo importar."); }
    finally { setLoading(false); }
  }

  return <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
    <div className="pt-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-extrabold text-[#3e2833]">Datos</h2><p className="mt-1 text-xs text-[#8d6878]">Separador <b>;</b>. No modifica stock: el stock entra por compras, producción o ajustes con historial.</p></div>
        <label className="pt-button-secondary cursor-pointer px-4 py-2 text-sm">Subir CSV<input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" /></label>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mt-4 min-h-[360px] w-full resize-y rounded-2xl border border-[#ecd4df] bg-[#fffafd] p-3 font-mono text-xs leading-5 text-[#513540] outline-none focus:border-[#d96898]" />
      <p className="mt-3 text-xs text-[#8d6878]">Columnas: nombre, código, tipo, inventario, unidad, costo, stock mínimo, SKU, variante, cantidad base y precio.</p>
    </div>

    <div className="space-y-4">
      <div className="pt-card p-4 sm:p-5">
        <h2 className="font-extrabold text-[#3e2833]">Validación previa</h2>
        <div className="mt-4 grid grid-cols-2 gap-2"><Stat label="Filas válidas" value={preview.rows.length}/><Stat label="Errores" value={preview.errors.length}/><Stat label="SKU duplicados" value={duplicatedSku.length}/><Stat label="Productos únicos" value={new Set(preview.rows.map((r) => r.code || r.name.toLocaleLowerCase("es"))).size}/></div>
        {preview.errors.length > 0 && <div className="mt-4 rounded-xl bg-[#fff2f4] p-3 text-xs font-semibold text-[#a94658]">{preview.errors.slice(0, 8).map((e) => <div key={e}>{e}</div>)}{preview.errors.length > 8 && <div>+ {preview.errors.length - 8} errores más</div>}</div>}
        {duplicatedSku.length > 0 && <div className="mt-3 rounded-xl bg-[#fff2f4] p-3 text-xs font-semibold text-[#a94658]">SKU repetidos en el archivo: {duplicatedSku.join(", ")}</div>}
        {message && <div className="mt-4 rounded-xl bg-[#fff0f6] p-3 text-sm font-semibold text-[#8b3c61]">{message}</div>}
        <div className="mt-5 flex gap-2"><Link href="/productos" className="pt-button-secondary flex-1 px-4 py-3 text-center text-sm">Cancelar</Link><button onClick={confirm} disabled={loading || !preview.rows.length || !!preview.errors.length || !!duplicatedSku.length} className="pt-button-primary flex-1 px-4 py-3 text-sm disabled:opacity-50">{loading ? "Importando…" : "Confirmar"}</button></div>
      </div>
      <div className="rounded-2xl border border-[#ecd6e0] bg-[#fff8fb] p-4 text-xs leading-5 text-[#765562]"><b>Regla de actualización:</b> primero código interno y luego SKU de variante. Si coincide, actualiza; si no, crea. Nunca se deduce el producto a partir de cortar un SKU.</div>
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#fff8fb] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#987b88]">{label}</p><p className="mt-1 text-xl font-extrabold text-[#3e2833]">{value}</p></div>; }
