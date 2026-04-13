// /src/app/suppliers/[slug]/setup/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientSupplierSetupPage from "./components/ClientSupplierSetupPage";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SupplierSetupPage({ params }) {
  const { slug } = await params;

  // Fetch supplier by supplier_number (slug)
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_number")
    .eq("supplier_number", slug)
    .single();

  if (!supplier) notFound();

  // Fetch all products with vendor and category
  const { data: products } = await supabase
    .from("products")
    .select("id, title, image_src, vendor, category, display_title")
    .order("title", { ascending: true })
    .limit(500);

  // Fetch variant SKU counts per product
  const { data: variantCounts } = await supabase
    .from("variants")
    .select("product_id, sku")
    .limit(2000);

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
    .from("supplier_variants")
    .select("variant_id, variants!inner(product_id)")
    .eq("supplier_id", supplier.id);

  const associatedProductIds = [
    ...new Set((existingAssociations ?? []).map((r) => r.variants?.product_id).filter(Boolean))
  ];

  return (
    <ClientSupplierSetupPage
      supplier={supplier}
      products={enrichedProducts}
      vendors={vendors ?? []}
      categories={categories}
      associatedProductIds={associatedProductIds}
    />
  );
}
