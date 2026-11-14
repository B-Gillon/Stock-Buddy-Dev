// /src/app/api/suppliers/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);
    const body = await request.json();
    const { form, addresses } = body;

    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .insert({
        tenant_id: tenantId, supplier_name: form.supplier_name, supplier_number: form.supplier_number,
        company_name: form.company_name, contact_name: form.contact_name || null,
        contact_email: form.contact_email || null, phone: form.phone || null,
        phone_toll_free: form.phone_toll_free || null, fax: form.fax || null,
        website: form.website || null, ap_number: form.ap_number || null,
        payment_terms: form.payment_terms || null, payment_method: form.payment_method || null,
        currency: form.currency, lead_days: form.lead_days ? parseInt(form.lead_days, 10) : null,
        online_order_form: form.online_order_form || null,
        username: form.username || null, supplier_tax_type: form.supplier_tax_type || null,
        supplier_notes: form.supplier_notes || null, po_notes_template: form.po_notes_template || null,
      })
      .select("id").single();

    if (supplierError) throw supplierError;

    if (addresses && addresses.length > 0) {
      const addressRows = addresses.map((a) => ({
        tenant_id: tenantId, supplier_id: supplier.id, address_type: a.address_type || "primary",
        address1: a.address1, address2: a.address2 || null, city: a.city,
        state_province: a.state_province, postal_code: a.postal_code, country: a.country,
      }));
      const { error: addrError } = await supabase.from("supplier_addresses").insert(addressRows);
      if (addrError) throw addrError;
    }

    return NextResponse.json({ id: supplier.id }, { status: 201 });
  } catch (err) {
    await logError({ source: 'api/suppliers/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
