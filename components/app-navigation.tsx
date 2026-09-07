"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

const primary = [
  { label: "Inicio", href: "/", icon: "home" as IconName, hint: "Resumen general" },
  { label: "Productos", href: "/productos", icon: "products" as IconName, hint: "Catálogo y stock" },
  { label: "Ventas", href: "/ventas", icon: "sales" as IconName, hint: "Pedidos y clientes" },
  { label: "Compras", href: "/compras", icon: "purchases" as IconName, hint: "Abastecimiento" },
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

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[286px] shrink-0 border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,.8),rgba(250,247,252,.9))] backdrop-blur-2xl md:flex md:flex-col">
        <div className="p-4 pb-3">
          <Link
            href="/"
            className="block rounded-[28px] border border-[#ece3ef] bg-[linear-gradient(135deg,rgba(103,89,255,.09),rgba(202,77,135,.08))] p-4 shadow-[0_18px_38px_rgba(38,23,46,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(38,23,46,.09)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white shadow-[0_10px_24px_rgba(95,76,255,.12)]">
                <img src="/brand/logo.svg" alt="Pecán Tigre" className="h-8 w-8 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8f6f9a]">Pecán Tigre</p>
                <h2 className="truncate text-[22px] font-black leading-none tracking-[-0.04em] text-[#2f2139]">Gestión</h2>
                <p className="mt-1 text-[12px] font-medium text-[#73677e]">Panel analítico y operativo</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[20px] border border-white/70 bg-white/72 px-3.5 py-3 backdrop-blur-xl">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a14c7c]">Estado</p>
                <p className="mt-1 text-sm font-bold text-[#3f314b]">Sistema activo</p>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-[#effbf4] px-3 py-1 text-[11px] font-bold text-[#25966b]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#31bf83]" />
                Online
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
          {primaryItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group flex min-h-[60px] items-center gap-3 rounded-[20px] px-3.5 transition-all",
                  active
                    ? "border border-[#e5daf3] bg-white text-[#2e2236] shadow-[0_16px_32px_rgba(38,23,46,.06)]"
                    : "border border-transparent text-[#6b6076] hover:border-[#ede5f1] hover:bg-white/75 hover:text-[#2f2337]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] transition",
                    active
                      ? "bg-[linear-gradient(135deg,#6d5cff_0%,#ca4d87_100%)] text-white shadow-[0_10px_22px_rgba(95,76,255,.22)]"
                      : "bg-[#f7f2fb] text-[#9d6da1] group-hover:bg-white group-hover:shadow-sm",
                  ].join(" ")}
                >
                  <Icon name={item.icon} className="h-[19px] w-[19px]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-black tracking-[-0.02em]">{item.label}</span>
                  <span className={`mt-0.5 block truncate text-[11px] ${active ? "text-[#867591]" : "text-[#97899f]"}`}>
                    {item.hint}
                  </span>
                </span>

                {active && <span className="h-8 w-1.5 rounded-full bg-[linear-gradient(180deg,#6d5cff_0%,#ca4d87_100%)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/70 p-4 pt-3">
          <div className="rounded-[24px] border border-[#ece3ef] bg-white/80 p-3.5 shadow-[0_12px_28px_rgba(38,23,46,.05)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#6d5cff_0%,#ca4d87_100%)] text-sm font-black text-white shadow-[0_10px_20px_rgba(95,76,255,.18)]">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-[#2f2139]">{name}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9f6e8b]">{role}</p>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="pt-button-ghost flex h-10 min-h-0 w-10 items-center justify-center rounded-[14px]"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <Icon name="logout" className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-[66px] items-center justify-between border-b border-white/80 bg-white/85 px-4 shadow-[0_8px_24px_rgba(38,23,46,.05)] backdrop-blur-2xl md:hidden">
        <Link href="/" className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.18em] text-[#9a5d97]">PECÁN TIGRE</p>
          <p className="truncate text-[17px] font-black tracking-[-0.025em] text-[#2f2139]">{title}</p>
        </Link>
        <Link
          href="/configuracion"
          className="flex h-11 min-w-11 items-center justify-center rounded-[16px] border border-[#ebdff0] bg-white px-3 text-xs font-black text-[#604e70] shadow-[0_8px_20px_rgba(38,23,46,.05)]"
          title="Configuración"
        >
          {initial}
        </Link>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/80 bg-white/88 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 shadow-[0_-12px_30px_rgba(38,23,46,0.06)] backdrop-blur-2xl md:hidden">
        <div className={`grid ${mobileItems.length === 5 ? "grid-cols-5" : "grid-cols-4"} gap-1`}>
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[10px] font-black transition ${
                  active ? "bg-[#f6f2ff] text-[#5f4cff]" : "text-[#8d8296]"
                }`}
              >
                <span
                  className={`flex h-8 w-10 items-center justify-center rounded-[12px] transition ${
                    active
                      ? "bg-white text-[#5f4cff] shadow-[0_8px_18px_rgba(95,76,255,.12)]"
                      : "text-[#8d8296]"
                  }`}
                >
                  <Icon name={item.icon} className="h-[19px] w-[19px]" />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
                {active && <span className="absolute bottom-0 h-1 w-7 rounded-full bg-[linear-gradient(135deg,#6d5cff_0%,#ca4d87_100%)]" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
