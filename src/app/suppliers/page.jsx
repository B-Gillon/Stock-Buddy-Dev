// /src/app/suppliers/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientSuppliersPage from "./components/ClientSuppliersPage";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, supplier_name, supplier_number, contact_name, contact_email, phone")
    .order("supplier_name", { ascending: true });

  return <ClientSuppliersPage suppliers={suppliers ?? []} />;
}
