"use client";

import { useState } from "react";
import { createProduct } from "./actions";

export default function NewProductButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate(formData: FormData) {
    setSaving(true);
    try {
      await createProduct(formData);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pt-button-primary inline-flex items-center px-4 py-2 text-sm"
      >
        + Nuevo producto
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#4d2938]/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#f3d6e4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f3d6e4] p-6">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-[#c65082]">PECÁN TIGRE</p>
                <h2 className="mt-1 text-xl font-semibold text-[#4d2938]">Nuevo producto</h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0f6] text-lg font-semibold text-[#a83f6d] transition hover:bg-[#fce7f0]"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form action={handleCreate} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <input
                    name="name"
                    required
                    placeholder="Ej. Nueces Chandler"
                    className="pt-input"
                  />
                </Field>

                <Field label="Código">
                  <input
                    name="code"
                    placeholder="Ej. NUEZ-CHA"
                    className="pt-input"
                  />
                </Field>

                <Field label="Tipo">
                  <select name="product_kind" defaultValue="INSUMO" className="pt-input">
                    <option value="INSUMO">Materia prima</option>
                    <option value="MIX">Mix</option>
                    <option value="ELABORADO">Elaborado</option>
                    <option value="COMBO">Combo</option>
                  </select>
                </Field>

                <Field label="Control de stock">
                  <select name="inventory_mode" defaultValue="PROPIO" className="pt-input">
                    <option value="PROPIO">Stock propio</option>
                    <option value="DERIVADO">Calculado por receta</option>
                    <option value="PRODUCIDO">Elaborado previamente</option>
                  </select>
                </Field>

                <Field label="Unidad base">
                  <select name="base_unit" defaultValue="g" className="pt-input">
                    <option value="g">Gramos</option>
                    <option value="ml">Mililitros</option>
                    <option value="u">Unidades</option>
                  </select>
                </Field>
              </div>

              <div className="rounded-2xl bg-[#fff8fb] p-4 text-sm leading-6 text-[#8d6878]">
                Después de crear el producto vas a poder configurar presentaciones, precios, recetas y stock desde su ficha.
              </div>

              <div className="flex justify-end gap-3 border-t border-[#f3d6e4] pt-5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-[#f3d6e4] px-5 py-3 text-sm font-semibold text-[#735261] transition hover:bg-[#fff8fb] disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#d96898] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c65082] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Creando..." : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8d6878]">{label}</span>
      {children}
    </label>
  );
}
