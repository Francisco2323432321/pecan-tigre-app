"use client";

import { usePathname, useRouter } from "next/navigation";

export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/") return null;
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#eadff0] bg-white/85 px-3 text-xs font-black text-[#695a73] shadow-[0_6px_16px_rgba(38,23,46,.035)] transition hover:bg-white"
      aria-label="Volver a la pantalla anterior"
    >
      <span aria-hidden="true">←</span> Volver
    </button>
  );
}
