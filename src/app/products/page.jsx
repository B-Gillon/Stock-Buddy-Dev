// /src/app/products/page.jsx
// SERVER COMPONENT — no "use client"

import { headers } from "next/headers";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { getStoreSettings } from "@/shared/utils/getStoreSettings";
import ClientProductsPage from "@/app/products/components/ClientProductsPage";

export default async function ProductsPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);
  await setTenantContext(supabase, tenantId);

  const [productsRes, variantsRes, syncRes, settings] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("variants").select("product_id"),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single(),
    getStoreSettings(tenantId),
  ]);

  const products     = productsRes.data  || [];
  const variants     = variantsRes.data  || [];
  const lastSyncedAt = syncRes.data?.last_synced_at || null;
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
    <ClientProductsPage
      initialProducts={enrichedProducts}
      initialLastSyncedAt={lastSyncedAt}
      storeName={storeName}
    />
  );
}
