// /src/app/products/supplier-variant-data/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientSupplierVariantDataPage from "./components/ClientSupplierVariantDataPage";

export default async function SupplierVariantDataPage() {
  const { data: syncRes } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("sync_type", "products")
    .single();

  return (
    <ClientSupplierVariantDataPage
      lastSyncedAt={syncRes?.last_synced_at ?? null}
    />
  );
}
