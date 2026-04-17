// /src/app/suppliers/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientSuppliersPage from "./components/ClientSuppliersPage";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_number, contact_name, contact_email, phone")
    .eq("tenant_id", tenantId)
    .order("supplier_name", { ascending: true });

  return <ClientSuppliersPage suppliers={suppliers ?? []} />;
}
