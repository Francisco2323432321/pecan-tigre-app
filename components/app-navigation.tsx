"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

const primary = [
  { label: "Inicio", href: "/", icon: "home" as IconName },
  { label: "Ventas", href: "/ventas", icon: "sales" as IconName },
  { label: "Pedidos", href: "/pedidos", icon: "orders" as IconName },
  { label: "Stock", href: "/stock", icon: "stock" as IconName },
  { label: "Productos", href: "/productos", icon: "products" as IconName },
  { label: "Compras", href: "/compras", icon: "purchases" as IconName },
  { label: "Producción", href: "/produccion", icon: "production" as IconName },
  { label: "Combos", href: "/combos", icon: "combo" as IconName },
  { label: "Mixes", href: "/mixes", icon: "mix" as IconName },
  { label: "Recetas", href: "/recetas", icon: "recipe" as IconName },
  { label: "Clientes", href: "/clientes", icon: "customers" as IconName },
  { label: "Proveedores", href: "/proveedores", icon: "suppliers" as IconName },
];
const mobile = [
  { label: "Inicio", href: "/", icon: "home" as IconName },
  { label: "Pedidos", href: "/pedidos", icon: "orders" as IconName },
  { label: "Stock", href: "/stock", icon: "stock" as IconName, strong: true },
  { label: "Ventas", href: "/ventas", icon: "sales" as IconName },
  { label: "Más", href: "/menu", icon: "more" as IconName },
];
const pageTitles: Array<[string, string]> = [
  ["/productos/importar", "Importar productos"],["/productos/", "Producto"],["/productos", "Productos"],
  ["/stock/conteo", "Conteo de stock"],["/stock", "Stock"],["/ventas/nueva", "Nueva venta"],["/ventas/", "Venta"],["/ventas", "Ventas"],
  ["/pedidos/preparacion", "Preparación"],["/pedidos", "Pedidos"],["/compras/nueva", "Cargar compra"],["/compras", "Compras"],
  ["/produccion", "Producción"],["/combos", "Combos"],["/mixes", "Mixes"],["/recetas", "Recetas"],["/clientes", "Clientes"],
  ["/proveedores", "Proveedores"],["/configuracion", "Configuración"],["/menu", "Menú"],["/", "Inicio"],
];

export default function AppNavigation({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const title = pageTitles.find(([path]) => path === "/" ? pathname === "/" : pathname.startsWith(path))?.[1] ?? "Gestión";
  return <>
    <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 border-r border-[#efd7e2] bg-white md:flex md:flex-col">
      <div className="px-4 pb-3 pt-4"><div className="rounded-2xl bg-gradient-to-br from-[#fff0f6] to-[#fde7f0] p-4"><p className="text-[11px] font-extrabold tracking-[0.22em] text-[#bc4778]">PECÁN TIGRE</p><p className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-[#4d2938]">Gestión</p><p className="mt-1 text-xs text-[#876675]">Stock · ventas · producción</p></div></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">{primary.map(item => <Link key={item.href} href={item.href} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${isActive(item.href) ? "bg-[#d96898] text-white shadow-[0_6px_16px_rgba(198,77,127,0.16)]" : "text-[#725562] hover:bg-[#fff1f7] hover:text-[#a73f6c]"}`}><Icon name={item.icon} className="h-[18px] w-[18px]" />{item.label}</Link>)}</nav>
      <div className="border-t border-[#efd7e2] p-3"><Link href="/configuracion" className={`mb-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold ${isActive("/configuracion") ? "bg-[#fff0f6] text-[#a73f6c]" : "text-[#725562] hover:bg-[#fff1f7]"}`}><Icon name="settings" className="h-[18px] w-[18px]" />Configuración</Link><div className="rounded-2xl border border-[#f0dbe4] bg-[#fffafd] p-3"><p className="truncate text-sm font-bold text-[#3e2833]">{name}</p><div className="mt-0.5 flex items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wide text-[#b54776]">{role}</p><form action="/auth/signout" method="post"><button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b6877] hover:bg-[#fff0f6] hover:text-[#b54776]" title="Cerrar sesión"><Icon name="logout" className="h-4 w-4" /></button></form></div></div></div>
    </aside>
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#efd7e2] bg-white/95 px-4 backdrop-blur md:hidden"><div className="min-w-0"><p className="text-[9px] font-extrabold tracking-[0.2em] text-[#bc4778]">PECÁN TIGRE</p><p className="truncate text-sm font-bold text-[#3e2833]">{title}</p></div><div className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#fff0f6] px-2 text-xs font-extrabold text-[#ad416f]">{name.trim().slice(0,1).toUpperCase()}</div></header>
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#efd7e2] bg-white/97 px-1 pb-[max(env(safe-area-inset-bottom),4px)] pt-1 shadow-[0_-8px_24px_rgba(93,44,66,0.06)] backdrop-blur md:hidden"><div className="grid grid-cols-5">{mobile.map(item => { const active=isActive(item.href); return <Link key={item.href} href={item.href} className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${active ? "text-[#bc4778]" : "text-[#8d707d]"}`}>{item.strong ? <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${active ? "bg-[#d65f91] text-white shadow-[0_5px_14px_rgba(198,77,127,0.22)]" : "bg-[#fff0f6] text-[#bc4778]"}`}><Icon name={item.icon} className="h-5 w-5" /></span> : <Icon name={item.icon} className="h-[21px] w-[21px]" />}<span>{item.label}</span></Link>})}</div></nav>
  </>;
}
