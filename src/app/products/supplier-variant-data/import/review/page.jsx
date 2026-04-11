// /src/app/products/supplier-variant-data/import/review/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientReviewPage from "./components/ClientReviewPage";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  const { data: variants } = await supabase
    .from("variants")
    .select("shopify_variant_id")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const knownVariantIds = (variants ?? []).map((v) => String(v.shopify_variant_id));

  return <ClientReviewPage knownVariantIds={knownVariantIds} />;
}
