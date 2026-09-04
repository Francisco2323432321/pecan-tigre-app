export type TiendanubeCsvRow = Record<string, string>;

export const TIENDANUBE_COLUMNS = [
  "Identificador de URL","Nombre","Categorías","Nombre de propiedad 1","Valor de propiedad 1","Nombre de propiedad 2","Valor de propiedad 2","Nombre de propiedad 3","Valor de propiedad 3","Precio","Precio promocional","Peso (kg)","Alto (cm)","Ancho (cm)","Profundidad (cm)","Stock","SKU","Código de barras","Mostrar en tienda","Envío sin cargo","Descripción","Tags","Título para SEO","Descripción para SEO","Marca","Producto Físico","MPN (Número de pieza del fabricante)","Sexo","Rango de edad","Costo","Visibilidad",
] as const;

function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseTiendanubeCsv(text: string): TiendanubeCsvRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = clean.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const lines: string[] = [];
  let current = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      current += ch;
      if (quoted && clean[i + 1] === '"') { current += clean[++i]; }
      else quoted = !quoted;
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      if (current.length) lines.push(current);
      current = "";
    } else current += ch;
  }
  if (current.length) lines.push(current);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export function parseMoney(value?: string | null) {
  if (!value) return 0;
  const s = value.trim();
  if (!s) return 0;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s.replace(",", ".")) || 0;
}

function qtyFromLabel(value: string, weightKg: string) {
  const v = value.trim().toLowerCase().replace(/\s+/g, "");
  const kg = v.match(/([\d.,]+)kg/); if (kg) return parseMoney(kg[1]) * 1000;
  const g = v.match(/([\d.,]+)g/); if (g) return parseMoney(g[1]);
  const u = v.match(/([\d.,]+)(u|unidad|unidades)/); if (u) return parseMoney(u[1]);
  const weight = parseMoney(weightKg); return weight > 0 ? weight * 1000 : 1;
}

export type NormalizedTnVariant = {
  sku: string; name: string; base_quantity: number; price: number; promo_price: number | null; cost: number | null;
  weight_g: number | null; height_cm: number | null; width_cm: number | null; depth_cm: number | null; stock: number | null;
  barcode: string | null; active: boolean; visible: boolean;
};
export type NormalizedTnProduct = {
  handle: string; name: string; category: string | null; description: string | null; product_kind: "INSUMO"|"MIX"|"ELABORADO"|"COMBO";
  inventory_mode: "PROPIO"|"DERIVADO"|"PRODUCIDO"; base_unit: "g"|"u"; visible: boolean; published: boolean;
  tags: string | null; brand: string | null; seo_title: string | null; seo_description: string | null; variants: NormalizedTnVariant[];
};

export function normalizeTiendanubeRows(rows: TiendanubeCsvRow[]): NormalizedTnProduct[] {
  const grouped = new Map<string, NormalizedTnProduct>();
  let lastProduct: NormalizedTnProduct | null = null;
  for (const row of rows) {
    const handle = (row["Identificador de URL"] || "").trim();
    if (!handle) continue;
    const parentName = (row["Nombre"] || "").trim();
    if (parentName) {
      const category = (row["Categorías"] || "").trim();
      const cat = category.toLowerCase();
      const nameLow = parentName.toLowerCase();
      const product_kind: NormalizedTnProduct["product_kind"] = cat.includes("combo") ? "COMBO" : cat.includes("mix") ? "MIX" : cat.includes("receta") || nameLow.includes("granola") ? "ELABORADO" : "INSUMO";
      const inventory_mode: NormalizedTnProduct["inventory_mode"] = product_kind === "COMBO" || product_kind === "MIX" ? "DERIVADO" : product_kind === "ELABORADO" ? "PRODUCIDO" : "PROPIO";
      const base_unit: NormalizedTnProduct["base_unit"] = product_kind === "COMBO" ? "u" : "g";
      lastProduct = grouped.get(handle) ?? {
        handle, name: parentName, category: category || null, description: row["Descripción"] || null, product_kind, inventory_mode, base_unit,
        visible: (row["Visibilidad"] || "").toLowerCase() !== "oculto", published: (row["Mostrar en tienda"] || "SI").toUpperCase() !== "NO",
        tags: row["Tags"] || null, brand: row["Marca"] || null, seo_title: row["Título para SEO"] || null, seo_description: row["Descripción para SEO"] || null, variants: [],
      };
      grouped.set(handle, lastProduct);
    } else lastProduct = grouped.get(handle) ?? lastProduct;
    if (!lastProduct || lastProduct.handle !== handle) continue;
    const sku = (row["SKU"] || "").trim();
    if (!sku) continue;
    const propValue = row["Valor de propiedad 1"] || row["Valor de propiedad 2"] || row["Valor de propiedad 3"] || "Única";
    const baseQty = lastProduct.base_unit === "u" ? 1 : qtyFromLabel(propValue, row["Peso (kg)"] || "");
    const stockRaw = (row["Stock"] || "").trim();
    lastProduct.variants.push({
      sku, name: propValue || "Única", base_quantity: Math.max(baseQty, .001), price: parseMoney(row["Precio"]),
      promo_price: row["Precio promocional"] ? parseMoney(row["Precio promocional"]) : null,
      cost: row["Costo"] ? parseMoney(row["Costo"]) : null,
      weight_g: row["Peso (kg)"] ? parseMoney(row["Peso (kg)"]) * 1000 : null,
      height_cm: row["Alto (cm)"] ? parseMoney(row["Alto (cm)"]) : null,
      width_cm: row["Ancho (cm)"] ? parseMoney(row["Ancho (cm)"]) : null,
      depth_cm: row["Profundidad (cm)"] ? parseMoney(row["Profundidad (cm)"]) : null,
      stock: stockRaw ? parseMoney(stockRaw) : null, barcode: row["Código de barras"] || null,
      active: true, visible: row["Visibilidad"] ? row["Visibilidad"].toLowerCase() !== "oculto" : lastProduct.visible,
    });
  }
  return Array.from(grouped.values());
}
