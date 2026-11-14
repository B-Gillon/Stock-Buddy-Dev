// /src/app/suppliers/[id]/page.jsx
import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantFromHeaders } from "@/lib/tenants";
import ClientSupplierDetailPage from "./components/ClientSupplierDetailPage";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }) {
  const { slug } = await params;

  const headersList = await headers();
  const { tenantId, shopDomain } = await getTenantFromHeaders(headersList);

  // ── Fetch supplier + addresses ─────────────────────────────────────────────
  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select(`
      id,
      supplier_name,
      supplier_number,
      ap_number,
      company_name,
      contact_name,
      contact_email,
      lead_days,
      currency,
      price_list,
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
      created_at,
      updated_at,
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
    .eq("tenant_id", tenantId)
    .eq("supplier_number", slug)
    .single();

  if (supplierError || !supplier) notFound();

  // ── Fetch associated variants for this supplier ────────────────────────────
  const { data: supplierVariants } = await supabase
    .from("supplier_variants")
    .select("variant_id")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplier.id);

  const variantIds = (supplierVariants ?? []).map((r) => r.variant_id);

  let products = [];

  if (variantIds.length > 0) {
    const { data: variantRows } = await supabase
      .from("variants")
      .select("id, product_id, sku, price, compare_at_price, inventory_quantity, barcode, taxable, inventory_policy")
      .eq("tenant_id", tenantId)
      .in("id", variantIds);

    const productIds = [...new Set((variantRows ?? []).map((v) => v.product_id))];

    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select(`
          id,
          shopify_product_id,
          title,
          display_title,
          vendor,
          product_type,
          category,
          status,
          image_src,
          collection
        `)
        .eq("tenant_id", tenantId)
        .in("id", productIds)
        .order("title");

      const variantsByProduct = {};
      (variantRows ?? []).forEach((v) => {
        if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = v;
      });

      products = (productRows ?? []).map((p) => ({
        ...p,
        ...(variantsByProduct[p.id] ?? {}),
      }));
    }
  }

  return <ClientSupplierDetailPage supplier={supplier} products={products} shopDomain={`https://${shopDomain}`} />;
}
