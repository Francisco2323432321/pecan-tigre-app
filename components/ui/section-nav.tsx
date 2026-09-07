"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type SectionNavItem = {
  label: string;
  href: string;
  match?: string;
};

export default function SectionNav({ items }: { items: SectionNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const current = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <div className="pt-scrollbar-none pt-toolbar mb-5 flex gap-1.5 overflow-x-auto p-1.5">
      {items.map((item) => {
        const active = item.match ? current.includes(item.match) : current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-[13px] px-3.5 py-2 text-xs font-black transition-all ${
              active
                ? "bg-[#4b2d3a] text-white shadow-[0_6px_16px_rgba(75,45,58,.15)]"
                : "text-[#775b68] hover:bg-[#fff1f7] hover:text-[#a43c69]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
