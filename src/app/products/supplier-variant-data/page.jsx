// /src/app/products/supplier-variant-data/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientSupplierVariantDataPage from "./components/ClientSupplierVariantDataPage";

export const dynamic = "force-dynamic";

export default async function SupplierVariantDataPage() {
  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: syncRes } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("sync_type", "products")
    .maybeSingle();

  return (
    <ClientSupplierVariantDataPage
      lastSyncedAt={syncRes?.last_synced_at ?? null}
    />
  );
}
