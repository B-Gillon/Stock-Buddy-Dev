// /src/app/vendors/[slug]/page.jsx

import { headers } from "next/headers";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { notFound } from "next/navigation";
import { getStoreSettings } from "@/shared/utils/getStoreSettings";
import ClientVendorDetailPage from "./components/ClientVendorDetailPage";

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default async function VendorDetailPage({ params }) {
  const { slug } = await params;

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);
  await setTenantContext(supabase, tenantId);

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name");

  const vendor = (vendors ?? []).find((v) => toSlug(v.name) === slug);
  if (!vendor) notFound();

  const [productsRes, variantsRes, syncRes, settings] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("vendor", vendor.name)
      .order("title", { ascending: true }),
    supabase
      .from("variants")
      .select("product_id"),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single(),
    getStoreSettings(tenantId),
  ]);

  const products     = productsRes.data  ?? [];
  const variants     = variantsRes.data  ?? [];
  const lastSyncedAt = syncRes.data?.last_synced_at ?? null;
  const storeName    = settings.store_name;

  const variantCountMap = new Map();
  for (const variant of variants) {
    if (!variant.product_id) continue;
    variantCountMap.set(
      variant.product_id,
      (variantCountMap.get(variant.product_id) ?? 0) + 1
    );
  }

  const enrichedProducts = products.map((p) => ({
    ...p,
    variant_count: variantCountMap.get(p.id) ?? 0,
  }));

  return (
    <ClientVendorDetailPage
      vendor={vendor}
      initialProducts={enrichedProducts}
      initialLastSyncedAt={lastSyncedAt}
      storeName={storeName}
    />
  );
}
