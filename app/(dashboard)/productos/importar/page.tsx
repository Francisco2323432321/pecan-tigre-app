import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import TiendanubeImportClient from "./tiendanube-import-client";

export default async function ImportProductsPage(){
  const supabase=await createClient();
  const [products,variants]=await Promise.all([
    supabase.from("products").select("tiendanube_handle").not("tiendanube_handle","is",null),
    supabase.from("product_variants").select("sku").not("sku","is",null),
  ]);
  return <main className="pt-page"><PageHeader eyebrow="Carga masiva" title="Importar CSV de Tiendanube" description="Lee el CSV real de Tiendanube, agrupa variantes por Identificador de URL y conserva cada SKU exactamente como viene." actions={<Link href="/productos" className="pt-button-secondary inline-flex items-center px-4 text-sm">Volver</Link>} />
    <TiendanubeImportClient existingHandles={(products.data??[]).map(p=>p.tiendanube_handle).filter(Boolean) as string[]} existingSkus={(variants.data??[]).map(v=>v.sku).filter(Boolean) as string[]} />
  </main>
}
