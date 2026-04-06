import { supabase } from "@/lib/supabaseClient";
import ClientSupplierSetupPage from "./components/ClientSupplierSetupPage";

export default async function SupplierSetupPage({ params }) {
  const { id } = await params;

  // Fetch supplier name for display
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, supplier_name")
    .eq("id", id)
    .single();

  // Fetch all products with vendor and category
  const { data: products } = await supabase
    .from("products")
    .select("id, title, image_src, vendor, category, display_title")
    .order("title", { ascending: true });

  // Fetch variant SKU counts per product
  const { data: variantCounts } = await supabase
    .from("variants")
    .select("product_id, sku");

  // Build SKU count map
  const skuCountMap = {};
  for (const v of variantCounts ?? []) {
    if (!skuCountMap[v.product_id]) skuCountMap[v.product_id] = 0;
    if (v.sku) skuCountMap[v.product_id]++;
  }

  // Attach sku_count to each product
  const enrichedProducts = (products ?? []).map((p) => ({
    ...p,
    sku_count: skuCountMap[p.id] ?? 0,
  }));

  // Fetch unique vendors for filter dropdown
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name")
    .order("name", { ascending: true });

  // Fetch unique categories for filter dropdown
  const categories = [
    ...new Set(
      (products ?? []).map((p) => p.category).filter(Boolean)
    ),
  ].sort();

  // Fetch already-associated product IDs so they show pre-checked
  const { data: existingAssociations } = await supabase
    .from("supplier_products")
    .select("product_id")
    .eq("supplier_id", id);

  const associatedProductIds = (existingAssociations ?? []).map((r) => r.product_id);

  return (
    <ClientSupplierSetupPage
      supplier={supplier ?? { id, supplier_name: "Supplier" }}
      products={enrichedProducts}
      vendors={vendors ?? []}
      categories={categories}
      associatedProductIds={associatedProductIds}
    />
  );
}
