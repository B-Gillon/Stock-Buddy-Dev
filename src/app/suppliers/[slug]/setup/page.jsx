// /src/app/suppliers/[slug]/setup/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientSupplierSetupPage from "./components/ClientSupplierSetupPage";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SupplierSetupPage({ params }) {
  const { slug } = await params;

  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_number")
    .eq("tenant_id", tenantId)
    .eq("supplier_number", slug)
    .single();

  if (!supplier) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("id, title, image_src, vendor, category, display_title")
    .eq("tenant_id", tenantId)
    .order("title", { ascending: true })
    .limit(500);

  const { data: variantCounts } = await supabase
    .from("variants")
    .select("product_id, sku")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const skuCountMap = {};
  for (const v of variantCounts ?? []) {
    if (!skuCountMap[v.product_id]) skuCountMap[v.product_id] = 0;
    if (v.sku) skuCountMap[v.product_id]++;
  }

  const enrichedProducts = (products ?? []).map((p) => ({
    ...p,
    sku_count: skuCountMap[p.id] ?? 0,
  }));

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const categories = [
    ...new Set((products ?? []).map((p) => p.category).filter(Boolean)),
  ].sort();

  const { data: existingAssociations } = await supabase
    .from("supplier_variants")
    .select("variant_id, variants!inner(product_id)")
    .eq("tenant_id", tenantId)
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
