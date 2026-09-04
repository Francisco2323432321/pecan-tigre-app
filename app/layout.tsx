import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pecán Tigre Gestión",
  description: "Inventario, compras, ventas y operación de Pecán Tigre",
  applicationName: "Pecán Tigre Gestión",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fff8fb" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
