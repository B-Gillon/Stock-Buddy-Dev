// /src/app/suppliers/[slug]/edit/page.jsx
import { supabase } from "@/lib/supabaseClient";
import ClientSupplierEditPage from "./components/ClientSupplierEditPage";
import { notFound } from "next/navigation";

export default async function SupplierEditPage({ params }) {
  const { slug } = await params;

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select(`
      id,
      supplier_name,
      supplier_number,
      ap_number,
      company_name,
      contact_name,
      contact_email,
      po_email,
      lead_days,
      currency,
      supplier_tax_type,
      payment_terms,
      payment_method,
      phone,
      phone_toll_free,
      fax,
      forecast_suggestion_period,
      website,
      online_order_form,
      username,
      supplier_notes,
      po_notes_template,
      supplier_addresses (
        id,
        address_type,
        address1,
        address2,
        city,
        state_province,
        postal_code,
        country
      )
    `)
    .eq("supplier_number", slug)
    .single();

  if (error || !supplier) {
    notFound();
  }

  return <ClientSupplierEditPage supplier={supplier} />;
}
