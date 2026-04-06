// /src/app/products/supplier-variant-data/import/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientImportPage from "./components/ClientImportPage";

export default async function ImportSupplierVariantInfoPage() {
  const [suppliersRes, syncRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_name, supplier_number")
      .order("supplier_name", { ascending: true }),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single(),
  ]);

  return (
    <ClientImportPage
      suppliers={suppliersRes.data ?? []}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
    />
  );
}
