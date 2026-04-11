// /src/app/products/location-variant-data/import/review/page.jsx

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import ClientLocationVariantReviewPage from "./components/ClientLocationVariantReviewPage";

export const dynamic = "force-dynamic";

export default async function LocationVariantReviewPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  const { data: variants } = await supabase
    .from("variants")
    .select("shopify_variant_id")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const knownVariantIds = (variants ?? []).map((v) => String(v.shopify_variant_id));

  return <ClientLocationVariantReviewPage knownVariantIds={knownVariantIds} />;
}
