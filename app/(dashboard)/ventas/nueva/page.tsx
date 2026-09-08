import PageHeader from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import NewSaleForm from "@/components/sales/new-sale-form";

function choosePrimaryVariant<T extends { id: string; product_id: string; name: string; sku: string | null; base_quantity: number | string; price: number | string; promo_price: number | string | null; tiendanube_variant_id: string | null; active: boolean }>(variants: T[], baseUnit: string) {
  const active = variants.filter((v) => v.active !== false);
  const target = baseUnit === "g" ? 100 : 1;
  return active.find((v) => Number(v.base_quantity) === target && v.tiendanube_variant_id)
    ?? active.find((v) => Number(v.base_quantity) === target)
    ?? null;
}

export default async function NewSalePage() {
  const supabase = await createClient();
  const [customersRes, productsRes, variantsRes, recipesRes, recipeItemsRes] = await Promise.all([
    supabase.from("customers").select("id,name,email,phone,address").order("name").limit(300),
    supabase.from("product_stock_overview").select("id,name,base_unit,current_cost,image_url,available_base,product_kind,inventory_mode").eq("active", true).order("name"),
    supabase.from("product_variants").select("id,product_id,name,sku,base_quantity,price,promo_price,tiendanube_variant_id,active").eq("active", true).order("base_quantity"),
    supabase.from("recipes").select("id,output_product_id,output_quantity_base,status").eq("status", "ACTIVA"),
    supabase.from("recipe_items").select("id,recipe_id,ingredient_product_id,quantity_base"),
  ]);

  const variants = variantsRes.data ?? [];
  const recipes = recipesRes.data ?? [];
  const recipeItems = recipeItemsRes.data ?? [];
  const productRows = productsRes.data ?? [];
  const nameById = new Map(productRows.map((p) => [p.id, p.name]));
  const unitById = new Map(productRows.map((p) => [p.id, p.base_unit]));

  const products = productRows.flatMap((p) => {
    const variant = choosePrimaryVariant(variants.filter((v) => v.product_id === p.id), p.base_unit);
    if (!variant) return [];
    const recipe = recipes.find((r) => r.output_product_id === p.id);
    return [{
      ...p,
      current_cost: Number(p.current_cost ?? 0),
      available_base: Number(p.available_base ?? 0),
      variant: { ...variant, base_quantity: Number(variant.base_quantity), price: Number(variant.price), promo_price: variant.promo_price == null ? null : Number(variant.promo_price) },
      recipe: recipe ? {
        output_quantity_base: Number(recipe.output_quantity_base),
        items: recipeItems.filter((i) => i.recipe_id === recipe.id).map((i) => ({
          ingredient_product_id: i.ingredient_product_id,
          ingredient_name: nameById.get(i.ingredient_product_id) ?? "Ingrediente",
          ingredient_unit: unitById.get(i.ingredient_product_id) ?? "g",
          quantity_base: Number(i.quantity_base),
        })),
      } : null,
    }];
  });

  return <main className="pt-page"><PageHeader eyebrow="Ventas" title="Nueva venta" description="Crea el pedido, revisá su composición interna y confirmá el stock de forma segura." /><NewSaleForm customers={(customersRes.data ?? []) as never[]} products={products as never[]} /></main>;
}
