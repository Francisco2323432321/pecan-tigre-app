"use client";

import { useState } from "react";
import { createProduct } from "./actions";

export default function NewProductButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate(formData: FormData) {
    setSaving(true);
    try { await createProduct(formData); setOpen(false); }
    finally { setSaving(false); }
  }

  return <>
    <button onClick={() => setOpen(true)} className="pt-button-primary inline-flex items-center px-4 py-2 text-sm">+ Nuevo producto</button>
    {open && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#4d2938]/30 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[26px] border border-[#f3d6e4] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[26px]">
        <div className="flex items-center justify-between border-b border-[#f3d6e4] p-5 sm:p-6">
          <div><p className="text-[10px] font-black tracking-[0.2em] text-[#c65082]">PECÁN TIGRE</p><h2 className="mt-1 text-xl font-black text-[#4d2938]">Nuevo producto</h2></div>
          <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0f6] text-lg font-semibold text-[#a83f6d]">×</button>
        </div>
        <form action={handleCreate} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre"><input name="name" required placeholder="Ej. Almendras" className="pt-input" /></Field>
            <Field label="Código interno"><input name="code" placeholder="Ej. ALM" className="pt-input" /></Field>
            <Field label="SKU (automático si lo dejás vacío)"><input name="sku" placeholder="Se generará automáticamente" className="pt-input" /></Field>
            <Field label="Precio"><input name="price" type="number" min="0" step="0.01" placeholder="0" className="pt-input" /></Field>
            <Field label="Tipo"><select name="product_kind" defaultValue="INSUMO" className="pt-input"><option value="INSUMO">Producto simple / comprado</option><option value="MIX">Mix</option><option value="ELABORADO">Elaborado</option><option value="COMBO">Combo</option></select></Field>
            <Field label="Control de stock"><select name="inventory_mode" defaultValue="PROPIO" className="pt-input"><option value="PROPIO">Stock propio</option><option value="DERIVADO">Calculado por receta / combo</option><option value="PRODUCIDO">Elaborado previamente</option></select></Field>
            <Field label="Forma actual de venta"><select name="base_unit" defaultValue="g" className="pt-input"><option value="g">Peso · packs de 100 g</option><option value="u">Unidad</option></select></Field>
          </div>
          <div className="rounded-2xl border border-[#f1dce6] bg-[#fff8fb] p-4 text-sm leading-6 text-[#80616f]">
            Por ahora la app trabaja con <strong>100 g</strong> o <strong>unidad</strong>. Si Tiendanube detecta varias variantes en un producto, las mostrará como advertencia y evitará sincronizar stock de forma automática hasta configurarlas.
          </div>
          <div className="flex justify-end gap-3 border-t border-[#f3d6e4] pt-5"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="pt-button-secondary px-5">Cancelar</button><button type="submit" disabled={saving} className="pt-button-primary px-5">{saving ? "Creando…" : "Crear producto"}</button></div>
        </form>
      </div>
    </div>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="pt-label">{label}</span>{children}</label>;
}
