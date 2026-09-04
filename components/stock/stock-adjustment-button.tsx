"use client";

import { useState } from "react";
import { adjustStock } from "@/app/(dashboard)/stock/actions";
import { Icon } from "@/components/ui/icons";
import { formatQuantity } from "@/lib/format";

export default function StockAdjustmentButton({ productId, productName, unit, current }: { productId: string; productName: string; unit: string; current: number }) {
  const [open, setOpen] = useState(false);
  async function handleAdjust(formData: FormData) { await adjustStock(formData); setOpen(false); }
  return <>
    <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#fff0f6] px-3 text-xs font-bold text-[#ad416f]"><Icon name="edit" className="h-3.5 w-3.5" />Ajustar</button>
    {open && <div className="fixed inset-0 z-[80] flex items-end bg-[#3e2833]/25 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setOpen(false); }}>
      <div className="w-full rounded-t-[24px] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[24px]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#b54776]">Ajuste de inventario</p><h3 className="mt-1 text-xl font-bold text-[#3e2833]">{productName}</h3><p className="mt-1 text-sm text-[#80616f]">Stock actual: {formatQuantity(current)} {unit}</p></div><button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1f7] text-lg text-[#9d6d81]">×</button></div>
        <form action={handleAdjust} className="mt-5 space-y-4">
          <input type="hidden" name="product_id" value={productId} />
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#80616f]">Cantidad a sumar o restar ({unit})</span><input className="pt-input" type="number" step="0.001" name="delta" required placeholder="Ej. 500 o -170" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#80616f]">Motivo</span><select className="pt-input" name="reason" defaultValue="CONTEO_FISICO"><option value="CONTEO_FISICO">Conteo físico</option><option value="MERMA">Merma</option><option value="ERROR_CARGA">Error de carga</option><option value="DANADO">Producto dañado</option><option value="USO_INTERNO">Uso interno</option><option value="OTRO">Otro</option></select></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#80616f]">Nota opcional</span><textarea className="pt-input min-h-20 resize-none" name="note" placeholder="Detalle del ajuste…" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className="pt-button-secondary flex-1 px-4">Cancelar</button><button type="submit" className="pt-button-primary flex-1 px-4">Guardar ajuste</button></div>
        </form>
      </div>
    </div>}
  </>;
}
