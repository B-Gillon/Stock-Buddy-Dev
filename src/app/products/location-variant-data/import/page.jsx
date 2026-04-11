// /src/app/products/location-variant-data/import/page.jsx

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import ClientLocationVariantImportPage from "./components/ClientLocationVariantImportPage";

export default async function LocationVariantImportPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <ClientLocationVariantImportPage
      locations={locations ?? []}
    />
  );
}
