const maps: Record<string, { label: string; cls: string }> = {
  NUEVO: { label: "Nuevo", cls: "bg-[#f4edf8] text-[#74599a]" },
  CONFIRMADO: { label: "Confirmado", cls: "bg-[#eef7f2] text-[#36785b]" },
  PREPARANDO: { label: "Preparando", cls: "bg-[#fff5e8] text-[#9c6628]" },
  PREPARADO: { label: "Preparado", cls: "bg-[#fff0f6] text-[#ac416f]" },
  ENVIADO: { label: "Enviado", cls: "bg-[#edf4fb] text-[#416c96]" },
  ENTREGADO: { label: "Entregado", cls: "bg-[#eef7f2] text-[#36785b]" },
  CANCELADO: { label: "Cancelado", cls: "bg-[#fbecef] text-[#a94658]" },
  PAGADO: { label: "Pagado", cls: "bg-[#eef7f2] text-[#36785b]" },
  PENDIENTE: { label: "Pendiente", cls: "bg-[#fff5e8] text-[#9c6628]" },
  REEMBOLSADO: { label: "Reembolsado", cls: "bg-[#f4edf8] text-[#74599a]" },
  FALLIDO: { label: "Fallido", cls: "bg-[#fbecef] text-[#a94658]" },
  RESERVED: { label: "Reservado", cls: "bg-[#fff0f6] text-[#ac416f]" },
  CONSUMED: { label: "Descontado", cls: "bg-[#eef7f2] text-[#36785b]" },
  RELEASED: { label: "Liberado", cls: "bg-[#edf4fb] text-[#416c96]" },
  ERROR: { label: "Error", cls: "bg-[#fbecef] text-[#a94658]" },
};

export default function StatusBadge({ value }: { value: string | null | undefined }) {
  const key = value || "PENDIENTE";
  const item = maps[key] ?? { label: key.replaceAll("_", " "), cls: "bg-[#f5edf1] text-[#795d69]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${item.cls}`}>{item.label}</span>;
}
