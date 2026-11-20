// /src/app/products/supplier-variant-data/import/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientImportPage from "./components/ClientImportPage";

export const dynamic = "force-dynamic";

export default async function ImportSupplierVariantInfoPage() {
  const [suppliersRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_name, supplier_number")
      .order("supplier_name", { ascending: true }),
  ]);

  return (
    <ClientImportPage
      suppliers={suppliersRes.data ?? []}
    />
  );
}

