import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "sales"
  | "orders"
  | "stock"
  | "products"
  | "purchases"
  | "production"
  | "customers"
  | "settings"
  | "more"
  | "search"
  | "plus"
  | "arrow"
  | "package"
  | "alert"
  | "check"
  | "clock"
  | "mail"
  | "logout"
  | "print"
  | "tag"
  | "edit"
  | "refresh"
  | "combo"
  | "mix"
  | "recipe"
  | "suppliers"
  | "upload"
  | "calculator";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
  sales: <><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,
  orders: <><path d="M7 3h10l2 4v14H5V7l2-4Z"/><path d="M5 8h14"/><path d="M9 12h6"/></>,
  stock: <><path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/></>,
  products: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
  purchases: <><path d="M6 7h15l-2 8H8L6 3H3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
  production: <><path d="M4 21V10l6 3V9l6 4V6l4 2v13H4Z"/><path d="M8 17h2M14 17h2"/></>,
  customers: <><circle cx="9" cy="8" r="4"/><path d="M2 21c.8-4 3.1-6 7-6s6.2 2 7 6"/><circle cx="18" cy="9" r="3"/><path d="M16 15c3.3.2 5.3 2.2 6 6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6V21H10v-.1a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1L4 17l.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 13.9H3V10h.1a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1L7 4l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10.1 3V3H14v.1a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1L20 7l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1.1h.1V14h-.1a1.8 1.8 0 0 0-1.7 1Z"/></>,
  more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  package: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  logout: <><path d="M10 5H5v14h5"/><path d="m14 8 4 4-4 4M18 12H9"/></>,
  print: <><path d="M7 9V3h10v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 17H4V9h16v8h-2"/></>,
  tag: <><path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.5"/></>,
  edit: <><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16 4 20Z"/><path d="m14.5 6.3 3.2 3.2"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.8 7M17.9 16A7 7 0 0 1 5.2 17"/></>,
  combo: <><rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="8" y="13" width="8" height="7" rx="2"/></>,
  mix: <><circle cx="8" cy="9" r="4"/><circle cx="16" cy="9" r="4"/><circle cx="12" cy="16" r="4"/></>,
  recipe: <><path d="M7 3h10v18H7z"/><path d="M10 7h4M10 11h4M10 15h3"/></>,
  suppliers: <><path d="M3 8h12v11H3z"/><path d="M15 11h4l2 3v5h-6z"/><circle cx="7" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h8"/></>,
};

export function Icon({ name, className = "h-5 w-5", ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
