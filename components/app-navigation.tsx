"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

const primary = [
  { label: "Inicio", href: "/", icon: "home" as IconName, hint: "Resumen" },
  { label: "Productos", href: "/productos", icon: "products" as IconName, hint: "Catálogo y stock" },
  { label: "Ventas", href: "/ventas", icon: "sales" as IconName, hint: "Pedidos y clientes" },
  { label: "Compras", href: "/compras", icon: "purchases" as IconName, hint: "Proveedores y costos" },
  { label: "Finanzas", href: "/finanzas", icon: "finance" as IconName, hint: "Caja y proyección", adminOnly: true },
  { label: "Configuración", href: "/configuracion", icon: "settings" as IconName, hint: "Integraciones" },
];

const mobile = [
  { label: "Inicio", href: "/", icon: "home" as IconName },
  { label: "Productos", href: "/productos", icon: "products" as IconName },
  { label: "Ventas", href: "/ventas", icon: "sales" as IconName },
  { label: "Compras", href: "/compras", icon: "purchases" as IconName },
  { label: "Finanzas", href: "/finanzas", icon: "finance" as IconName, adminOnly: true },
];

const pageTitles: Array<[string, string]> = [
  ["/productos/importar", "Importar productos"],
  ["/productos/", "Producto"],
  ["/productos", "Productos"],
  ["/stock", "Stock"],
  ["/ventas/nueva", "Nueva venta"],
  ["/ventas/", "Venta"],
  ["/ventas", "Ventas"],
  ["/pedidos", "Pedidos"],
  ["/clientes", "Clientes"],
  ["/compras/nueva", "Cargar compra"],
  ["/compras", "Compras"],
  ["/proveedores", "Proveedores"],
  ["/finanzas", "Finanzas"],
  ["/configuracion", "Configuración"],
  ["/", "Inicio"],
];

export default function AppNavigation({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/productos" && ["/stock", "/mixes", "/combos", "/recetas", "/produccion"].some((path) => pathname.startsWith(path))) return true;
    if (href === "/ventas" && ["/pedidos", "/clientes"].some((path) => pathname.startsWith(path))) return true;
    if (href === "/compras" && pathname.startsWith("/proveedores")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const title = pageTitles.find(([path]) => path === "/" ? pathname === "/" : pathname.startsWith(path))?.[1] ?? "Gestión";
  const primaryItems = primary.filter((item) => !item.adminOnly || isAdmin);
  const mobileItems = mobile.filter((item) => !item.adminOnly || isAdmin);
  const initial = name.trim().slice(0, 1).toUpperCase() || "P";

  return <>
    <aside className="sticky top-0 hidden h-dvh w-[274px] shrink-0 border-r border-[#edd9e2] bg-white/88 backdrop-blur-xl md:flex md:flex-col">
      <div className="px-4 pb-4 pt-4">
        <Link href="/" className="group block rounded-[24px] border border-[#efd9e3] bg-gradient-to-br from-white via-[#fffafd] to-[#fff0f6] p-3.5 shadow-[0_12px_30px_rgba(83,43,61,.055)] transition hover:border-[#e5b6ca] hover:shadow-[0_16px_36px_rgba(83,43,61,.075)]">
          <img src="/brand/logo.svg" alt="Pecán Tigre" className="h-12 w-full object-contain object-left transition group-hover:translate-x-0.5" />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#f2e2e9] pt-2.5">
            <span className="text-[10px] font-black uppercase tracking-[.16em] text-[#b14874]">Panel operativo</span>
            <span className="h-2 w-2 rounded-full bg-[#55a27f] shadow-[0_0_0_4px_rgba(85,162,127,.12)]" title="Online" />
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          return <Link
            key={item.href}
            href={item.href}
            className={`group flex min-h-[54px] items-center gap-3 rounded-[16px] px-3.5 transition-all ${active ? "bg-[#4b2d3a] text-white shadow-[0_10px_24px_rgba(75,45,58,.17)]" : "text-[#6f5662] hover:bg-[#fff1f7] hover:text-[#9e3864]"}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] transition ${active ? "bg-white/10 text-white" : "bg-[#fff3f8] text-[#bb4a79] group-hover:bg-white group-hover:shadow-sm"}`}>
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black tracking-[-.01em]">{item.label}</span>
              <span className={`mt-0.5 block truncate text-[10px] font-semibold ${active ? "text-white/60" : "text-[#a88c98]"}`}>{item.hint}</span>
            </span>
            {active && <span className="h-5 w-1 rounded-full bg-[#efb8cf]" />}
          </Link>;
        })}
      </nav>

      <div className="border-t border-[#efd9e2] p-3">
        <div className="rounded-[18px] border border-[#efdae3] bg-[#fffafd] p-2.5 shadow-[0_5px_16px_rgba(83,43,61,.035)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#e2709e] to-[#bd4777] text-sm font-black text-white shadow-sm">{initial}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#3d2932]">{name}</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[.13em] text-[#af4773]">{role}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="pt-button-ghost flex h-9 min-h-0 w-9 items-center justify-center rounded-xl" title="Cerrar sesión" aria-label="Cerrar sesión">
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>

    <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#efd9e2] bg-white/92 px-4 shadow-[0_5px_18px_rgba(84,43,61,.04)] backdrop-blur-xl md:hidden">
      <Link href="/" className="min-w-0">
        <p className="text-[9px] font-black tracking-[0.2em] text-[#b44774]">PECÁN TIGRE</p>
        <p className="truncate text-[15px] font-black tracking-[-.018em] text-[#3d2932]">{title}</p>
      </Link>
      <Link href="/configuracion" className="flex h-10 min-w-10 items-center justify-center rounded-[14px] border border-[#efd5e0] bg-[#fff3f8] px-2 text-xs font-black text-[#a63e6b] shadow-sm" title="Configuración">{initial}</Link>
    </header>

    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#edd5df] bg-white/95 px-1.5 pb-[max(env(safe-area-inset-bottom),5px)] pt-1.5 shadow-[0_-10px_30px_rgba(82,41,59,0.07)] backdrop-blur-xl md:hidden">
      <div className={`grid ${mobileItems.length === 5 ? "grid-cols-5" : "grid-cols-4"} gap-0.5`}>
        {mobileItems.map((item) => {
          const active = isActive(item.href);
          return <Link key={item.href} href={item.href} className={`relative flex min-h-[55px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-[9px] font-black transition ${active ? "text-[#a53a68]" : "text-[#927782]"}`}>
            <span className={`flex h-8 w-10 items-center justify-center rounded-[12px] transition ${active ? "bg-[#fff0f6] text-[#bd4777] shadow-[inset_0_0_0_1px_rgba(225,162,189,.35)]" : "text-[#8d7480]"}`}>
              <Icon name={item.icon} className="h-[19px] w-[19px]" />
            </span>
            <span className="max-w-full truncate">{item.label}</span>
            {active && <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-[#c64c7d]" />}
          </Link>;
        })}
      </div>
    </nav>
  </>;
}
