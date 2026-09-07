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
    <div className="pt-scrollbar-none pt-toolbar mb-6 flex gap-2 overflow-x-auto p-2">
      {items.map((item) => {
        const active = item.match ? current.includes(item.match) : current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "shrink-0 rounded-full px-4 py-2.5 text-xs font-black transition-all",
              active
                ? "bg-[linear-gradient(135deg,#6d5cff_0%,#ca4d87_100%)] text-white shadow-[0_12px_24px_rgba(95,76,255,.2)]"
                : "bg-white/70 text-[#65596f] hover:bg-white hover:text-[#2f2337]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
